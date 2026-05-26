import csv
import io
import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func
from fastapi import Query as FQuery
from typing import List, Optional
from datetime import date, datetime, time as dt_time, timedelta, timezone
from app.database import get_db
from app.auth import get_current_user, require_lecturer
from app.utils.notifications import push
from app.schemas import (
    AttendanceCreate, AttendanceBulkCreate, AttendanceOut,
    ScheduleCreate, ScheduleOut, ScheduleSlot, ScheduleBulkCreate, ScheduleWithClassOut,
    ExamCreate, ExamOut, ExamResultCreate, ExamResultOut,
    MessageCreate, MessageOut, MessageThreadOut, MessageReactionOut,
    AnnouncementCreate, AnnouncementOut,
    DashboardStats,
    ClassCreate, ClassOut, ClassAvailableOut,
    UserOut, ProfileUpdate, PasswordChange,
)

MSG_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "message_attachments")
os.makedirs(MSG_UPLOAD_DIR, exist_ok=True)
from app.auth import hash_password, verify_password
from app.routers.websocket import push_message_ws
from app.services.email_service import (
    send_schedule_added, send_schedule_conflict, send_weekly_timetable,
    send_account_deleted,
)
import app.models as models

_DAY_MAP = {
    'Monday': 0, 'Tuesday': 1, 'Wednesday': 2,
    'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6,
}


def _get_week_bounds():
    """Returns (monday, sunday) date objects for the current week."""
    today = datetime.now().date()
    monday = today - timedelta(days=today.weekday())
    return monday, monday + timedelta(days=6)


def _ensure_week_lectures(db, slots, monday) -> int:
    """Auto-create a Lecture record for each slot's occurrence this week if one doesn't exist.
    Returns the number of lectures created."""
    created = 0
    for slot in slots:
        day_offset = _DAY_MAP.get(slot.day_of_week, 0)
        slot_date = monday + timedelta(days=day_offset)
        slot_dt = datetime.combine(slot_date, slot.start_time).replace(tzinfo=timezone.utc)

        # Check within ±2 h window to avoid duplicates
        window_start = slot_dt - timedelta(hours=2)
        window_end   = slot_dt + timedelta(hours=2)
        existing = db.query(models.Lecture).filter(
            models.Lecture.class_id == slot.class_id,
            models.Lecture.scheduled_at >= window_start,
            models.Lecture.scheduled_at <= window_end,
            models.Lecture.status == models.LectureStatusEnum.scheduled,
        ).first()

        if not existing:
            class_ = db.query(models.Class).filter(models.Class.id == slot.class_id).first()
            db.add(models.Lecture(
                class_id=slot.class_id,
                title=f"Regular Class — {class_.name if class_ else ''}".strip(' —'),
                description=f"Auto-scheduled from weekly timetable",
                scheduled_at=slot_dt,
                status=models.LectureStatusEnum.scheduled,
            ))
            created += 1
    return created


def _build_rows(db, slots, monday, extra_field: str) -> list:
    """Build timetable row dicts sorted by day then start_time.
    extra_field is 'enrolled_count' for lecturers or 'lecturer_name' for students."""
    rows = []
    for slot in sorted(slots, key=lambda s: (_DAY_MAP.get(s.day_of_week, 0), s.start_time)):
        class_ = db.query(models.Class).filter(models.Class.id == slot.class_id).first()
        day_off  = _DAY_MAP.get(slot.day_of_week, 0)
        slot_date = monday + timedelta(days=day_off)

        if extra_field == 'enrolled_count':
            count = db.query(models.Enrollment).filter(models.Enrollment.class_id == slot.class_id).count()
            extra = f"{count} student{'s' if count != 1 else ''}"
        else:
            lect = db.query(models.User).filter(
                models.User.id == class_.lecturer_id
            ).first() if class_ else None
            extra = lect.name if lect else None

        rows.append({
            'day':         slot.day_of_week,
            'date':        slot_date.strftime('%d %b'),
            'time':        f"{_fmt_time(slot.start_time)}–{_fmt_time(slot.end_time)}",
            'course':      class_.name if class_ else f"Class {slot.class_id}",
            'course_code': class_.course_code if class_ else None,
            'room':        slot.room,
            'extra':       extra,
        })
    return rows


def _times_overlap(s1: dt_time, e1: dt_time, s2: dt_time, e2: dt_time) -> bool:
    return s1 < e2 and s2 < e1


def _fmt_time(t: dt_time) -> str:
    return t.strftime("%H:%M")


# ── Users (profile + contacts) ────────────────────────────────────────────────
users_router = APIRouter(prefix="/api/users", tags=["Users"])


@users_router.get("/me", response_model=UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@users_router.patch("/me", response_model=UserOut)
def update_me(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if payload.name is not None:
        current_user.name = payload.name.strip()
    if payload.department is not None:
        current_user.department = payload.department.strip() or None
    if payload.level is not None:
        current_user.level = payload.level.strip() or None
    db.commit()
    db.refresh(current_user)
    return current_user


@users_router.post("/me/change-password")
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    current_user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@users_router.delete("/me", status_code=200)
def delete_account(
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Permanently delete the current user's account and all associated data."""
    id_number = (payload.get("id_number") or "").strip().upper()

    # Verify the user typed their own matric/staff number correctly
    expected = (
        current_user.matric_number or current_user.staff_number or ""
    ).upper()
    if not id_number:
        raise HTTPException(400, "ID number is required to confirm deletion")
    if id_number != expected:
        raise HTTPException(400, "ID number does not match your account")

    # Snapshot details before deletion for the goodbye email
    user_name  = current_user.name
    user_email = current_user.email
    user_role  = current_user.role.value
    user_id    = current_user.id

    # ── Cascade-delete all user data ──────────────────────────────────────────
    db.query(models.Notification).filter(models.Notification.user_id == user_id).delete()
    db.query(models.Message).filter(
        or_(models.Message.sender_id == user_id, models.Message.recipient_id == user_id)
    ).delete()
    db.query(models.Submission).filter(models.Submission.student_id == user_id).delete()
    db.query(models.Attendance).filter(models.Attendance.student_id == user_id).delete()
    db.query(models.Enrollment).filter(models.Enrollment.student_id == user_id).delete()
    db.query(models.QuizAttempt).filter(models.QuizAttempt.student_id == user_id).delete()
    db.query(models.CookieResponse).filter(models.CookieResponse.student_id == user_id).delete()
    db.query(models.ExamResult).filter(models.ExamResult.student_id == user_id).delete()

    # For lecturers: orphan their classes rather than cascade-deleting enrolled students
    db.query(models.Class).filter(models.Class.lecturer_id == user_id).update(
        {"lecturer_id": None}, synchronize_session=False
    )

    # Clean up auth records
    db.query(models.EmailVerification).filter(
        models.EmailVerification.email == user_email
    ).delete()
    db.query(models.PasswordResetCode).filter(
        models.PasswordResetCode.email == user_email
    ).delete()

    db.delete(current_user)
    db.commit()

    # Send goodbye email in background (account is already gone, fire-and-forget)
    background_tasks.add_task(
        send_account_deleted, user_email, user_name, user_role, expected
    )

    return {"message": "Account permanently deleted"}


@users_router.get("/contacts", response_model=List[UserOut])
def get_contacts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Students → list of lecturers who teach their enrolled classes.
    Lecturers → list of students enrolled in their classes.
    """
    if current_user.role == models.RoleEnum.student:
        enrolled_class_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id)
            .all()
        ]
        lecturer_ids = [
            r[0] for r in db.query(models.Class.lecturer_id)
            .filter(models.Class.id.in_(enrolled_class_ids))
            .distinct()
            .all()
        ]
        return db.query(models.User).filter(models.User.id.in_(lecturer_ids)).all()

    elif current_user.role == models.RoleEnum.lecturer:
        own_class_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        student_ids = [
            r[0] for r in db.query(models.Enrollment.student_id)
            .filter(models.Enrollment.class_id.in_(own_class_ids))
            .distinct()
            .all()
        ]
        return db.query(models.User).filter(models.User.id.in_(student_ids)).all()

    # Admin sees all users
    return db.query(models.User).all()


@users_router.get("/search", response_model=List[UserOut])
def search_contacts(
    q: str = FQuery(..., min_length=2),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Search messageable contacts by name, matric/staff number, or email."""
    pattern = f"%{q.lower()}%"

    if current_user.role == models.RoleEnum.student:
        enrolled_class_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id).all()
        ]
        lecturer_ids = [
            r[0] for r in db.query(models.Class.lecturer_id)
            .filter(models.Class.id.in_(enrolled_class_ids)).distinct().all()
        ]
        base = db.query(models.User).filter(models.User.id.in_(lecturer_ids))
    else:
        own_class_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id).all()
        ]
        student_ids = [
            r[0] for r in db.query(models.Enrollment.student_id)
            .filter(models.Enrollment.class_id.in_(own_class_ids)).distinct().all()
        ]
        base = db.query(models.User).filter(models.User.id.in_(student_ids))

    return base.filter(
        or_(
            func.lower(models.User.name).like(pattern),
            func.lower(models.User.email).like(pattern),
            func.lower(models.User.matric_number).like(pattern),
            func.lower(models.User.staff_number).like(pattern),
        )
    ).limit(15).all()


