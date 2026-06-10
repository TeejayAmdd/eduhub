"""
Continuous Assessment (CA) — per-course breakdown of each student's
assignment, test (quiz) and attendance performance for the lecturer.

The endpoint returns the raw aggregates; the frontend applies the
lecturer's chosen weights so they can adjust the split live.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import require_lecturer
from app.utils.roster import enrolled_students_query, paginate_students, clamp_page
import app.models as models

router = APIRouter(prefix="/api/ca", tags=["Continuous Assessment"])

CA_MAX = 30


class CAOverrideIn(BaseModel):
    student_id: int
    score: float


def _owned_class_or_403(class_id: int, db: Session, user: models.User) -> models.Class:
    cls = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not cls or cls.lecturer_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return cls


def _attendance_points(pct: float) -> int:
    """Map an attendance percentage to a 0-5 score."""
    if pct >= 80:
        return 5
    if pct >= 70:
        return 4
    if pct >= 60:
        return 3
    if pct >= 50:
        return 2
    if pct >= 40:
        return 1
    return 0


@router.get("/{class_id}")
def get_ca(
    class_id: int,
    search: str = "",
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """Return a paginated CA breakdown for enrolled students in a course the lecturer owns.

    Scales to large courses: only one page of students is loaded, and each metric
    is aggregated for that page in a single GROUP BY query (no per-student N+1).
    """
    cls = _owned_class_or_403(class_id, db, current_user)
    limit, offset = clamp_page(limit, offset)

    # One page of enrolled students, ordered alphabetically, with optional search
    base_q = enrolled_students_query(db, class_id, search)
    total, page = paginate_students(base_q, limit, offset)
    page_ids = [s.id for s in page]

    if not page_ids:
        return {
            "class_id": cls.id, "class_name": cls.name, "course_code": cls.course_code,
            "ca_max": CA_MAX, "total": total, "limit": limit, "offset": offset, "students": [],
        }

    assignment_ids = [
        r[0] for r in db.query(models.Assignment.id)
        .filter(models.Assignment.class_id == class_id).all()
    ]
    quiz_ids = [
        r[0] for r in db.query(models.Quiz.id)
        .filter(models.Quiz.class_id == class_id).all()
    ]

    # ── Assignments: one GROUP BY for the whole page ──
    assign_map: dict[int, tuple[float, int]] = {}
    if assignment_ids:
        rows = (
            db.query(
                models.Submission.student_id,
                func.avg(models.Submission.score),
                func.count(models.Submission.id),
            )
            .filter(
                models.Submission.assignment_id.in_(assignment_ids),
                models.Submission.student_id.in_(page_ids),
                models.Submission.score.isnot(None),
            )
            .group_by(models.Submission.student_id)
            .all()
        )
        assign_map = {sid: (avg, cnt) for sid, avg, cnt in rows}

    # ── Quizzes: fetch the page's attempts once, average percentages in Python ──
    quiz_map: dict[int, tuple[float, float, float, int]] = {}
    if quiz_ids:
        attempts = (
            db.query(
                models.QuizAttempt.student_id,
                models.QuizAttempt.score,
                models.QuizAttempt.total,
            )
            .filter(
                models.QuizAttempt.quiz_id.in_(quiz_ids),
                models.QuizAttempt.student_id.in_(page_ids),
                models.QuizAttempt.submitted_at.isnot(None),
                models.QuizAttempt.score.isnot(None),
                models.QuizAttempt.total.isnot(None),
            )
            .all()
        )
        grouped: dict[int, list[tuple[float, float]]] = {}
        for sid, score, tot in attempts:
            if (tot or 0) > 0:
                grouped.setdefault(sid, []).append((score, tot))
        for sid, lst in grouped.items():
            n = len(lst)
            quiz_map[sid] = (
                round(sum(s for s, _ in lst) / n, 1),
                round(sum(t for _, t in lst) / n, 1),
                round(sum((s / t) * 100 for s, t in lst) / n, 1),
                n,
            )

    # ── Attendance: one GROUP BY (count + present-count) for the page ──
    att_map: dict[int, tuple[int, int]] = {}
    rows = (
        db.query(
            models.Attendance.student_id,
            func.count(models.Attendance.id),
            func.sum(case((models.Attendance.status == models.StatusEnum.present, 1), else_=0)),
        )
        .filter(
            models.Attendance.class_id == class_id,
            models.Attendance.student_id.in_(page_ids),
        )
        .group_by(models.Attendance.student_id)
        .all()
    )
    for sid, tot, present in rows:
        att_map[sid] = (int(tot or 0), int(present or 0))

    # ── Overrides for the page ──
    overrides = {
        o.student_id: o.score
        for o in db.query(models.CAOverride).filter(
            models.CAOverride.class_id == class_id,
            models.CAOverride.student_id.in_(page_ids),
        ).all()
    }

    students = []
    for s in page:
        a_avg, a_cnt = assign_map.get(s.id, (None, 0))
        q_score, q_total, q_pct, q_cnt = quiz_map.get(s.id, (None, None, None, 0))
        att_total, att_present = att_map.get(s.id, (0, 0))
        att_pct = round((att_present / att_total) * 100, 1) if att_total > 0 else 0.0
        students.append({
            "student_id": s.id,
            "student_name": s.name,
            "matric_number": s.matric_number,
            "assignment_avg": round(a_avg, 1) if a_avg is not None else None,
            "assignment_count": int(a_cnt or 0),
            "quiz_avg_score": q_score,
            "quiz_avg_total": q_total,
            "quiz_avg_pct": q_pct,
            "quiz_count": q_cnt,
            "attendance_present": att_present,
            "attendance_total": att_total,
            "attendance_pct": att_pct,
            "attendance_points": _attendance_points(att_pct),
            "ca_override": overrides.get(s.id),
        })

    return {
        "class_id": cls.id,
        "class_name": cls.name,
        "course_code": cls.course_code,
        "ca_max": CA_MAX,
        "total": total,
        "limit": limit,
        "offset": offset,
        "students": students,
    }


@router.put("/{class_id}/override")
def set_ca_override(
    class_id: int,
    payload: CAOverrideIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """Manually set a student's CA total (out of 30) for this course."""
    _owned_class_or_403(class_id, db, current_user)

    if payload.score < 0 or payload.score > CA_MAX:
        raise HTTPException(400, f"Score must be between 0 and {CA_MAX}.")

    enrolled = db.query(models.Enrollment).filter(
        models.Enrollment.class_id == class_id,
        models.Enrollment.student_id == payload.student_id,
    ).first()
    if not enrolled:
        raise HTTPException(404, "Student is not enrolled in this course.")

    row = db.query(models.CAOverride).filter(
        models.CAOverride.class_id == class_id,
        models.CAOverride.student_id == payload.student_id,
    ).first()
    if row:
        row.score = payload.score
    else:
        row = models.CAOverride(
            class_id=class_id, student_id=payload.student_id, score=payload.score,
        )
        db.add(row)
    db.commit()
    return {"student_id": payload.student_id, "score": payload.score}


@router.delete("/{class_id}/override/{student_id}", status_code=204)
def clear_ca_override(
    class_id: int,
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """Remove a manual override so the CA reverts to the computed value."""
    _owned_class_or_403(class_id, db, current_user)
    db.query(models.CAOverride).filter(
        models.CAOverride.class_id == class_id,
        models.CAOverride.student_id == student_id,
    ).delete()
    db.commit()
