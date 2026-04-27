from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import date, datetime
from app.database import get_db
from app.schemas import (
    AttendanceCreate, AttendanceBulkCreate, AttendanceOut,
    ScheduleCreate, ScheduleOut,
    ExamCreate, ExamOut, ExamResultCreate, ExamResultOut,
    MessageCreate, MessageOut,
    AnnouncementCreate, AnnouncementOut,
    DashboardStats,
    ClassCreate, ClassOut,
)
import app.models as models


# ── Classes ──────────────────────────────────────────────────────────────────
classes_router = APIRouter(prefix="/api/classes", tags=["Classes"])

@classes_router.get("/", response_model=List[ClassOut])
def list_classes(db: Session = Depends(get_db)):
    return db.query(models.Class).all()

@classes_router.post("/", response_model=ClassOut, status_code=201)
def create_class(payload: ClassCreate, db: Session = Depends(get_db)):
    class_ = models.Class(**payload.model_dump(), lecturer_id=1)  # replace 1 with current_user.id
    db.add(class_)
    db.commit()
    db.refresh(class_)
    return class_

@classes_router.get("/{class_id}", response_model=ClassOut)
def get_class(class_id: int, db: Session = Depends(get_db)):
    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    return class_

@classes_router.delete("/{class_id}", status_code=204)
def delete_class(class_id: int, db: Session = Depends(get_db)):
    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    db.delete(class_)
    db.commit()


# ── Attendance ────────────────────────────────────────────────────────────────
attendance_router = APIRouter(prefix="/api/attendance", tags=["Attendance"])

