from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
import app.models as models

router = APIRouter(prefix="/api/search", tags=["Search"])


@router.get("")
def search(
    q: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    term = f"%{q.lower()}%"

    # ── Students ──────────────────────────────────────────
    student_query = db.query(models.User).filter(
        models.User.role == models.RoleEnum.student,
        (models.User.name.ilike(term)) | (models.User.email.ilike(term)) |
        (models.User.matric_number.ilike(term)),
    )
    if current_user.role == models.RoleEnum.lecturer:
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.student_id)
            .join(models.Class, models.Class.id == models.Enrollment.class_id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        student_query = student_query.filter(models.User.id.in_(enrolled_ids))
    elif current_user.role == models.RoleEnum.student:
        student_query = student_query.filter(models.User.id == current_user.id)

    students = [
        {"id": s.id, "name": s.name, "email": s.email,
         "matric_number": s.matric_number, "department": s.department,
         "type": "student", "link": f"/students/{s.id}"}
        for s in student_query.limit(5).all()
    ]

    # ── Classes ───────────────────────────────────────────
    class_query = db.query(models.Class).filter(
        (models.Class.name.ilike(term)) | (models.Class.subject.ilike(term)) |
        (models.Class.course_code.ilike(term)),
    )
    if current_user.role == models.RoleEnum.lecturer:
        class_query = class_query.filter(models.Class.lecturer_id == current_user.id)
    elif current_user.role == models.RoleEnum.student:
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id)
            .all()
        ]
        class_query = class_query.filter(models.Class.id.in_(enrolled_ids))

    classes = [
        {"id": c.id, "name": c.name, "subject": c.subject,
         "course_code": c.course_code,
         "type": "class",
         "link": "/class-preparation" if current_user.role != models.RoleEnum.student else "/student/overview"}
        for c in class_query.limit(5).all()
    ]

    # ── Assignments ───────────────────────────────────────
    assignment_query = db.query(models.Assignment).filter(
        models.Assignment.title.ilike(term),
    )
    if current_user.role == models.RoleEnum.lecturer:
        own_class_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        assignment_query = assignment_query.filter(models.Assignment.class_id.in_(own_class_ids))
    elif current_user.role == models.RoleEnum.student:
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id)
            .all()
        ]
        assignment_query = assignment_query.filter(models.Assignment.class_id.in_(enrolled_ids))

    assignments = [
        {"id": a.id, "title": a.title, "due_date": str(a.due_date),
         "type": "assignment",
         "link": "/assignments" if current_user.role != models.RoleEnum.student else "/student/assignments"}
        for a in assignment_query.limit(5).all()
    ]

    # ── Exams ─────────────────────────────────────────────
    exam_query = db.query(models.Exam).filter(models.Exam.title.ilike(term))
    if current_user.role == models.RoleEnum.lecturer:
        own_class_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        exam_query = exam_query.filter(models.Exam.class_id.in_(own_class_ids))
    elif current_user.role == models.RoleEnum.student:
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id)
            .all()
        ]
        exam_query = exam_query.filter(models.Exam.class_id.in_(enrolled_ids))

    exams = [
        {"id": e.id, "title": e.title, "exam_date": str(e.exam_date),
         "type": "exam",
         "link": "/exams" if current_user.role != models.RoleEnum.student else "/student/grades"}
        for e in exam_query.limit(5).all()
    ]

    total = len(students) + len(classes) + len(assignments) + len(exams)
    return {
        "query": q,
        "total": total,
        "students": students,
        "classes": classes,
        "assignments": assignments,
        "exams": exams,
    }
