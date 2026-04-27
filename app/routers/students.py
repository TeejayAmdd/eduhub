from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.schemas import UserOut, EnrollmentCreate, EnrollmentOut, StudentInClass
import app.models as models

router = APIRouter(prefix="/api/students", tags=["Students"])


@router.get("/", response_model=List[UserOut])
def list_students(
    class_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.User).filter(models.User.role == models.RoleEnum.student)
    if class_id:
        enrolled_ids = db.query(models.Enrollment.student_id).filter(
            models.Enrollment.class_id == class_id
        ).subquery()
        query = query.filter(models.User.id.in_(enrolled_ids))
    return query.all()


@router.get("/{student_id}", response_model=UserOut)
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(models.User).filter(
        models.User.id == student_id,
        models.User.role == models.RoleEnum.student
    ).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student


@router.post("/enroll", response_model=EnrollmentOut, status_code=201)
def enroll_student(payload: EnrollmentCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == payload.student_id,
        models.Enrollment.class_id == payload.class_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Student already enrolled in this class")

    enrollment = models.Enrollment(**payload.model_dump())
    db.add(enrollment)
    db.commit()
    db.refresh(enrollment)
    return enrollment


@router.get("/class/{class_id}", response_model=List[StudentInClass])
def students_in_class(class_id: int, db: Session = Depends(get_db)):
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.class_id == class_id
    ).all()

    result = []
    for e in enrollments:
        student = e.student
        total = db.query(models.Attendance).filter(
            models.Attendance.student_id == student.id,
            models.Attendance.class_id == class_id
        ).count()
        present = db.query(models.Attendance).filter(
            models.Attendance.student_id == student.id,
            models.Attendance.class_id == class_id,
            models.Attendance.status == models.StatusEnum.present
        ).count()
        rate = round((present / total * 100), 1) if total > 0 else None

        result.append(StudentInClass(
            id=student.id,
            name=student.name,
            email=student.email,
            roll_number=e.roll_number,
            grade=e.grade,
            attendance_rate=rate
        ))
    return result