@attendance_router.post("/", response_model=AttendanceOut, status_code=201)
def mark_attendance(payload: AttendanceCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Attendance).filter(
        models.Attendance.class_id == payload.class_id,
        models.Attendance.student_id == payload.student_id,
        models.Attendance.date == payload.date,
    ).first()
    if existing:
        existing.status = payload.status
        db.commit()
        db.refresh(existing)
        return existing
    record = models.Attendance(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

@attendance_router.post("/bulk", status_code=201)
def mark_bulk_attendance(payload: AttendanceBulkCreate, db: Session = Depends(get_db)):
    for rec in payload.records:
        existing = db.query(models.Attendance).filter(
            models.Attendance.class_id == payload.class_id,
            models.Attendance.student_id == rec["student_id"],
            models.Attendance.date == payload.date,
        ).first()
        if existing:
            existing.status = rec["status"]
        else:
            db.add(models.Attendance(
                class_id=payload.class_id,
                student_id=rec["student_id"],
                date=payload.date,
                status=rec["status"]
            ))
    db.commit()
    return {"message": f"{len(payload.records)} records saved"}

@attendance_router.get("/class/{class_id}", response_model=List[AttendanceOut])
def get_class_attendance(class_id: int, on_date: date = None, db: Session = Depends(get_db)):
    query = db.query(models.Attendance).filter(models.Attendance.class_id == class_id)
    if on_date:
        query = query.filter(models.Attendance.date == on_date)
    return query.all()

@attendance_router.get("/student/{student_id}/rate")
def get_student_attendance_rate(student_id: int, class_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Attendance).filter(models.Attendance.student_id == student_id)
    if class_id:
        query = query.filter(models.Attendance.class_id == class_id)
    total = query.count()
    present = query.filter(models.Attendance.status == models.StatusEnum.present).count()
    rate = round((present / total * 100), 1) if total > 0 else 0
    return {"student_id": student_id, "total_days": total, "present": present, "rate": rate}


# ── Schedule ──────────────────────────────────────────────────────────────────
schedule_router = APIRouter(prefix="/api/schedule", tags=["Schedule"])

@schedule_router.post("/", response_model=ScheduleOut, status_code=201)
def create_schedule(payload: ScheduleCreate, db: Session = Depends(get_db)):
    schedule = models.Schedule(**payload.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule

@schedule_router.get("/", response_model=List[ScheduleOut])
def list_schedules(class_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Schedule)
    if class_id:
        query = query.filter(models.Schedule.class_id == class_id)
    return query.all()

@schedule_router.get("/today")
def todays_schedule(db: Session = Depends(get_db)):
    today = datetime.now().strftime("%A")  # "Monday", "Tuesday"...
    schedules = db.query(models.Schedule).filter(
        models.Schedule.day_of_week == today
    ).order_by(models.Schedule.start_time).all()
    return schedules

@schedule_router.delete("/{schedule_id}", status_code=204)
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    s = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    db.delete(s)
    db.commit()


# ── Exams ─────────────────────────────────────────────────────────────────────
exams_router = APIRouter(prefix="/api/exams", tags=["Exams"])

@exams_router.post("/", response_model=ExamOut, status_code=201)
def create_exam(payload: ExamCreate, db: Session = Depends(get_db)):
    exam = models.Exam(**payload.model_dump(), created_by=1)  # replace 1 with current_user.id
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam

@exams_router.get("/", response_model=List[ExamOut])
def list_exams(class_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Exam)
    if class_id:
        query = query.filter(models.Exam.class_id == class_id)
    return query.all()

@exams_router.post("/results", response_model=ExamResultOut, status_code=201)
def add_result(payload: ExamResultCreate, db: Session = Depends(get_db)):
    result = models.ExamResult(**payload.model_dump())
    db.add(result)
    db.commit()
    db.refresh(result)
    return result

@exams_router.patch("/results/{result_id}/publish")
def publish_result(result_id: int, db: Session = Depends(get_db)):
    result = db.query(models.ExamResult).filter(models.ExamResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    result.published = True
    db.commit()
    return {"message": "Result published"}

@exams_router.get("/{exam_id}/results", response_model=List[ExamResultOut])
def get_exam_results(exam_id: int, db: Session = Depends(get_db)):
    return db.query(models.ExamResult).filter(models.ExamResult.exam_id == exam_id).all()


# ── Messages ──────────────────────────────────────────────────────────────────
messages_router = APIRouter(prefix="/api/messages", tags=["Messages"])

@messages_router.post("/", response_model=MessageOut, status_code=201)
def send_message(payload: MessageCreate, db: Session = Depends(get_db)):
    msg = models.Message(**payload.model_dump(), sender_id=1)  # replace 1 with current_user.id
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg

@messages_router.get("/inbox")
def get_inbox(db: Session = Depends(get_db)):
    # replace 1 with current_user.id when auth is added
    return db.query(models.Message).filter(models.Message.recipient_id == 1).order_by(
        models.Message.sent_at.desc()
    ).all()

@messages_router.patch("/{message_id}/read")
def mark_read(message_id: int, db: Session = Depends(get_db)):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    msg.read_at = datetime.utcnow()
    db.commit()
    return {"message": "Marked as read"}


# ── Announcements ─────────────────────────────────────────────────────────────
announcements_router = APIRouter(prefix="/api/announcements", tags=["Announcements"])

@announcements_router.post("/", response_model=AnnouncementOut, status_code=201)
def create_announcement(payload: AnnouncementCreate, db: Session = Depends(get_db)):
    ann = models.Announcement(**payload.model_dump(), created_by=1)  # replace 1 with current_user.id
    db.add(ann)
    db.commit()
    db.refresh(ann)
    return ann

@announcements_router.get("/", response_model=List[AnnouncementOut])
def list_announcements(class_id: int = None, db: Session = Depends(get_db)):
    query = db.query(models.Announcement)
    if class_id:
        query = query.filter(models.Announcement.class_id == class_id)
    return query.order_by(models.Announcement.created_at.desc()).all()


# ── Analytics / Dashboard ─────────────────────────────────────────────────────
analytics_router = APIRouter(prefix="/api/analytics", tags=["Analytics"])

@analytics_router.get("/dashboard", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db)):
    total_students = db.query(models.User).filter(
        models.User.role == models.RoleEnum.student
    ).count()

    today = date.today()
    day_name = datetime.now().strftime("%A")
    classes_today = db.query(models.Schedule).filter(
        models.Schedule.day_of_week == day_name
    ).count()

    pending_assignments = db.query(models.Submission).filter(
        models.Submission.status == models.SubmissionStatusEnum.pending
    ).count()

    total_att = db.query(models.Attendance).filter(
        models.Attendance.date == today
    ).count()
    present_att = db.query(models.Attendance).filter(
        models.Attendance.date == today,
        models.Attendance.status == models.StatusEnum.present
    ).count()
    attendance_rate = round((present_att / total_att * 100), 1) if total_att > 0 else 0.0

    return DashboardStats(
        total_students=total_students,
        classes_this_week=classes_today,
        pending_assignments=pending_assignments,
        attendance_rate=attendance_rate
    )