# ── Classes ──────────────────────────────────────────────────────────────────
classes_router = APIRouter(prefix="/api/classes", tags=["Classes"])


@classes_router.get("", response_model=List[ClassOut])
def list_classes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == models.RoleEnum.student:
        # Students see only their enrolled classes
        enrolled_class_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id)
            .all()
        ]
        return db.query(models.Class).filter(models.Class.id.in_(enrolled_class_ids)).all()

    if current_user.role == models.RoleEnum.lecturer:
        # Lecturers see only their own classes
        return db.query(models.Class).filter(models.Class.lecturer_id == current_user.id).all()

    # Admin sees all
    return db.query(models.Class).all()


@classes_router.get("/available", response_model=List[ClassAvailableOut])
def available_classes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Students see every class that matches their department AND level.
    Each result includes whether the student is already enrolled.
    """
    if current_user.role != models.RoleEnum.student:
        raise HTTPException(status_code=403, detail="Students only")

    if not current_user.department or not current_user.level:
        return []

    classes = (
        db.query(models.Class)
        .filter(
            models.Class.department == current_user.department,
            models.Class.level == current_user.level,
        )
        .all()
    )

    enrolled_ids = {
        e.class_id
        for e in db.query(models.Enrollment)
        .filter(models.Enrollment.student_id == current_user.id)
        .all()
    }

    result = []
    for c in classes:
        lecturer = db.query(models.User).filter(models.User.id == c.lecturer_id).first()
        result.append(
            ClassAvailableOut(
                id=c.id,
                name=c.name,
                subject=c.subject,
                course_code=c.course_code,
                department=c.department,
                level=c.level,
                academic_year=c.academic_year,
                lecturer_id=c.lecturer_id,
                lecturer_name=lecturer.name if lecturer else "Unknown",
                is_enrolled=c.id in enrolled_ids,
            )
        )
    return result


@classes_router.post("", response_model=ClassOut, status_code=201)
def create_class(
    payload: ClassCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    data = payload.model_dump()
    # Auto-fill department from the lecturer's profile if not provided
    if not data.get("department") and current_user.department:
        data["department"] = current_user.department
    class_ = models.Class(**data, lecturer_id=current_user.id)
    db.add(class_)
    db.commit()
    db.refresh(class_)
    return class_


@classes_router.get("/{class_id}", response_model=ClassOut)
def get_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")

    if current_user.role == models.RoleEnum.lecturer and class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if current_user.role == models.RoleEnum.student:
        enrollment = db.query(models.Enrollment).filter(
            models.Enrollment.student_id == current_user.id,
            models.Enrollment.class_id == class_id,
        ).first()
        if not enrollment:
            raise HTTPException(status_code=403, detail="Not enrolled in this class")

    return class_


@classes_router.delete("/{class_id}", status_code=204)
def delete_class(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")
    if current_user.role == models.RoleEnum.lecturer and class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(class_)
    db.commit()


# Student self-enrollment in a class
@classes_router.post("/{class_id}/enroll", status_code=201)
def self_enroll(
    class_id: int,
    payload: dict,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Student enrolls themselves into a class. Requires matric_number confirmation."""
    if current_user.role != models.RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only students can self-enroll")

    # Verify the student's identity with their matric number
    submitted_matric = payload.get("matric_number", "").strip().upper()
    if not submitted_matric:
        raise HTTPException(status_code=400, detail="Matric number is required to enroll")
    if submitted_matric != (current_user.matric_number or "").upper():
        raise HTTPException(status_code=400, detail="Matric number does not match your account")

    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")

    existing = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id,
        models.Enrollment.class_id == class_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Already enrolled in this class")

    # Auto-assign roll number
    count = db.query(models.Enrollment).filter(models.Enrollment.class_id == class_id).count()
    enrollment = models.Enrollment(
        student_id=current_user.id,
        class_id=class_id,
        roll_number=count + 1,
    )
    db.add(enrollment)
    db.flush()

    # ── Schedule conflict detection ───────────────────────────────────────────
    new_slots = db.query(models.Schedule).filter(models.Schedule.class_id == class_id).all()
    if new_slots:
        # Get slots from all other already-enrolled classes
        other_class_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(
                models.Enrollment.student_id == current_user.id,
                models.Enrollment.class_id != class_id,
            )
            .all()
        ]
        other_slots = db.query(models.Schedule).filter(
            models.Schedule.class_id.in_(other_class_ids)
        ).all()

        conflicts_found = []
        for ns in new_slots:
            for os_ in other_slots:
                if ns.day_of_week == os_.day_of_week and _times_overlap(
                    ns.start_time, ns.end_time, os_.start_time, os_.end_time
                ):
                    conflict_cls = db.query(models.Class).filter(models.Class.id == os_.class_id).first()
                    conflicts_found.append({
                        "day": ns.day_of_week,
                        "time": f"{_fmt_time(ns.start_time)}–{_fmt_time(ns.end_time)}",
                        "conflict_course": conflict_cls.name if conflict_cls else f"Class {os_.class_id}",
                    })

        if conflicts_found:
            c = conflicts_found[0]
            push(db, current_user.id, type="schedule",
                 title=f"Schedule conflict: {class_.name}",
                 body=f"{c['day']} {c['time']} overlaps with {c['conflict_course']}",
                 link="/student/schedule")
            background_tasks.add_task(
                send_schedule_conflict,
                current_user.email, current_user.name,
                class_.name, c["conflict_course"], c["day"], c["time"],
            )

    # ── Build schedule summary for welcome email ──────────────────────────────
    slot_strs = [
        f"{s.day_of_week} {_fmt_time(s.start_time)}–{_fmt_time(s.end_time)}"
        for s in new_slots
    ]

    # ── Notify student ────────────────────────────────────────────────────────
    push(db, current_user.id, type="enrollment",
         title=f"Enrolled in {class_.name}",
         body=f"You have successfully enrolled in {class_.name}. Your roll number is {enrollment.roll_number}.",
         link="/student/classes")

    # ── Notify lecturer ───────────────────────────────────────────────────────
    push(db, class_.lecturer_id, type="enrollment",
         title="New student enrolled",
         body=f"{current_user.name} enrolled in {class_.name}.",
         link="/students")

    db.commit()

    # Send schedule email if the course has time slots
    if slot_strs:
        background_tasks.add_task(
            send_schedule_added,
            current_user.email, current_user.name, class_.name, slot_strs,
        )

    return {"message": "Enrolled successfully", "class": class_.name, "roll_number": enrollment.roll_number}


