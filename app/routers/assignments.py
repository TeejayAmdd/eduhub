from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.auth import get_current_user, require_lecturer
from app.schemas import AssignmentCreate, AssignmentOut, ExtendDeadline, SubmissionCreate, SubmissionUpdate, SubmissionOut, RosterEntry
from app.utils.notifications import push
import app.models as models

router = APIRouter(prefix="/api/assignments", tags=["Assignments"])


def _enrich(a: models.Assignment, db: Session, student_id: int | None = None) -> AssignmentOut:
    total   = db.query(models.Submission).filter(models.Submission.assignment_id == a.id).count()
    pending = db.query(models.Submission).filter(
        models.Submission.assignment_id == a.id,
        models.Submission.status == models.SubmissionStatusEnum.pending,
    ).count()
    overdue = db.query(models.Submission).filter(
        models.Submission.assignment_id == a.id,
        models.Submission.status == models.SubmissionStatusEnum.overdue,
    ).count()
    submitted = None
    if student_id is not None:
        existing = db.query(models.Submission).filter(
            models.Submission.assignment_id == a.id,
            models.Submission.student_id == student_id,
            models.Submission.status == models.SubmissionStatusEnum.submitted,
        ).first()
        submitted = existing is not None
    class_ = db.query(models.Class).filter(models.Class.id == a.class_id).first()
    return AssignmentOut(
        id=a.id, title=a.title, description=a.description,
        class_id=a.class_id, class_name=class_.name if class_ else None,
        due_date=a.due_date, created_at=a.created_at,
        submission_type=a.submission_type or "any",
        total_submissions=total, pending_count=pending, overdue_count=overdue,
        submitted=submitted,
    )


@router.get("", response_model=List[AssignmentOut])
def list_assignments(
    class_id: int = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Assignment)

    if current_user.role == models.RoleEnum.lecturer:
        own_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        query = query.filter(models.Assignment.class_id.in_(own_ids))
    elif current_user.role == models.RoleEnum.student:
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id)
            .all()
        ]
        query = query.filter(models.Assignment.class_id.in_(enrolled_ids))

    if class_id:
        query = query.filter(models.Assignment.class_id == class_id)

    sid = current_user.id if current_user.role == models.RoleEnum.student else None
    return [_enrich(a, db, student_id=sid) for a in query.all()]


