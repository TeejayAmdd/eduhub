from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime, timezone
import os
import time

from app.database import get_db
from app.auth import get_current_user, require_lecturer
from app.schemas import LectureCreate, LectureOut, ClassStatsOut, InstantLectureCreate, LectureHistoryOut
from datetime import date as date_type
from app.utils.notifications import push
from app.config import settings
import app.models as models

router = APIRouter(prefix="/api/lectures", tags=["Lectures"])


# ── Helpers ───────────────────────────────────────────────────────────────────
def _duration_str(started_at, ended_at) -> Optional[str]:
    if not started_at or not ended_at:
        return None
    s = started_at.replace(tzinfo=timezone.utc) if started_at.tzinfo is None else started_at
    e = ended_at.replace(tzinfo=timezone.utc)   if ended_at.tzinfo is None   else ended_at
    total_minutes = int((e - s).total_seconds() // 60)
    hours, minutes = divmod(total_minutes, 60)
    if hours > 0:
        return f"{hours}h {minutes}m"
    return f"{minutes} min"


def _start_live_session(lecture: models.Lecture, lecturer_id: int, background_tasks: BackgroundTasks, db: Session) -> models.LiveSession:
    """Create a LiveSession linked to a lecture and kick off the cookie scheduler."""
    live_session = models.LiveSession(
        class_id=lecture.class_id,
        lecturer_id=lecturer_id,
        lecture_id=lecture.id,
        status=models.LiveSessionStatusEnum.active,
        total_cookies_sent=0,
    )
    db.add(live_session)
    db.flush()
    from app.services.cookie_scheduler import run_cookie_scheduler
    background_tasks.add_task(run_cookie_scheduler, live_session.id)
    return live_session


def _own_class(class_id: int, lecturer_id: int, db: Session) -> models.Class:
    cls = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    if cls.lecturer_id != lecturer_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return cls


# ── Schedule a lecture ────────────────────────────────────────────────────────
@router.post("", response_model=LectureOut, status_code=201)
def schedule_lecture(
    payload: LectureCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    cls = _own_class(payload.class_id, current_user.id, db)

    lecture = models.Lecture(
        class_id=payload.class_id,
        title=payload.title,
        description=payload.description,
        scheduled_at=payload.scheduled_at,
        status=models.LectureStatusEnum.scheduled,
    )
    db.add(lecture)
    db.flush()

    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.class_id == payload.class_id
    ).all()
    scheduled_str = payload.scheduled_at.strftime('%A, %d %b %Y at %I:%M %p')
    student_info = []
    for e in enrollments:
        push(db, e.student_id, type="announcement",
             title=f"Lecture scheduled: {lecture.title}",
             body=f"{cls.name} · {payload.scheduled_at.strftime('%a %d %b, %I:%M %p')}",
             link=f"/student/courses/{payload.class_id}")
        student = db.query(models.User).filter(models.User.id == e.student_id).first()
        if student:
            student_info.append((student.email, student.name))

    def _send_scheduled(info, course, title, sched):
        from app.services.email_service import send_lecture_scheduled
        for email, name in info:
            send_lecture_scheduled(email, name, course, title, sched)

    background_tasks.add_task(_send_scheduled, student_info, cls.name, lecture.title, scheduled_str)

    db.commit()
    db.refresh(lecture)
    return lecture


# ── Start an instant (unscheduled) lecture ────────────────────────────────────
@router.post("/instant", response_model=LectureOut, status_code=201)
def start_instant_lecture(
    payload: InstantLectureCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    cls = _own_class(payload.class_id, current_user.id, db)

    now = datetime.now(timezone.utc)
    lecture = models.Lecture(
        class_id=payload.class_id,
        title=payload.title,
        description=payload.description,
        scheduled_at=now,
        started_at=now,
        status=models.LectureStatusEnum.live,
    )
    db.add(lecture)
    db.flush()
    lecture.jitsi_room = f"EduHub-Class{payload.class_id}-Lec{lecture.id}"

    _start_live_session(lecture, current_user.id, background_tasks, db)

    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.class_id == payload.class_id
    ).all()
    student_info = []
    for e in enrollments:
        push(db, e.student_id, type="announcement",
             title=f"🔴 Live now: {lecture.title}",
             body=f"{cls.name} is live right now. Join now!",
             link=f"/student/courses/{payload.class_id}")
        student = db.query(models.User).filter(models.User.id == e.student_id).first()
        if student:
            student_info.append((student.email, student.name))

    def _send_live(info, course, title):
        from app.services.email_service import send_lecture_live
        for email, name in info:
            send_lecture_live(email, name, course, title)

    background_tasks.add_task(_send_live, student_info, cls.name, lecture.title)

    db.commit()
    db.refresh(lecture)
    return lecture


# ── List lectures (role-filtered) ─────────────────────────────────────────────
@router.get("", response_model=List[LectureOut])
def list_lectures(
    class_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Lecture)

    if current_user.role == models.RoleEnum.lecturer:
        own_ids = [
            r[0] for r in db.query(models.Class.id)
            .filter(models.Class.lecturer_id == current_user.id)
            .all()
        ]
        query = query.filter(models.Lecture.class_id.in_(own_ids))
    elif current_user.role == models.RoleEnum.student:
        enrolled_ids = [
            r[0] for r in db.query(models.Enrollment.class_id)
            .filter(models.Enrollment.student_id == current_user.id)
            .all()
        ]
        query = query.filter(models.Lecture.class_id.in_(enrolled_ids))

    if class_id:
        query = query.filter(models.Lecture.class_id == class_id)

    return query.order_by(models.Lecture.scheduled_at).all()


# ── Go live ───────────────────────────────────────────────────────────────────
@router.post("/{lecture_id}/start", response_model=LectureOut)
def start_lecture(
    lecture_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    lecture = db.query(models.Lecture).filter(models.Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    _own_class(lecture.class_id, current_user.id, db)

    lecture.status = models.LectureStatusEnum.live
    lecture.started_at = datetime.now(timezone.utc)
    if not lecture.jitsi_room:
        lecture.jitsi_room = f"EduHub-Class{lecture.class_id}-Lec{lecture.id}"
    db.flush()

    _start_live_session(lecture, current_user.id, background_tasks, db)

    cls = db.query(models.Class).filter(models.Class.id == lecture.class_id).first()
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.class_id == lecture.class_id
    ).all()
    student_info = []
    for e in enrollments:
        push(db, e.student_id, type="announcement",
             title=f"🔴 Live now: {lecture.title}",
             body=f"{cls.name} is live. Join now!",
             link=f"/student/courses/{lecture.class_id}")
        student = db.query(models.User).filter(models.User.id == e.student_id).first()
        if student:
            student_info.append((student.email, student.name))

    def _send_live2(info, course, title):
        from app.services.email_service import send_lecture_live
        for email, name in info:
            send_lecture_live(email, name, course, title)

    background_tasks.add_task(_send_live2, student_info, cls.name, lecture.title)

    db.commit()
    db.refresh(lecture)
    return lecture


# ── End lecture ───────────────────────────────────────────────────────────────
@router.post("/{lecture_id}/end", response_model=LectureOut)
def end_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    lecture = db.query(models.Lecture).filter(models.Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    _own_class(lecture.class_id, current_user.id, db)

    now = datetime.now(timezone.utc)
    lecture.status = models.LectureStatusEnum.ended
    lecture.ended_at = now
    dur = _duration_str(lecture.started_at, now)

    cls = db.query(models.Class).filter(models.Class.id == lecture.class_id).first()
    enrollments = db.query(models.Enrollment).filter(
        models.Enrollment.class_id == lecture.class_id
    ).all()

    # End the linked LiveSession and calculate cookie-based attendance scores
    live_session = db.query(models.LiveSession).filter(
        models.LiveSession.lecture_id == lecture_id,
        models.LiveSession.status == models.LiveSessionStatusEnum.active,
    ).first()

    attended_count = 0
    total_enrolled = len(enrollments)

    if live_session:
        live_session.status = models.LiveSessionStatusEnum.ended
        live_session.ended_at = now
        db.commit()

        from app.services.attendance_calculator import calculate_session_attendance
        results = calculate_session_attendance(live_session.id)

        # Notify each student based on their cookie score
        score_map = {r["student_id"]: r for r in results}
        for e in enrollments:
            r = score_map.get(e.student_id)
            if r and r["status"] in ("present", "partial"):
                attended_count += 1
                push(db, e.student_id,
                     type="announcement",
                     title=f"Lecture ended: {lecture.title}",
                     body=f"{cls.name} ended. Your attendance score: {r['score']}% ({r['cookies_clicked']}/{r['total_cookies']} checks).",
                     link=f"/student/courses/{lecture.class_id}")
            else:
                push(db, e.student_id,
                     type="announcement",
                     title=f"You missed a class: {lecture.title}",
                     body=f"You were marked absent for {cls.name}." + (f" Duration: {dur}." if dur else ""),
                     link=f"/student/courses/{lecture.class_id}")
    else:
        # No live session found — fall back: anyone with a present record counts
        attended_ids = {
            row.student_id for row in db.query(models.Attendance).filter(
                models.Attendance.lecture_id == lecture_id,
                models.Attendance.status == models.StatusEnum.present,
            ).all()
        }
        attended_count = len(attended_ids)
        for e in enrollments:
            if e.student_id not in attended_ids:
                existing = db.query(models.Attendance).filter(
                    models.Attendance.lecture_id == lecture_id,
                    models.Attendance.student_id == e.student_id,
                ).first()
                if not existing:
                    db.add(models.Attendance(
                        class_id=lecture.class_id,
                        student_id=e.student_id,
                        date=date_type.today(),
                        status=models.StatusEnum.absent,
                        lecture_id=lecture_id,
                    ))

    # Notify lecturer with summary
    push(db, cls.lecturer_id,
         type="announcement",
         title=f"Class ended: {lecture.title}",
         body=f"{attended_count}/{total_enrolled} students attended." + (f" Duration: {dur}." if dur else ""),
         link=f"/class-preparation/{lecture.class_id}")

    db.commit()
    db.refresh(lecture)
    return lecture


# ── Delete / cancel a scheduled lecture ──────────────────────────────────────
@router.delete("/{lecture_id}", status_code=204)
def cancel_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    lecture = db.query(models.Lecture).filter(models.Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    _own_class(lecture.class_id, current_user.id, db)
    if lecture.status == models.LectureStatusEnum.live:
        raise HTTPException(status_code=400, detail="Cannot cancel a live lecture. End it first.")
    db.delete(lecture)
    db.commit()


# ── JaaS JWT token for the virtual room ──────────────────────────────────────
@router.get("/{lecture_id}/token")
def get_jitsi_token(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lecture = db.query(models.Lecture).filter(models.Lecture.id == lecture_id).first()
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    app_id = (settings.JAAS_APP_ID or "").strip()
    key_id = (settings.JAAS_API_KEY_ID or "").strip()

    if not app_id or not key_id:
        raise HTTPException(status_code=501, detail="JaaS not configured")

    # Prefer JAAS_PRIVATE_KEY env var (PEM string) — works on Railway
    # Fall back to JAAS_PRIVATE_KEY_FILE (legacy file path)
    private_key = (settings.JAAS_PRIVATE_KEY or "").strip()
    if not private_key:
        key_file = (settings.JAAS_PRIVATE_KEY_FILE or "").strip()
        if not key_file or not os.path.exists(key_file):
            raise HTTPException(status_code=501, detail="JaaS private key not configured")
        with open(key_file) as f:
            private_key = f.read()

    if not private_key:
        raise HTTPException(status_code=501, detail="JaaS private key is empty")

    from jose import jwt as jose_jwt

    now = int(time.time())
    is_moderator = current_user.role == models.RoleEnum.lecturer
    room = lecture.jitsi_room or f"EduHub-Class{lecture.class_id}-Lec{lecture.id}"

    payload = {
        "iss": "chat",
        "aud": "jitsi",
        "exp": now + 7200,
        "nbf": now - 10,
        "sub": app_id,
        "room": room,
        "context": {
            "user": {
                "moderator": str(is_moderator).lower(),
                "name": current_user.name,
                "avatar": "",
                "email": current_user.email,
                "id": str(current_user.id),
            },
            "features": {
                "livestreaming": "false",
                "outbound-call": "false",
                "transcription": "false",
                "recording": "false",
            },
        },
    }

    token = jose_jwt.encode(
        payload, private_key, algorithm="RS256",
        headers={"kid": key_id},
    )
    return {
        "token": token,
        "app_id": app_id,
        "room_name": f"{app_id}/{room}",
    }


# ── Get active LiveSession for a lecture (used by frontend to connect WS) ────
@router.get("/{lecture_id}/session")
def get_lecture_session(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    session = db.query(models.LiveSession).filter(
        models.LiveSession.lecture_id == lecture_id,
        models.LiveSession.status == models.LiveSessionStatusEnum.active,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="No active session for this lecture")
    return {"session_id": session.id}


# ── Mark student as present for a live lecture ───────────────────────────────
@router.post("/{lecture_id}/attend", status_code=200)
def attend_lecture(
    lecture_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lecture = db.query(models.Lecture).filter(models.Lecture.id == lecture_id).first()
    if not lecture or lecture.status != models.LectureStatusEnum.live:
        raise HTTPException(status_code=404, detail="Lecture not found or not live")

    existing = db.query(models.Attendance).filter(
        models.Attendance.lecture_id == lecture_id,
        models.Attendance.student_id == current_user.id,
    ).first()

    if not existing:
        db.add(models.Attendance(
            class_id=lecture.class_id,
            student_id=current_user.id,
            date=date_type.today(),
            status=models.StatusEnum.present,
            lecture_id=lecture_id,
        ))
        db.commit()

    return {"status": "recorded"}


# ── Ended lecture history with attendance stats ───────────────────────────────
@router.get("/class/{class_id}/history", response_model=List[LectureHistoryOut])
def lecture_history(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ended = (
        db.query(models.Lecture)
        .filter(
            models.Lecture.class_id == class_id,
            models.Lecture.status == models.LectureStatusEnum.ended,
        )
        .order_by(models.Lecture.started_at.desc())
        .all()
    )

    total_enrolled = db.query(models.Enrollment).filter(
        models.Enrollment.class_id == class_id
    ).count()

    result = []
    for lec in ended:
        attended_count = db.query(models.Attendance).filter(
            models.Attendance.lecture_id == lec.id,
            models.Attendance.status == models.StatusEnum.present,
        ).count()

        student_attended = None
        if current_user.role == models.RoleEnum.student:
            rec = db.query(models.Attendance).filter(
                models.Attendance.lecture_id == lec.id,
                models.Attendance.student_id == current_user.id,
                models.Attendance.status == models.StatusEnum.present,
            ).first()
            student_attended = rec is not None

        result.append(LectureHistoryOut(
            id=lec.id,
            class_id=lec.class_id,
            title=lec.title,
            description=lec.description,
            started_at=lec.started_at,
            ended_at=lec.ended_at,
            duration_str=_duration_str(lec.started_at, lec.ended_at),
            attended_count=attended_count,
            total_enrolled=total_enrolled,
            student_attended=student_attended,
        ))

    return result


# ── Class stats (for dashboard) ───────────────────────────────────────────────
@router.get("/class/{class_id}/stats", response_model=ClassStatsOut)
def class_stats(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    enrolled_count = db.query(models.Enrollment).filter(
        models.Enrollment.class_id == class_id
    ).count()

    assignment_count = db.query(models.Assignment).filter(
        models.Assignment.class_id == class_id
    ).count()

    now = datetime.now(timezone.utc)

    live_lecture = db.query(models.Lecture).filter(
        models.Lecture.class_id == class_id,
        models.Lecture.status == models.LectureStatusEnum.live,
    ).first()

    next_lecture = db.query(models.Lecture).filter(
        models.Lecture.class_id == class_id,
        models.Lecture.status == models.LectureStatusEnum.scheduled,
        models.Lecture.scheduled_at >= now,
    ).order_by(models.Lecture.scheduled_at).first()

    return ClassStatsOut(
        enrolled_count=enrolled_count,
        assignment_count=assignment_count,
        live_lecture=live_lecture,
        next_lecture=next_lecture,
    )
