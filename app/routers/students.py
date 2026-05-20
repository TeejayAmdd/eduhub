from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas import UserOut, EnrollmentCreate, EnrollmentOut, StudentInClass, StudentDetailOut, StudentCourseDetail
from app.auth import get_current_user, require_lecturer
import app.models as models
from app.utils.notifications import push

router = APIRouter(prefix="/api/students", tags=["Students"])


@router.get("/")
def list_students(
    class_id: Optional[int] = None,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.User).filter(models.User.role == models.RoleEnum.student)

    if current_user.role == models.RoleEnum.lecturer:
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.student_id)
            .join(models.Class, models.Class.id == models.Enrollment.class_id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        query = query.filter(models.User.id.in_(enrolled_ids))

    if class_id:
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.student_id)
            .filter(models.Enrollment.class_id == class_id)
            .all()
        ]
        query = query.filter(models.User.id.in_(enrolled_ids))

    total = query.count()
    items = query.order_by(models.User.name).offset(offset).limit(limit).all()
    return {"total": total, "items": items}


@router.get("/{student_id}", response_model=UserOut)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    student = db.query(models.User).filter(
        models.User.id == student_id,
        models.User.role == models.RoleEnum.student,
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if current_user.role == models.RoleEnum.lecturer:
        # Verify this student is in at least one of the lecturer's classes
        shared = (
            db.query(models.Enrollment)
            .join(models.Class, models.Class.id == models.Enrollment.class_id)
            .filter(
                models.Enrollment.student_id == student_id,
                models.Class.lecturer_id == current_user.id,
            )
            .first()
        )
        if not shared:
            raise HTTPException(status_code=403, detail="Access denied")

    return student


@router.post("/enroll", response_model=EnrollmentOut, status_code=201)
def enroll_student(
    payload: EnrollmentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """Lecturer or admin manually enrolls a student."""
    existing = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == payload.student_id,
        models.Enrollment.class_id == payload.class_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student already enrolled in this class")

    enrollment = models.Enrollment(**payload.model_dump())
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)

    # Notify the student
    class_ = db.query(models.Class).filter(models.Class.id == payload.class_id).first()
    if class_:
        course_name = f"{class_.name} ({class_.course_code})" if class_.course_code else class_.name
        push(
            db,
            user_id=payload.student_id,
            type="assignment",
            title="Successfully enrolled in a course",
            body=f"You have been enrolled in {course_name}. Welcome aboard!",
            link="/student/classes",
        )
        db.commit()

    return enrollment


@router.get("/class/{class_id}")
def students_in_class(
    class_id: int,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")

    if current_user.role == models.RoleEnum.lecturer and class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    base_q = db.query(models.Enrollment).filter(models.Enrollment.class_id == class_id)
    total  = base_q.count()
    page   = base_q.order_by(models.Enrollment.roll_number).offset(offset).limit(limit).all()

    result = []
    for e in page:
        student = e.student
        att_total = db.query(models.Attendance).filter(
            models.Attendance.student_id == student.id,
            models.Attendance.class_id == class_id,
        ).count()
        att_present = db.query(models.Attendance).filter(
            models.Attendance.student_id == student.id,
            models.Attendance.class_id == class_id,
            models.Attendance.status == models.StatusEnum.present,
        ).count()
        rate = round((att_present / att_total * 100), 1) if att_total > 0 else None

        result.append(StudentInClass(
            id=student.id,
            name=student.name,
            email=student.email,
            matric_number=student.matric_number,
            department=student.department,
            level=student.level,
            roll_number=e.roll_number,
            grade=e.grade,
            attendance_rate=rate,
        ))
    return {"total": total, "items": result}


@router.get("/{student_id}/courses", response_model=StudentDetailOut)
def get_student_detail(
    student_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Full student profile with per-course stats for all classes shared with the lecturer."""
    student = db.query(models.User).filter(
        models.User.id == student_id,
        models.User.role == models.RoleEnum.student,
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if current_user.role == models.RoleEnum.lecturer:
        enrollments = (
            db.query(models.Enrollment)
            .join(models.Class, models.Class.id == models.Enrollment.class_id)
            .filter(
                models.Enrollment.student_id == student_id,
                models.Class.lecturer_id == current_user.id,
            )
            .all()
        )
        if not enrollments:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        enrollments = (
            db.query(models.Enrollment)
            .filter(models.Enrollment.student_id == student_id)
            .all()
        )

    courses = []
    for e in enrollments:
        cls = db.query(models.Class).filter(models.Class.id == e.class_id).first()
        if not cls:
            continue

        # ── Attendance ────────────────────────────────────────────────────────
        att_rows = db.query(models.Attendance).filter(
            models.Attendance.student_id == student_id,
            models.Attendance.class_id == cls.id,
        ).all()
        att_total   = len(att_rows)
        att_present = sum(1 for a in att_rows if a.status == models.StatusEnum.present)
        att_late    = sum(1 for a in att_rows if a.status == models.StatusEnum.late)
        att_absent  = sum(1 for a in att_rows if a.status == models.StatusEnum.absent)
        att_rate    = round(att_present / att_total * 100, 1) if att_total else None

        # ── Assignments ───────────────────────────────────────────────────────
        assign_ids = [
            r[0] for r in db.query(models.Assignment.id)
            .filter(models.Assignment.class_id == cls.id).all()
        ]
        assignments_total = len(assign_ids)
        subs = (
            db.query(models.Submission)
            .filter(
                models.Submission.assignment_id.in_(assign_ids),
                models.Submission.student_id == student_id,
                models.Submission.status != models.SubmissionStatusEnum.pending,
            )
            .all()
        ) if assign_ids else []
        graded = [s for s in subs if s.score is not None]
        assign_avg = round(sum(s.score for s in graded) / len(graded), 1) if graded else None

        # ── Quizzes ───────────────────────────────────────────────────────────
        quiz_ids = [
            r[0] for r in db.query(models.Quiz.id)
            .filter(models.Quiz.class_id == cls.id).all()
        ]
        quizzes_total = len(quiz_ids)
        attempts = (
            db.query(models.QuizAttempt)
            .filter(
                models.QuizAttempt.quiz_id.in_(quiz_ids),
                models.QuizAttempt.student_id == student_id,
                models.QuizAttempt.submitted_at != None,
            )
            .all()
        ) if quiz_ids else []
        scored = [a for a in attempts if a.score is not None and a.total]
        quiz_avg = (
            round(sum(a.score / a.total * 100 for a in scored) / len(scored), 1)
            if scored else None
        )

        courses.append(StudentCourseDetail(
            class_id=cls.id,
            class_name=cls.name,
            course_code=cls.course_code,
            level=cls.level,
            academic_year=cls.academic_year,
            roll_number=e.roll_number,
            grade=e.grade,
            enrolled_at=e.enrolled_at,
            att_total=att_total,
            att_present=att_present,
            att_late=att_late,
            att_absent=att_absent,
            attendance_rate=att_rate,
            assignments_total=assignments_total,
            assignments_submitted=len(subs),
            assignments_graded=len(graded),
            assignment_avg_score=assign_avg,
            quizzes_total=quizzes_total,
            quizzes_attempted=len(attempts),
            quiz_avg_score=quiz_avg,
        ))

    return StudentDetailOut(
        id=student.id,
        name=student.name,
        email=student.email,
        matric_number=student.matric_number,
        department=student.department,
        level=student.level,
        is_active=student.is_active,
        created_at=student.created_at,
        courses=courses,
    )