@router.post("", response_model=AssignmentOut, status_code=201)
def create_assignment(
    payload: AssignmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    class_ = db.query(models.Class).filter(models.Class.id == payload.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    assignment = models.Assignment(**payload.model_dump(), created_by=current_user.id)
    db.add(assignment)
    db.flush()

    enrolled = db.query(models.Enrollment).filter(models.Enrollment.class_id == payload.class_id).all()
    due_str = assignment.due_date.strftime('%A, %d %b %Y at %I:%M %p')
    student_info = []
    for e in enrolled:
        push(db, e.student_id, type="assignment",
             title=f"New assignment: {assignment.title}",
             body=f"Due {assignment.due_date.strftime('%d %b %Y')} · {class_.name}",
             link="/student/assignments")
        student = db.query(models.User).filter(models.User.id == e.student_id).first()
        if student:
            student_info.append((student.email, student.name))

    def _send_new_assignment(info, course, title, due):
        from app.services.email_service import send_new_assignment
        for email, name in info:
            send_new_assignment(email, name, course, title, due)

    background_tasks.add_task(_send_new_assignment, student_info, class_.name, assignment.title, due_str)

    db.commit()
    db.refresh(assignment)
    return _enrich(assignment, db)


@router.get("/{assignment_id}", response_model=AssignmentOut)
def get_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return _enrich(assignment, db)


@router.delete("/{assignment_id}", status_code=204)
def delete_assignment(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    db.delete(assignment)
    db.commit()


@router.patch("/{assignment_id}/extend", response_model=AssignmentOut)
def extend_deadline(
    assignment_id: int,
    payload: ExtendDeadline,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    class_ = db.query(models.Class).filter(models.Class.id == assignment.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    new_dt = payload.new_due_date.replace(tzinfo=None)
    if new_dt <= assignment.due_date:
        raise HTTPException(status_code=400, detail="New deadline must be after the current deadline")

    old_date_str = assignment.due_date.strftime('%d %b %Y, %H:%M')
    new_date_str = new_dt.strftime('%d %b %Y, %H:%M')
    assignment.due_date = new_dt

    enrolled = db.query(models.Enrollment).filter(models.Enrollment.class_id == assignment.class_id).all()
    student_info = []
    for e in enrolled:
        push(db, e.student_id, type="assignment",
             title=f"Deadline extended: {assignment.title}",
             body=f"New deadline: {new_date_str} (was {old_date_str}) · {class_.name}",
             link="/student/assignments")
        student = db.query(models.User).filter(models.User.id == e.student_id).first()
        if student:
            student_info.append((student.email, student.name))

    def _send_extended(info, course, title, old, new):
        from app.services.email_service import send_deadline_extended
        for email, name in info:
            send_deadline_extended(email, name, course, title, old, new)

    background_tasks.add_task(_send_extended, student_info, class_.name, assignment.title, old_date_str, new_date_str)

    db.commit()
    db.refresh(assignment)
    return _enrich(assignment, db)


@router.post("/{assignment_id}/submit", response_model=SubmissionOut, status_code=201)
def submit_assignment(
    assignment_id: int,
    payload: SubmissionCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only students can submit")

    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    existing = db.query(models.Submission).filter(
        models.Submission.assignment_id == assignment_id,
        models.Submission.student_id == current_user.id,
    ).first()
    if existing:
        existing.status = models.SubmissionStatusEnum.submitted
        existing.submitted_at = datetime.utcnow()
        existing.file_url = payload.file_url
        db.commit()
        db.refresh(existing)
        return existing

    submission = models.Submission(
        assignment_id=assignment_id,
        student_id=current_user.id,
        file_url=payload.file_url,
        submitted_at=datetime.utcnow(),
        status=models.SubmissionStatusEnum.submitted,
    )
    db.add(submission)
    db.flush()

    class_ = db.query(models.Class).filter(models.Class.id == assignment.class_id).first()
    if class_:
        push(db, class_.lecturer_id, type="submission",
             title=f"{current_user.name} submitted an assignment",
             body=f"{assignment.title} · {class_.name}",
             link="/assignments")
        lecturer = db.query(models.User).filter(models.User.id == class_.lecturer_id).first()
        if lecturer:
            def _send_submitted(lec_email, lec_name, stu_name, a_title, course):
                from app.services.email_service import send_assignment_submitted
                send_assignment_submitted(lec_email, lec_name, stu_name, a_title, course)
            background_tasks.add_task(_send_submitted, lecturer.email, lecturer.name, current_user.name, assignment.title, class_.name)

    db.commit()
    db.refresh(submission)
    return submission


@router.patch("/submissions/{submission_id}", response_model=SubmissionOut)
def update_submission(
    submission_id: int,
    payload: SubmissionUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    submission = db.query(models.Submission).filter(models.Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(submission, field, value)

    if payload.score is not None:
        assignment = db.query(models.Assignment).filter(models.Assignment.id == submission.assignment_id).first()
        push(db, submission.student_id, type="exam_result",
             title="Assignment graded",
             body=f"{assignment.title} — Score: {payload.score}" if assignment else f"Score: {payload.score}",
             link="/student/grades")
        student = db.query(models.User).filter(models.User.id == submission.student_id).first()
        if student and assignment:
            class_ = db.query(models.Class).filter(models.Class.id == assignment.class_id).first()
            score_str = str(payload.score)
            if payload.feedback:
                score_str += f" — {payload.feedback}"
            def _send_graded(email, name, course, title, score):
                from app.services.email_service import send_assignment_graded
                send_assignment_graded(email, name, course, title, score)
            background_tasks.add_task(_send_graded, student.email, student.name,
                                      class_.name if class_ else "", assignment.title, score_str)

    db.commit()
    db.refresh(submission)
    return submission


@router.get("/{assignment_id}/submissions", response_model=List[SubmissionOut])
def get_submissions(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    return db.query(models.Submission).filter(
        models.Submission.assignment_id == assignment_id
    ).all()


@router.get("/{assignment_id}/roster", response_model=List[RosterEntry])
def get_roster(
    assignment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """Returns all enrolled students for the assignment's class with their submission status."""
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    class_ = db.query(models.Class).filter(models.Class.id == assignment.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    enrollments = (
        db.query(models.Enrollment)
        .filter(models.Enrollment.class_id == assignment.class_id)
        .all()
    )

    submissions_map = {
        s.student_id: s
        for s in db.query(models.Submission)
        .filter(
            models.Submission.assignment_id == assignment_id,
            models.Submission.status == models.SubmissionStatusEnum.submitted,
        )
        .all()
    }

    result = []
    for e in enrollments:
        student = db.query(models.User).filter(models.User.id == e.student_id).first()
        if not student:
            continue
        sub = submissions_map.get(e.student_id)
        result.append(RosterEntry(
            student_id=student.id,
            student_name=student.name,
            matric_number=student.matric_number,
            submitted=sub is not None,
            submitted_at=sub.submitted_at if sub else None,
            file_url=sub.file_url if sub else None,
            score=sub.score if sub else None,
            feedback=sub.feedback if sub else None,
        ))

    # Sort: submitted first, then alphabetical
    result.sort(key=lambda r: (not r.submitted, r.student_name.lower()))
    return result