@classes_router.delete("/{class_id}/unenroll", status_code=204)
def self_unenroll(
    class_id: int,
    matric_number: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Student removes themselves from a class. Requires matric_number as query param."""
    if current_user.role != models.RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only students can unenroll")

    if not matric_number or matric_number.strip().upper() != (current_user.matric_number or "").upper():
        raise HTTPException(status_code=400, detail="Matric number does not match your account")

    enrollment = db.query(models.Enrollment).filter(
        models.Enrollment.student_id == current_user.id,
        models.Enrollment.class_id == class_id,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Not enrolled in this class")

    db.delete(enrollment)
    db.commit()


# ── Attendance ────────────────────────────────────────────────────────────────
attendance_router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


@attendance_router.post("/", response_model=AttendanceOut, status_code=201)
def mark_attendance(
    payload: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    class_ = db.query(models.Class).filter(models.Class.id == payload.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

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
def mark_bulk_attendance(
    payload: AttendanceBulkCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    class_ = db.query(models.Class).filter(models.Class.id == payload.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

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
                status=rec["status"],
            ))
    db.commit()
    return {"message": f"{len(payload.records)} records saved"}


@attendance_router.get("/class/{class_id}", response_model=List[AttendanceOut])
def get_class_attendance(
    class_id: int,
    on_date: date = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    query = db.query(models.Attendance).filter(models.Attendance.class_id == class_id)
    if on_date:
        query = query.filter(models.Attendance.date == on_date)
    return query.all()


@attendance_router.get("/class/{class_id}/manual-history")
def get_manual_attendance_history(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """Manual (non-live) attendance records grouped by date, with student names."""
    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    records = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.class_id == class_id,
            models.Attendance.session_id == None,
        )
        .order_by(models.Attendance.date.desc())
        .all()
    )

    grouped: dict = {}
    for rec in records:
        d = str(rec.date)
        if d not in grouped:
            grouped[d] = {
                "date": d,
                "records": [],
                "present_count": 0,
                "late_count": 0,
                "absent_count": 0,
            }
        student = db.query(models.User).filter(models.User.id == rec.student_id).first()
        grouped[d]["records"].append({
            "student_id": rec.student_id,
            "name": student.name if student else "Unknown",
            "status": rec.status.value,
        })
        if rec.status == models.StatusEnum.present:
            grouped[d]["present_count"] += 1
        elif rec.status == models.StatusEnum.late:
            grouped[d]["late_count"] += 1
        else:
            grouped[d]["absent_count"] += 1

    result = sorted(grouped.values(), key=lambda x: x["date"], reverse=True)
    for r in result:
        r["total"] = len(r["records"])
    return result


@attendance_router.get("/student/{student_id}/rate")
def get_student_attendance_rate(
    student_id: int,
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Students can only view their own rate
    if current_user.role == models.RoleEnum.student and current_user.id != student_id:
        raise HTTPException(status_code=403, detail="Access denied")

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
def create_schedule(
    payload: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    class_ = db.query(models.Class).filter(models.Class.id == payload.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    schedule = models.Schedule(**payload.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@schedule_router.get("/", response_model=List[ScheduleOut])
def list_schedules(
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Schedule)

    if current_user.role == models.RoleEnum.student:
        # Only schedules for enrolled classes
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id)
            .all()
        ]
        query = query.filter(models.Schedule.class_id.in_(enrolled_ids))
    elif current_user.role == models.RoleEnum.lecturer:
        # Only schedules for own classes
        own_class_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        query = query.filter(models.Schedule.class_id.in_(own_class_ids))

    if class_id:
        query = query.filter(models.Schedule.class_id == class_id)

    return query.all()


@schedule_router.get("/today")
def todays_schedule(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today = datetime.now().strftime("%A")
    query = db.query(models.Schedule).filter(models.Schedule.day_of_week == today)

    if current_user.role == models.RoleEnum.student:
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id)
            .all()
        ]
        query = query.filter(models.Schedule.class_id.in_(enrolled_ids))
    elif current_user.role == models.RoleEnum.lecturer:
        own_class_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        query = query.filter(models.Schedule.class_id.in_(own_class_ids))

    return query.order_by(models.Schedule.start_time).all()


@schedule_router.post("/bulk", response_model=List[ScheduleOut], status_code=201)
def create_schedule_bulk(
    payload: ScheduleBulkCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    class_ = db.query(models.Class).filter(models.Class.id == payload.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if not payload.slots:
        raise HTTPException(status_code=400, detail="At least one slot is required")

    # Validate: end_time > start_time
    for slot in payload.slots:
        if slot.end_time <= slot.start_time:
            raise HTTPException(status_code=400, detail=f"End time must be after start time for {slot.day_of_week}")

    # Get all other slots owned by this lecturer (not this class)
    own_class_ids = [
        r[0] for r in db.query(models.Class.id)
        .filter(
            models.Class.lecturer_id == current_user.id,
            models.Class.id != payload.class_id,
        )
        .all()
    ]
    existing_slots = db.query(models.Schedule).filter(
        models.Schedule.class_id.in_(own_class_ids)
    ).all()

    created = []
    for slot in payload.slots:
        for ex in existing_slots:
            if ex.day_of_week == slot.day_of_week and _times_overlap(
                slot.start_time, slot.end_time, ex.start_time, ex.end_time
            ):
                conflict_cls = db.query(models.Class).filter(models.Class.id == ex.class_id).first()
                raise HTTPException(
                    status_code=409,
                    detail=f"Time conflict on {slot.day_of_week} {_fmt_time(slot.start_time)}–{_fmt_time(slot.end_time)} "
                           f"with {conflict_cls.name if conflict_cls else 'another class'}",
                )

        s = models.Schedule(
            class_id=payload.class_id,
            day_of_week=slot.day_of_week,
            start_time=slot.start_time,
            end_time=slot.end_time,
            room=slot.room,
        )
        db.add(s)
        created.append(s)

    db.flush()

    # Notify enrolled students of the new/updated schedule
    enrolled = db.query(models.Enrollment).filter(models.Enrollment.class_id == payload.class_id).all()
    slot_strs = [
        f"{s.day_of_week} {_fmt_time(s.start_time)}–{_fmt_time(s.end_time)}"
        for s in created
    ]
    for e in enrolled:
        student = db.query(models.User).filter(models.User.id == e.student_id).first()
        if student:
            push(db, student.id, type="schedule",
                 title=f"Schedule updated: {class_.name}",
                 body=", ".join(slot_strs),
                 link="/student/schedule")
            background_tasks.add_task(
                send_schedule_added, student.email, student.name, class_.name, slot_strs
            )

    db.commit()
    for s in created:
        db.refresh(s)
    return created


@schedule_router.get("/weekly", response_model=List[ScheduleWithClassOut])
def weekly_schedule(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == models.RoleEnum.student:
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id)
            .all()
        ]
        slots = db.query(models.Schedule).filter(models.Schedule.class_id.in_(enrolled_ids)).all()

        result = []
        for s in slots:
            class_ = db.query(models.Class).filter(models.Class.id == s.class_id).first()
            lecturer = db.query(models.User).filter(models.User.id == class_.lecturer_id).first() if class_ else None
            has_conflict = any(
                o.id != s.id and o.day_of_week == s.day_of_week and
                _times_overlap(s.start_time, s.end_time, o.start_time, o.end_time)
                for o in slots
            )
            result.append(ScheduleWithClassOut(
                id=s.id,
                class_id=s.class_id,
                class_name=class_.name if class_ else f"Class {s.class_id}",
                course_code=class_.course_code if class_ else None,
                day_of_week=s.day_of_week,
                start_time=s.start_time,
                end_time=s.end_time,
                room=s.room,
                lecturer_name=lecturer.name if lecturer else None,
                has_conflict=has_conflict,
                is_locked=s.is_locked or False,
            ))
        return result

    elif current_user.role == models.RoleEnum.lecturer:
        own_class_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        slots = db.query(models.Schedule).filter(models.Schedule.class_id.in_(own_class_ids)).all()
        result = []
        for s in slots:
            class_ = db.query(models.Class).filter(models.Class.id == s.class_id).first()
            result.append(ScheduleWithClassOut(
                id=s.id,
                class_id=s.class_id,
                class_name=class_.name if class_ else f"Class {s.class_id}",
                course_code=class_.course_code if class_ else None,
                day_of_week=s.day_of_week,
                start_time=s.start_time,
                end_time=s.end_time,
                room=s.room,
                has_conflict=False,
                is_locked=s.is_locked or False,
            ))
        return result
    return []


@schedule_router.post("/weekly-digest")
def send_weekly_digest(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Send this week's timetable as email + in-app notification.
    Lecturers: sends to themselves + all enrolled students.
    Students: sends only to themselves.
    Also auto-creates Lecture records for this week's slots."""
    monday, sunday = _get_week_bounds()
    week_label = f"{monday.strftime('%d %b')} – {sunday.strftime('%d %b %Y')}"
    notifications_sent = 0
    lectures_created = 0

    if current_user.role == models.RoleEnum.lecturer:
        own_class_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        my_slots = db.query(models.Schedule).filter(
            models.Schedule.class_id.in_(own_class_ids)
        ).all()

        # Auto-create this week's lecture records
        lectures_created = _ensure_week_lectures(db, my_slots, monday)
        db.commit()

        # Send digest to the lecturer
        my_rows = _build_rows(db, my_slots, monday, 'enrolled_count')
        push(db, current_user.id, type="schedule",
             title=f"Your teaching timetable: {week_label}",
             body=f"{len(my_rows)} class slot(s) this week",
             link="/schedule")
        notifications_sent += 1
        background_tasks.add_task(
            send_weekly_timetable,
            current_user.email, current_user.name, week_label, my_rows, 'lecturer',
        )

        # Send digest to every unique enrolled student
        sent_students: set[int] = set()
        for slot in my_slots:
            for e in db.query(models.Enrollment).filter(models.Enrollment.class_id == slot.class_id).all():
                if e.student_id in sent_students:
                    continue
                sent_students.add(e.student_id)
                student = db.query(models.User).filter(models.User.id == e.student_id).first()
                if not student:
                    continue

                # Build that student's full schedule (all their enrolled classes)
                stu_ids = {
                    en.class_id for en in db.query(models.Enrollment)
                    .filter(models.Enrollment.student_id == student.id).all()
                }
                stu_slots = db.query(models.Schedule).filter(
                    models.Schedule.class_id.in_(stu_ids)
                ).all()
                stu_rows = _build_rows(db, stu_slots, monday, 'lecturer_name')

                push(db, student.id, type="schedule",
                     title=f"Your timetable: {week_label}",
                     body=f"{len(stu_rows)} class slot(s) this week",
                     link="/student/schedule")
                notifications_sent += 1
                background_tasks.add_task(
                    send_weekly_timetable,
                    student.email, student.name, week_label, stu_rows, 'student',
                )

        db.commit()

    elif current_user.role == models.RoleEnum.student:
        stu_ids = {
            e.class_id for e in db.query(models.Enrollment)
            .filter(models.Enrollment.student_id == current_user.id).all()
        }
        stu_slots = db.query(models.Schedule).filter(
            models.Schedule.class_id.in_(stu_ids)
        ).all()
        stu_rows = _build_rows(db, stu_slots, monday, 'lecturer_name')

        push(db, current_user.id, type="schedule",
             title=f"Your timetable: {week_label}",
             body=f"{len(stu_rows)} class slot(s) this week",
             link="/student/schedule")
        notifications_sent += 1
        background_tasks.add_task(
            send_weekly_timetable,
            current_user.email, current_user.name, week_label, stu_rows, 'student',
        )
        db.commit()

    return {
        "week_label": week_label,
        "notifications_sent": notifications_sent,
        "lectures_created": lectures_created,
    }


@schedule_router.patch("/{schedule_id}/lock", response_model=ScheduleOut)
def toggle_lock(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    s = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    class_ = db.query(models.Class).filter(models.Class.id == s.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    s.is_locked = not (s.is_locked or False)
    db.commit()
    db.refresh(s)
    return s


@schedule_router.delete("/{schedule_id}", status_code=204)
def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    s = db.query(models.Schedule).filter(models.Schedule.id == schedule_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    class_ = db.query(models.Class).filter(models.Class.id == s.class_id).first()
    if class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if s.is_locked:
        raise HTTPException(status_code=409, detail="Unlock this slot before deleting it")
    db.delete(s)
    db.commit()


# ── Exams ─────────────────────────────────────────────────────────────────────
exams_router = APIRouter(prefix="/api/exams", tags=["Exams"])


@exams_router.post("/", response_model=ExamOut, status_code=201)
def create_exam(
    payload: ExamCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    class_ = db.query(models.Class).filter(models.Class.id == payload.class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    exam = models.Exam(**payload.model_dump(), created_by=current_user.id)
    db.add(exam)
    db.commit()
    db.refresh(exam)
    return exam


@exams_router.get("/", response_model=List[ExamOut])
def list_exams(
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Exam)

    if current_user.role == models.RoleEnum.student:
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id)
            .all()
        ]
        query = query.filter(models.Exam.class_id.in_(enrolled_ids))
    elif current_user.role == models.RoleEnum.lecturer:
        own_class_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        query = query.filter(models.Exam.class_id.in_(own_class_ids))

    if class_id:
        query = query.filter(models.Exam.class_id == class_id)

    return query.all()


@exams_router.post("/results", response_model=ExamResultOut, status_code=201)
def add_result(
    payload: ExamResultCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    exam = db.query(models.Exam).filter(models.Exam.id == payload.exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    class_ = db.query(models.Class).filter(models.Class.id == exam.class_id).first()
    if class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = models.ExamResult(**payload.model_dump())
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


@exams_router.patch("/results/{result_id}/publish")
def publish_result(
    result_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    result = db.query(models.ExamResult).filter(models.ExamResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    result.published = True
    db.commit()
    return {"message": "Result published"}


@exams_router.get("/{exam_id}/results", response_model=List[ExamResultOut])
def get_exam_results(
    exam_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    exam = db.query(models.Exam).filter(models.Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    query = db.query(models.ExamResult).filter(models.ExamResult.exam_id == exam_id)
    if current_user.role == models.RoleEnum.student:
        # Students see only their own result (if published)
        query = query.filter(
            models.ExamResult.student_id == current_user.id,
            models.ExamResult.published == True,
        )
    return query.all()


# ── Messages ──────────────────────────────────────────────────────────────────
messages_router = APIRouter(prefix="/api/messages", tags=["Messages"])


@messages_router.get("/threads", response_model=List[MessageThreadOut])
def get_threads(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Returns one entry per conversation partner, ordered by most recent message.
    Only users you've actually exchanged messages with appear here.
    """
    me = current_user.id

    sent_to = {r[0] for r in db.query(models.Message.recipient_id)
               .filter(models.Message.sender_id == me).all()}
    received_from = {r[0] for r in db.query(models.Message.sender_id)
                     .filter(models.Message.recipient_id == me).all()}
    partner_ids = sent_to | received_from

    threads = []
    for pid in partner_ids:
        partner = db.query(models.User).filter(models.User.id == pid).first()
        if not partner:
            continue

        last_msg = db.query(models.Message).filter(
            or_(
                and_(models.Message.sender_id == me, models.Message.recipient_id == pid),
                and_(models.Message.sender_id == pid, models.Message.recipient_id == me),
            )
        ).order_by(models.Message.sent_at.desc()).first()

        unread = db.query(models.Message).filter(
            models.Message.sender_id == pid,
            models.Message.recipient_id == me,
            models.Message.read_at == None,
        ).count()

        threads.append(MessageThreadOut(
            contact_id=partner.id,
            contact_name=partner.name,
            contact_email=partner.email,
            contact_role=partner.role.value,
            matric_number=partner.matric_number,
            staff_number=partner.staff_number,
            department=partner.department,
            last_message_body=last_msg.body if last_msg else None,
            last_message_at=last_msg.sent_at if last_msg else None,
            last_message_sender_id=last_msg.sender_id if last_msg else None,
            unread_count=unread,
        ))

    threads.sort(key=lambda t: t.last_message_at or datetime.min, reverse=True)
    return threads


@messages_router.post("/", response_model=MessageOut, status_code=201)
def send_message(
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    msg = models.Message(**payload.model_dump(), sender_id=current_user.id)
    db.add(msg)
    db.flush()
    recipient = db.query(models.User).filter(models.User.id == payload.recipient_id).first()
    notif_link = (
        f"/student/messages?open={current_user.id}"
        if (recipient and recipient.role == models.RoleEnum.student)
        else f"/messages?open={current_user.id}"
    )
    push(
        db, payload.recipient_id,
        type="message",
        title=f"New message from {current_user.name}",
        body=payload.subject or (payload.body[:80] + "…" if len(payload.body) > 80 else payload.body),
        link=notif_link,
    )
    db.commit()
    db.refresh(msg)
    push_message_ws(payload.recipient_id, {"type": "message", "message": jsonable_encoder(MessageOut.model_validate(msg))})
    return msg


@messages_router.get("/inbox")
def get_inbox(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Message).filter(
        models.Message.recipient_id == current_user.id
    ).order_by(models.Message.sent_at.desc()).all()


@messages_router.get("/sent")
def get_sent(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return db.query(models.Message).filter(
        models.Message.sender_id == current_user.id
    ).order_by(models.Message.sent_at.desc()).all()


@messages_router.get("/conversation/{user_id}", response_model=List[MessageOut])
def get_conversation(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """All messages between current user and another user, chronological."""
    msgs = db.query(models.Message).filter(
        or_(
            and_(models.Message.sender_id == current_user.id, models.Message.recipient_id == user_id),
            and_(models.Message.sender_id == user_id, models.Message.recipient_id == current_user.id),
        )
    ).order_by(models.Message.sent_at.asc()).all()
    return msgs


@messages_router.patch("/{message_id}/read")
def mark_read(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    msg.read_at = datetime.utcnow()
    db.commit()
    db.refresh(msg)
    push_message_ws(msg.sender_id, {"type": "read", "message_id": msg.id, "read_at": msg.read_at.isoformat()})
    return {"message": "Marked as read"}


@messages_router.post("/{message_id}/react", response_model=MessageOut)
def react_to_message(
    message_id: int,
    emoji: str = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.id and msg.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    existing = db.query(models.MessageReaction).filter(
        models.MessageReaction.message_id == message_id,
        models.MessageReaction.user_id == current_user.id,
    ).first()
    if existing:
        existing.emoji = emoji
    else:
        db.add(models.MessageReaction(message_id=message_id, user_id=current_user.id, emoji=emoji))
    db.commit()
    db.refresh(msg)
    return msg


@messages_router.delete("/{message_id}/react", response_model=MessageOut)
def remove_reaction(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    db.query(models.MessageReaction).filter(
        models.MessageReaction.message_id == message_id,
        models.MessageReaction.user_id == current_user.id,
    ).delete()
    db.commit()
    db.refresh(msg)
    return msg


@messages_router.patch("/{message_id}/pin", response_model=MessageOut)
def toggle_pin(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.id and msg.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    msg.is_pinned = not msg.is_pinned
    db.commit()
    db.refresh(msg)
    return msg


@messages_router.delete("/{message_id}", status_code=204)
def delete_message(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own messages")
    recipient_id = msg.recipient_id
    if msg.attachment_path:
        path = os.path.join(MSG_UPLOAD_DIR, msg.attachment_path)
        if os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                pass
    db.query(models.MessageReaction).filter(models.MessageReaction.message_id == message_id).delete()
    db.delete(msg)
    db.commit()
    push_message_ws(recipient_id, {"type": "message_deleted", "message_id": message_id})


@messages_router.post("/forward", response_model=MessageOut, status_code=201)
def forward_message(
    original_message_id: int = Form(...),
    recipient_id: int = Form(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    original = db.query(models.Message).filter(models.Message.id == original_message_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Original message not found")
    if original.sender_id != current_user.id and original.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    fwd = models.Message(
        sender_id=current_user.id,
        recipient_id=recipient_id,
        body=original.body,
        subject=original.subject,
        forwarded_from_id=original.id,
        attachment_path=original.attachment_path,
        attachment_name=original.attachment_name,
        attachment_type=original.attachment_type,
        attachment_size=original.attachment_size,
    )
    db.add(fwd)
    db.flush()
    recipient = db.query(models.User).filter(models.User.id == recipient_id).first()
    notif_link = (
        f"/student/messages?open={current_user.id}"
        if (recipient and recipient.role == models.RoleEnum.student)
        else f"/messages?open={current_user.id}"
    )
    push(db, recipient_id, type="message",
         title=f"Forwarded message from {current_user.name}",
         body=original.body[:80] + "…" if len(original.body) > 80 else original.body,
         link=notif_link)
    db.commit()
    db.refresh(fwd)
    push_message_ws(recipient_id, {"type": "message", "message": jsonable_encoder(MessageOut.model_validate(fwd))})
    return fwd


@messages_router.post("/with-attachment", response_model=MessageOut, status_code=201)
async def send_with_attachment(
    recipient_id: int = Form(...),
    body: str = Form(""),
    subject: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    stored = f"{uuid.uuid4()}{ext}"
    dest = os.path.join(MSG_UPLOAD_DIR, stored)
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 15 MB)")
    with open(dest, "wb") as f:
        f.write(content)
    # Fallback MIME type detection when browser omits Content-Type for the part
    content_type = file.content_type or ""
    if not content_type.startswith("audio/") and (file.filename or "").startswith("voice_"):
        _ext_map = {".webm": "audio/webm", ".ogg": "audio/ogg", ".m4a": "audio/mp4", ".mp4": "audio/mp4"}
        content_type = _ext_map.get(ext, "audio/webm")
    msg = models.Message(
        sender_id=current_user.id,
        recipient_id=recipient_id,
        body=body or (f"🎤 Voice note" if content_type.startswith("audio/") else f"📎 {file.filename}"),
        subject=subject,
        attachment_path=stored,
        attachment_name=file.filename,
        attachment_type=content_type or file.content_type or "application/octet-stream",
        attachment_size=len(content),
    )
    db.add(msg)
    db.flush()
    recipient = db.query(models.User).filter(models.User.id == recipient_id).first()
    notif_link = (
        f"/student/messages?open={current_user.id}"
        if (recipient and recipient.role == models.RoleEnum.student)
        else f"/messages?open={current_user.id}"
    )
    push(db, recipient_id, type="message",
         title=f"New message from {current_user.name}",
         body=f"📎 {file.filename}",
         link=notif_link)
    db.commit()
    db.refresh(msg)
    push_message_ws(recipient_id, {"type": "message", "message": jsonable_encoder(MessageOut.model_validate(msg))})
    return msg


@messages_router.get("/attachment/{message_id}")
def download_attachment(
    message_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    msg = db.query(models.Message).filter(models.Message.id == message_id).first()
    if not msg or not msg.attachment_path:
        raise HTTPException(status_code=404, detail="Attachment not found")
    if msg.sender_id != current_user.id and msg.recipient_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    path = os.path.join(MSG_UPLOAD_DIR, msg.attachment_path)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found on server")
    return FileResponse(
        path,
        media_type=msg.attachment_type or "application/octet-stream",
        filename=msg.attachment_name or msg.attachment_path,
    )


# ── Announcements ─────────────────────────────────────────────────────────────
announcements_router = APIRouter(prefix="/api/announcements", tags=["Announcements"])


@announcements_router.post("/", response_model=AnnouncementOut, status_code=201)
def create_announcement(
    payload: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    if payload.class_id:
        class_ = db.query(models.Class).filter(models.Class.id == payload.class_id).first()
        if not class_ or class_.lecturer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    ann = models.Announcement(**payload.model_dump(), created_by=current_user.id)
    db.add(ann)
    db.flush()

    # Notify enrolled students (or all students for school-wide)
    if payload.class_id:
        enrollments = db.query(models.Enrollment).filter(
            models.Enrollment.class_id == payload.class_id
        ).all()
        student_ids = [e.student_id for e in enrollments]
    else:
        student_ids = [
            u.id for u in db.query(models.User).filter(
                models.User.role == models.RoleEnum.student
            ).all()
        ]
    for sid in student_ids:
        push(db, sid, type="announcement", title=ann.title,
             body=ann.body[:100] if ann.body else None, link="/student/overview")

    db.commit()
    db.refresh(ann)
    return ann


@announcements_router.get("/", response_model=List[AnnouncementOut])
def list_announcements(
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Announcement)

    if current_user.role == models.RoleEnum.student:
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id)
            .all()
        ]
        query = query.filter(
            (models.Announcement.class_id == None) |
            (models.Announcement.class_id.in_(enrolled_ids))
        )
    elif current_user.role == models.RoleEnum.lecturer:
        own_class_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        query = query.filter(
            (models.Announcement.class_id == None) |
            (models.Announcement.class_id.in_(own_class_ids))
        )

    if class_id:
        query = query.filter(models.Announcement.class_id == class_id)

    return query.order_by(models.Announcement.created_at.desc()).all()


# ── Analytics / Dashboard ─────────────────────────────────────────────────────
analytics_router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@analytics_router.get("/dashboard", response_model=DashboardStats)
def dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    today = date.today()
    day_name = datetime.now().strftime("%A")

    if current_user.role == models.RoleEnum.lecturer:
        # Scoped to lecturer's own classes
        own_class_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        enrolled_student_ids = [
            r[0] for r in db.query(models.Enrollment.student_id)
            .filter(models.Enrollment.class_id.in_(own_class_ids))
            .distinct()
            .all()
        ]
        total_students = db.query(models.User).filter(
            models.User.id.in_(enrolled_student_ids)
        ).count()
        classes_today = db.query(models.Schedule).filter(
            models.Schedule.day_of_week == day_name,
            models.Schedule.class_id.in_(own_class_ids),
        ).count()
        pending_assignments = db.query(models.Submission).filter(
            models.Submission.status == models.SubmissionStatusEnum.pending,
            models.Submission.assignment.has(
                models.Assignment.class_id.in_(own_class_ids)
            ),
        ).count()
        total_att = db.query(models.Attendance).filter(
            models.Attendance.date == today,
            models.Attendance.class_id.in_(own_class_ids),
        ).count()
        present_att = db.query(models.Attendance).filter(
            models.Attendance.date == today,
            models.Attendance.class_id.in_(own_class_ids),
            models.Attendance.status == models.StatusEnum.present,
        ).count()
    else:
        # Admin sees everything
        total_students = db.query(models.User).filter(
            models.User.role == models.RoleEnum.student
        ).count()
        classes_today = db.query(models.Schedule).filter(
            models.Schedule.day_of_week == day_name
        ).count()
        pending_assignments = db.query(models.Submission).filter(
            models.Submission.status == models.SubmissionStatusEnum.pending
        ).count()
        total_att = db.query(models.Attendance).filter(models.Attendance.date == today).count()
        present_att = db.query(models.Attendance).filter(
            models.Attendance.date == today,
            models.Attendance.status == models.StatusEnum.present,
        ).count()

    attendance_rate = round((present_att / total_att * 100), 1) if total_att > 0 else 0.0

    return DashboardStats(
        total_students=total_students,
        classes_this_week=classes_today,
        pending_assignments=pending_assignments,
        attendance_rate=attendance_rate,
    )


@analytics_router.get("/student")
def student_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Detailed analytics for the logged-in student."""
    sid = current_user.id

    # Attendance
    total_att = db.query(models.Attendance).filter(models.Attendance.student_id == sid).count()
    present_att = db.query(models.Attendance).filter(
        models.Attendance.student_id == sid,
        models.Attendance.status == models.StatusEnum.present,
    ).count()
    attendance_rate = round((present_att / total_att * 100), 1) if total_att > 0 else 0.0

    # Assignments
    total_submissions = db.query(models.Submission).filter(models.Submission.student_id == sid).count()
    submitted = db.query(models.Submission).filter(
        models.Submission.student_id == sid,
        models.Submission.status == models.SubmissionStatusEnum.submitted,
    ).count()
    graded = db.query(models.Submission).filter(
        models.Submission.student_id == sid,
        models.Submission.status == models.SubmissionStatusEnum.graded,
    ).count()

    # Average score across graded submissions
    scores = db.query(models.Submission.score).filter(
        models.Submission.student_id == sid,
        models.Submission.status == models.SubmissionStatusEnum.graded,
        models.Submission.score.isnot(None),
    ).all()
    avg_score = round(sum(s[0] for s in scores) / len(scores), 1) if scores else None

    # Enrolled classes
    enrolled_count = db.query(models.Enrollment).filter(models.Enrollment.student_id == sid).count()

    # Exam results
    exam_results = db.query(models.ExamResult).filter(
        models.ExamResult.student_id == sid,
        models.ExamResult.published == True,
    ).all()

    # Per-class performance (attendance rate per class)
    enrolled_class_ids = [
        e.class_id for e in db.query(models.Enrollment).filter(models.Enrollment.student_id == sid).all()
    ]
    class_stats = []
    for cid in enrolled_class_ids:
        cls = db.query(models.Class).filter(models.Class.id == cid).first()
        if not cls:
            continue
        t = db.query(models.Attendance).filter(
            models.Attendance.student_id == sid,
            models.Attendance.class_id == cid,
        ).count()
        p = db.query(models.Attendance).filter(
            models.Attendance.student_id == sid,
            models.Attendance.class_id == cid,
            models.Attendance.status == models.StatusEnum.present,
        ).count()
        rate = round((p / t * 100), 1) if t > 0 else 0.0
        class_stats.append({
            "class_id": cid,
            "class_name": cls.name,
            "subject": cls.subject,
            "course_code": cls.course_code,
            "attendance_rate": rate,
            "classes_attended": p,
            "total_classes": t,
        })

    return {
        "attendance_rate": attendance_rate,
        "classes_attended": present_att,
        "total_classes": total_att,
        "enrolled_courses": enrolled_count,
        "assignments_submitted": submitted + graded,
        "assignments_graded": graded,
        "average_score": avg_score,
        "exam_results": [
            {"exam_id": r.exam_id, "score": r.score, "grade": r.grade}
            for r in exam_results
        ],
        "class_stats": class_stats,
    }


@analytics_router.get("/lecturer")
def lecturer_analytics(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """Aggregated analytics for the logged-in lecturer's classes."""
    own_class_ids = [
        r[0] for r in db.query(models.Class.id)
        .filter(models.Class.lecturer_id == current_user.id)
        .all()
    ]

    if not own_class_ids:
        return {
            "total_students": 0, "total_classes": 0,
            "total_live_sessions": 0, "overall_attendance_rate": 0.0,
            "pending_grading": 0, "classes": [],
        }

    total_students = (
        db.query(models.Enrollment.student_id)
        .filter(models.Enrollment.class_id.in_(own_class_ids))
        .distinct().count()
    )

    pending_grading = db.query(models.Submission).filter(
        models.Submission.status == models.SubmissionStatusEnum.pending,
        models.Submission.assignment.has(
            models.Assignment.class_id.in_(own_class_ids)
        ),
    ).count()

    total_live_sessions = db.query(models.LiveSession).filter(
        models.LiveSession.class_id.in_(own_class_ids),
        models.LiveSession.status == models.LiveSessionStatusEnum.ended,
    ).count()

    all_att = db.query(models.Attendance).filter(
        models.Attendance.class_id.in_(own_class_ids)
    ).all()
    all_present = sum(1 for a in all_att if a.status == models.StatusEnum.present)
    overall_att_rate = round(all_present / len(all_att) * 100, 1) if all_att else 0.0

    classes_data = []
    for cid in own_class_ids:
        cls = db.query(models.Class).filter(models.Class.id == cid).first()
        if not cls:
            continue

        enrollment_count = db.query(models.Enrollment).filter(
            models.Enrollment.class_id == cid
        ).count()

        att_rows = db.query(models.Attendance).filter(
            models.Attendance.class_id == cid
        ).all()
        att_total = len(att_rows)
        att_present = sum(1 for a in att_rows if a.status == models.StatusEnum.present)
        attendance_rate = round(att_present / att_total * 100, 1) if att_total > 0 else 0.0

        live_session_count = db.query(models.LiveSession).filter(
            models.LiveSession.class_id == cid,
            models.LiveSession.status == models.LiveSessionStatusEnum.ended,
        ).count()

        live_att_rows = db.query(models.Attendance).filter(
            models.Attendance.class_id == cid,
            models.Attendance.session_id.isnot(None),
            models.Attendance.score.isnot(None),
        ).all()
        live_att_rate = round(
            sum(a.score for a in live_att_rows) / len(live_att_rows), 1
        ) if live_att_rows else 0.0

        assign_ids = [
            r[0] for r in db.query(models.Assignment.id)
            .filter(models.Assignment.class_id == cid).all()
        ]
        assignments_total = len(assign_ids)
        if assign_ids:
            subs_received = db.query(models.Submission).filter(
                models.Submission.assignment_id.in_(assign_ids),
                models.Submission.status != models.SubmissionStatusEnum.pending,
            ).count()
            expected = assignments_total * enrollment_count
            submission_rate = round(subs_received / expected * 100, 1) if expected > 0 else 0.0
            score_rows = db.query(models.Submission.score).filter(
                models.Submission.assignment_id.in_(assign_ids),
                models.Submission.status == models.SubmissionStatusEnum.graded,
                models.Submission.score.isnot(None),
            ).all()
            avg_assignment_score = round(sum(s[0] for s in score_rows) / len(score_rows), 1) if score_rows else None
        else:
            subs_received = 0
            submission_rate = 0.0
            avg_assignment_score = None

        quiz_ids = [
            r[0] for r in db.query(models.Quiz.id)
            .filter(models.Quiz.class_id == cid).all()
        ]
        quiz_count = len(quiz_ids)
        if quiz_ids:
            attempts = db.query(models.QuizAttempt).filter(
                models.QuizAttempt.quiz_id.in_(quiz_ids),
                models.QuizAttempt.submitted_at.isnot(None),
            ).all()
            quiz_attempts = len(attempts)
            scored = [a for a in attempts if a.score is not None and a.total]
            quiz_avg_score = round(
                sum(a.score / a.total * 100 for a in scored) / len(scored), 1
            ) if scored else None
        else:
            quiz_attempts = 0
            quiz_avg_score = None

        classes_data.append({
            "class_id": cid,
            "class_name": cls.name,
            "course_code": cls.course_code,
            "enrollment_count": enrollment_count,
            "attendance_rate": attendance_rate,
            "live_session_count": live_session_count,
            "live_attendance_rate": live_att_rate,
            "assignments_total": assignments_total,
            "assignments_submitted": subs_received,
            "submission_rate": submission_rate,
            "avg_assignment_score": avg_assignment_score,
            "quiz_count": quiz_count,
            "quiz_attempts": quiz_attempts,
            "quiz_avg_score": quiz_avg_score,
        })

    return {
        "total_students": total_students,
        "total_classes": len(own_class_ids),
        "total_live_sessions": total_live_sessions,
        "overall_attendance_rate": overall_att_rate,
        "pending_grading": pending_grading,
        "classes": classes_data,
    }


# ── Reports ───────────────────────────────────────────────────────────────────
reports_router = APIRouter(prefix="/api/reports", tags=["Reports"])


def _fmt_date(dt) -> str:
    if dt is None:
        return datetime.now().strftime("%B %d, %Y")
    if isinstance(dt, datetime):
        return dt.strftime("%B %d, %Y")
    if isinstance(dt, date):
        return datetime.combine(dt, datetime.min.time()).strftime("%B %d, %Y")
    return str(dt)


def _est_size(rows: int, cols: int = 5) -> str:
    b = rows * cols * 16 + 200
    if b < 1024:
        return f"{b} B"
    if b < 1024 * 1024:
        return f"{round(b / 1024, 1)} KB"
    return f"{round(b / (1024 * 1024), 1)} MB"


@reports_router.get("/summary")
def reports_summary(
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    own_class_ids = [
        r[0] for r in db.query(models.Class.id)
        .filter(models.Class.lecturer_id == current_user.id).all()
    ]

    # When a specific class is requested, verify ownership then scope to it
    if class_id is not None:
        if class_id not in own_class_ids:
            raise HTTPException(403, "Access denied")
        target_ids = [class_id]
        scope_label = db.query(models.Class.name).filter(models.Class.id == class_id).scalar() or "selected class"
    else:
        target_ids = own_class_ids
        scope_label = "all your classes"

    total_students = (
        db.query(models.Enrollment.student_id)
        .filter(models.Enrollment.class_id.in_(target_ids))
        .distinct().count()
    ) if target_ids else 0

    result = []

    # 1. Attendance Report
    att_q = db.query(models.Attendance).filter(
        models.Attendance.class_id.in_(target_ids)
    ) if target_ids else None
    att_count = att_q.count() if att_q else 0
    last_att = att_q.order_by(models.Attendance.date.desc()).first() if att_q else None
    result.append({
        "id": "attendance",
        "title": "Attendance Report",
        "description": f"Student attendance records for {scope_label}",
        "date": _fmt_date(last_att.date if last_att else None),
        "students": total_students,
        "file_size": _est_size(att_count, 5),
    })

    # 2. Assignment Completion Report
    assign_ids = [
        r[0] for r in db.query(models.Assignment.id)
        .filter(models.Assignment.class_id.in_(target_ids)).all()
    ] if target_ids else []
    sub_q = db.query(models.Submission).filter(
        models.Submission.assignment_id.in_(assign_ids)
    ) if assign_ids else None
    sub_count = sub_q.count() if sub_q else 0
    last_sub = sub_q.order_by(models.Submission.submitted_at.desc()).first() if sub_q else None
    result.append({
        "id": "assignments",
        "title": "Assignment Completion Report",
        "description": f"Assignment submissions and scores for {scope_label}",
        "date": _fmt_date(last_sub.submitted_at if last_sub else None),
        "students": total_students,
        "file_size": _est_size(sub_count, 6),
    })

    # 3. Quiz Performance Report
    quiz_ids = [
        r[0] for r in db.query(models.Quiz.id)
        .filter(models.Quiz.class_id.in_(target_ids)).all()
    ] if target_ids else []
    att_q2 = db.query(models.QuizAttempt).filter(
        models.QuizAttempt.quiz_id.in_(quiz_ids),
        models.QuizAttempt.submitted_at.isnot(None),
    ) if quiz_ids else None
    attempt_count = att_q2.count() if att_q2 else 0
    last_attempt = att_q2.order_by(models.QuizAttempt.submitted_at.desc()).first() if att_q2 else None
    result.append({
        "id": "quizzes",
        "title": "Quiz Performance Report",
        "description": f"Quiz attempt scores and performance metrics for {scope_label}",
        "date": _fmt_date(last_attempt.submitted_at if last_attempt else None),
        "students": total_students,
        "file_size": _est_size(attempt_count, 6),
    })

    # 4. Class Progress Report
    result.append({
        "id": "class_progress",
        "title": "Class Progress Report",
        "description": f"Combined per-student summary for {scope_label}",
        "date": _fmt_date(None),
        "students": total_students,
        "file_size": _est_size(total_students, 8),
    })

    # 5. Live Session Attendance Report
    sess_q = db.query(models.LiveSession).filter(
        models.LiveSession.class_id.in_(target_ids),
        models.LiveSession.status == models.LiveSessionStatusEnum.ended,
    ) if target_ids else None
    session_count = sess_q.count() if sess_q else 0
    last_session = sess_q.order_by(models.LiveSession.started_at.desc()).first() if sess_q else None
    live_att_count = db.query(models.Attendance).filter(
        models.Attendance.class_id.in_(target_ids),
        models.Attendance.session_id.isnot(None),
    ).count() if target_ids else 0
    result.append({
        "id": "live_sessions",
        "title": "Live Session Attendance Report",
        "description": f"Cookie-based attendance for {session_count} live session{'s' if session_count != 1 else ''} in {scope_label}",
        "date": _fmt_date(last_session.started_at if last_session else None),
        "students": total_students,
        "file_size": _est_size(live_att_count, 6),
    })

    # 6. Student Enrollment Report
    enroll_q = db.query(models.Enrollment).filter(
        models.Enrollment.class_id.in_(target_ids)
    ) if target_ids else None
    enrollment_count = enroll_q.count() if enroll_q else 0
    last_enroll = enroll_q.order_by(models.Enrollment.enrolled_at.desc()).first() if enroll_q else None
    result.append({
        "id": "enrollments",
        "title": "Student Enrollment Report",
        "description": f"Enrollment list with roll numbers and grades for {scope_label}",
        "date": _fmt_date(last_enroll.enrolled_at if last_enroll else None),
        "students": total_students,
        "file_size": _est_size(enrollment_count, 6),
    })

    return result


@reports_router.get("/download/{report_id}")
def download_report(
    report_id: str,
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    own_class_ids = [
        r[0] for r in db.query(models.Class.id)
        .filter(models.Class.lecturer_id == current_user.id).all()
    ]

    if class_id is not None:
        if class_id not in own_class_ids:
            raise HTTPException(403, "Access denied")
        target_ids = [class_id]
    else:
        target_ids = own_class_ids

    buf = io.StringIO()
    writer = csv.writer(buf)

    if report_id == "attendance":
        writer.writerow(["Student Name", "Matric Number", "Class", "Date", "Status"])
        rows = db.query(models.Attendance).filter(
            models.Attendance.class_id.in_(target_ids)
        ).order_by(models.Attendance.date.desc()).all()
        for r in rows:
            student = db.query(models.User).filter(models.User.id == r.student_id).first()
            cls = db.query(models.Class).filter(models.Class.id == r.class_id).first()
            writer.writerow([
                student.name if student else "",
                student.matric_number if student else "",
                cls.name if cls else "",
                str(r.date),
                r.status.value,
            ])

    elif report_id == "assignments":
        writer.writerow(["Student Name", "Matric Number", "Class", "Assignment", "Status", "Score", "Submitted At"])
        for cid in target_ids:
            cls = db.query(models.Class).filter(models.Class.id == cid).first()
            aids = [r[0] for r in db.query(models.Assignment.id).filter(models.Assignment.class_id == cid).all()]
            for aid in aids:
                assignment = db.query(models.Assignment).filter(models.Assignment.id == aid).first()
                for s in db.query(models.Submission).filter(models.Submission.assignment_id == aid).all():
                    student = db.query(models.User).filter(models.User.id == s.student_id).first()
                    writer.writerow([
                        student.name if student else "",
                        student.matric_number if student else "",
                        cls.name if cls else "",
                        assignment.title if assignment else "",
                        s.status.value,
                        s.score if s.score is not None else "",
                        str(s.submitted_at) if s.submitted_at else "",
                    ])

    elif report_id == "quizzes":
        writer.writerow(["Student Name", "Matric Number", "Class", "Quiz", "Score", "Total", "Percentage", "Submitted At"])
        for cid in target_ids:
            cls = db.query(models.Class).filter(models.Class.id == cid).first()
            qids = [r[0] for r in db.query(models.Quiz.id).filter(models.Quiz.class_id == cid).all()]
            for qid in qids:
                quiz = db.query(models.Quiz).filter(models.Quiz.id == qid).first()
                for a in db.query(models.QuizAttempt).filter(
                    models.QuizAttempt.quiz_id == qid,
                    models.QuizAttempt.submitted_at.isnot(None),
                ).all():
                    student = db.query(models.User).filter(models.User.id == a.student_id).first()
                    pct = round(a.score / a.total * 100, 1) if a.score is not None and a.total else ""
                    writer.writerow([
                        student.name if student else "",
                        student.matric_number if student else "",
                        cls.name if cls else "",
                        quiz.title if quiz else "",
                        a.score if a.score is not None else "",
                        a.total if a.total else "",
                        pct,
                        str(a.submitted_at) if a.submitted_at else "",
                    ])

    elif report_id == "class_progress":
        writer.writerow(["Student Name", "Matric Number", "Class", "Attendance %", "Sessions Attended", "Total Sessions", "Assignments Submitted", "Avg Assignment Score", "Quiz Avg Score"])
        for cid in target_ids:
            cls = db.query(models.Class).filter(models.Class.id == cid).first()
            aids = [r[0] for r in db.query(models.Assignment.id).filter(models.Assignment.class_id == cid).all()]
            qids = [r[0] for r in db.query(models.Quiz.id).filter(models.Quiz.class_id == cid).all()]
            for e in db.query(models.Enrollment).filter(models.Enrollment.class_id == cid).all():
                student = db.query(models.User).filter(models.User.id == e.student_id).first()
                att = db.query(models.Attendance).filter(
                    models.Attendance.student_id == e.student_id,
                    models.Attendance.class_id == cid,
                ).all()
                att_total = len(att)
                att_present = sum(1 for a in att if a.status == models.StatusEnum.present)
                att_rate = round(att_present / att_total * 100, 1) if att_total else 0.0
                subs = db.query(models.Submission).filter(
                    models.Submission.assignment_id.in_(aids),
                    models.Submission.student_id == e.student_id,
                    models.Submission.status != models.SubmissionStatusEnum.pending,
                ).all() if aids else []
                graded = [s for s in subs if s.score is not None]
                assign_avg = round(sum(s.score for s in graded) / len(graded), 1) if graded else ""
                attempts = db.query(models.QuizAttempt).filter(
                    models.QuizAttempt.quiz_id.in_(qids),
                    models.QuizAttempt.student_id == e.student_id,
                    models.QuizAttempt.submitted_at.isnot(None),
                ).all() if qids else []
                scored = [a for a in attempts if a.score is not None and a.total]
                quiz_avg = round(sum(a.score / a.total * 100 for a in scored) / len(scored), 1) if scored else ""
                writer.writerow([
                    student.name if student else "",
                    student.matric_number if student else "",
                    cls.name if cls else "",
                    att_rate, att_present, att_total,
                    len(subs), assign_avg, quiz_avg,
                ])

    elif report_id == "live_sessions":
        writer.writerow(["Student Name", "Matric Number", "Class", "Session Date", "Cookies Clicked", "Total Cookies", "Score", "Status"])
        for r in db.query(models.Attendance).filter(
            models.Attendance.class_id.in_(target_ids),
            models.Attendance.session_id.isnot(None),
        ).order_by(models.Attendance.date.desc()).all():
            student = db.query(models.User).filter(models.User.id == r.student_id).first()
            cls = db.query(models.Class).filter(models.Class.id == r.class_id).first()
            total_cookies = db.query(models.AttendanceCookie).filter(
                models.AttendanceCookie.session_id == r.session_id
            ).count()
            clicked = db.query(models.CookieResponse).join(
                models.AttendanceCookie,
                models.CookieResponse.cookie_id == models.AttendanceCookie.id,
            ).filter(
                models.AttendanceCookie.session_id == r.session_id,
                models.CookieResponse.student_id == r.student_id,
                models.CookieResponse.is_valid == True,
            ).count()
            writer.writerow([
                student.name if student else "",
                student.matric_number if student else "",
                cls.name if cls else "",
                str(r.date),
                clicked, total_cookies,
                r.score if r.score is not None else "",
                r.status.value,
            ])

    elif report_id == "enrollments":
        writer.writerow(["Student Name", "Matric Number", "Email", "Department", "Level", "Class", "Course Code", "Roll Number", "Grade", "Enrolled At"])
        for cid in target_ids:
            cls = db.query(models.Class).filter(models.Class.id == cid).first()
            for e in db.query(models.Enrollment).filter(
                models.Enrollment.class_id == cid
            ).order_by(models.Enrollment.roll_number).all():
                student = db.query(models.User).filter(models.User.id == e.student_id).first()
                writer.writerow([
                    student.name if student else "",
                    student.matric_number if student else "",
                    student.email if student else "",
                    student.department if student else "",
                    student.level if student else "",
                    cls.name if cls else "",
                    cls.course_code if cls else "",
                    e.roll_number,
                    e.grade or "",
                    str(e.enrolled_at.date()) if e.enrolled_at else "",
                ])
    else:
        raise HTTPException(404, "Unknown report type")

    buf.seek(0)
    filename = f"{report_id}_report_{date.today()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@reports_router.get("/preview/{report_id}")
def preview_report(
    report_id: str,
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """Return first 10 rows of a report as JSON for in-page preview."""
    own_class_ids = [
        r[0] for r in db.query(models.Class.id)
        .filter(models.Class.lecturer_id == current_user.id).all()
    ]

    if class_id is not None:
        if class_id not in own_class_ids:
            raise HTTPException(403, "Access denied")
        target_ids = [class_id]
    else:
        target_ids = own_class_ids

    LIMIT = 10
    headers: list = []
    rows: list = []
    total_rows = 0

    if report_id == "attendance":
        headers = ["Student Name", "Matric Number", "Class", "Date", "Status"]
        q = db.query(models.Attendance).filter(
            models.Attendance.class_id.in_(target_ids)
        ).order_by(models.Attendance.date.desc())
        total_rows = q.count()
        for r in q.limit(LIMIT).all():
            student = db.query(models.User).filter(models.User.id == r.student_id).first()
            cls = db.query(models.Class).filter(models.Class.id == r.class_id).first()
            rows.append([
                student.name if student else "",
                student.matric_number if student else "",
                cls.name if cls else "",
                str(r.date),
                r.status.value,
            ])

    elif report_id == "assignments":
        headers = ["Student Name", "Matric Number", "Class", "Assignment", "Status", "Score", "Submitted At"]
        aids = [
            r[0] for r in db.query(models.Assignment.id)
            .filter(models.Assignment.class_id.in_(target_ids)).all()
        ]
        q = db.query(models.Submission).filter(
            models.Submission.assignment_id.in_(aids)
        ).order_by(models.Submission.submitted_at.desc()) if aids else []
        total_rows = q.count() if aids else 0
        for s in (q.limit(LIMIT).all() if aids else []):
            student = db.query(models.User).filter(models.User.id == s.student_id).first()
            assignment = db.query(models.Assignment).filter(models.Assignment.id == s.assignment_id).first()
            cls = db.query(models.Class).filter(models.Class.id == assignment.class_id).first() if assignment else None
            rows.append([
                student.name if student else "",
                student.matric_number if student else "",
                cls.name if cls else "",
                assignment.title if assignment else "",
                s.status.value,
                str(s.score) if s.score is not None else "—",
                str(s.submitted_at)[:10] if s.submitted_at else "—",
            ])

    elif report_id == "quizzes":
        headers = ["Student Name", "Matric Number", "Class", "Quiz", "Score", "Total", "Percentage", "Submitted At"]
        qids = [
            r[0] for r in db.query(models.Quiz.id)
            .filter(models.Quiz.class_id.in_(target_ids)).all()
        ]
        q = db.query(models.QuizAttempt).filter(
            models.QuizAttempt.quiz_id.in_(qids),
            models.QuizAttempt.submitted_at.isnot(None),
        ).order_by(models.QuizAttempt.submitted_at.desc()) if qids else []
        total_rows = q.count() if qids else 0
        for a in (q.limit(LIMIT).all() if qids else []):
            student = db.query(models.User).filter(models.User.id == a.student_id).first()
            quiz = db.query(models.Quiz).filter(models.Quiz.id == a.quiz_id).first()
            cls = db.query(models.Class).filter(models.Class.id == quiz.class_id).first() if quiz else None
            pct = f"{round(a.score / a.total * 100, 1)}%" if a.score is not None and a.total else "—"
            rows.append([
                student.name if student else "",
                student.matric_number if student else "",
                cls.name if cls else "",
                quiz.title if quiz else "",
                str(a.score) if a.score is not None else "—",
                str(a.total) if a.total else "—",
                pct,
                str(a.submitted_at)[:10] if a.submitted_at else "—",
            ])

    elif report_id == "class_progress":
        headers = ["Student Name", "Matric Number", "Class", "Attendance %", "Assignments Submitted", "Avg Score", "Quiz Avg"]
        for cid in target_ids:
            if len(rows) >= LIMIT:
                break
            cls = db.query(models.Class).filter(models.Class.id == cid).first()
            aids = [r[0] for r in db.query(models.Assignment.id).filter(models.Assignment.class_id == cid).all()]
            qids = [r[0] for r in db.query(models.Quiz.id).filter(models.Quiz.class_id == cid).all()]
            for e in db.query(models.Enrollment).filter(models.Enrollment.class_id == cid).all():
                total_rows += 1
                if len(rows) >= LIMIT:
                    continue
                student = db.query(models.User).filter(models.User.id == e.student_id).first()
                att = db.query(models.Attendance).filter(
                    models.Attendance.student_id == e.student_id,
                    models.Attendance.class_id == cid,
                ).all()
                att_present = sum(1 for a in att if a.status == models.StatusEnum.present)
                att_rate = f"{round(att_present / len(att) * 100, 1)}%" if att else "0%"
                subs = db.query(models.Submission).filter(
                    models.Submission.assignment_id.in_(aids),
                    models.Submission.student_id == e.student_id,
                    models.Submission.status != models.SubmissionStatusEnum.pending,
                ).all() if aids else []
                graded = [s for s in subs if s.score is not None]
                assign_avg = f"{round(sum(s.score for s in graded) / len(graded), 1)}" if graded else "—"
                attempts = db.query(models.QuizAttempt).filter(
                    models.QuizAttempt.quiz_id.in_(qids),
                    models.QuizAttempt.student_id == e.student_id,
                    models.QuizAttempt.submitted_at.isnot(None),
                ).all() if qids else []
                scored = [a for a in attempts if a.score is not None and a.total]
                quiz_avg = f"{round(sum(a.score / a.total * 100 for a in scored) / len(scored), 1)}%" if scored else "—"
                rows.append([
                    student.name if student else "",
                    student.matric_number if student else "",
                    cls.name if cls else "",
                    att_rate, str(len(subs)), assign_avg, quiz_avg,
                ])

    elif report_id == "live_sessions":
        headers = ["Student Name", "Matric Number", "Class", "Session Date", "Cookies Clicked", "Total Cookies", "Score", "Status"]
        q = db.query(models.Attendance).filter(
            models.Attendance.class_id.in_(target_ids),
            models.Attendance.session_id.isnot(None),
        ).order_by(models.Attendance.date.desc())
        total_rows = q.count()
        for r in q.limit(LIMIT).all():
            student = db.query(models.User).filter(models.User.id == r.student_id).first()
            cls = db.query(models.Class).filter(models.Class.id == r.class_id).first()
            total_cookies = db.query(models.AttendanceCookie).filter(
                models.AttendanceCookie.session_id == r.session_id
            ).count()
            clicked = db.query(models.CookieResponse).join(
                models.AttendanceCookie,
                models.CookieResponse.cookie_id == models.AttendanceCookie.id,
            ).filter(
                models.AttendanceCookie.session_id == r.session_id,
                models.CookieResponse.student_id == r.student_id,
                models.CookieResponse.is_valid == True,
            ).count()
            rows.append([
                student.name if student else "",
                student.matric_number if student else "",
                cls.name if cls else "",
                str(r.date),
                str(clicked), str(total_cookies),
                f"{r.score:.0f}%" if r.score is not None else "—",
                r.status.value,
            ])

    elif report_id == "enrollments":
        headers = ["Student Name", "Matric Number", "Email", "Class", "Course Code", "Roll No.", "Grade", "Enrolled At"]
        q = db.query(models.Enrollment).filter(
            models.Enrollment.class_id.in_(target_ids)
        ).order_by(models.Enrollment.enrolled_at.desc())
        total_rows = q.count()
        for e in q.limit(LIMIT).all():
            student = db.query(models.User).filter(models.User.id == e.student_id).first()
            cls = db.query(models.Class).filter(models.Class.id == e.class_id).first()
            rows.append([
                student.name if student else "",
                student.matric_number if student else "",
                student.email if student else "",
                cls.name if cls else "",
                cls.course_code if cls else "",
                str(e.roll_number),
                e.grade or "—",
                str(e.enrolled_at.date()) if e.enrolled_at else "—",
            ])
    else:
        raise HTTPException(404, "Unknown report type")

    return {"headers": headers, "rows": rows, "total_rows": total_rows}
