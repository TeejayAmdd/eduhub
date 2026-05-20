from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user, require_lecturer
import app.models as models
from app.schemas import (
    SessionStartRequest, SessionResponse,
    CookieOut, AttendanceResult, SessionAttendanceSummary,
)

router = APIRouter(prefix="/api/sessions", tags=["Live Sessions"])
cookies_router = APIRouter(prefix="/api/cookies", tags=["Cookies"])
classes_live_router = APIRouter(prefix="/api/classes", tags=["Class Live Attendance"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_own_session(session_id: int, lecturer_id: int, db: Session) -> models.LiveSession:
    session = db.query(models.LiveSession).filter(models.LiveSession.id == session_id).first()
    if not session:
        raise HTTPException(404, "Session not found")
    cls = db.query(models.Class).filter(
        models.Class.id == session.class_id,
        models.Class.lecturer_id == lecturer_id,
    ).first()
    if not cls:
        raise HTTPException(403, "Access denied")
    return session


# ── Session Management (Lecturer) ─────────────────────────────────────────────

@router.post("/start", response_model=SessionResponse, status_code=201)
def start_session(
    payload: SessionStartRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """Start a live session for a class and launch the cookie scheduler."""
    cls = db.query(models.Class).filter(
        models.Class.id == payload.class_id,
        models.Class.lecturer_id == current_user.id,
    ).first()
    if not cls:
        raise HTTPException(404, "Class not found or access denied")

    # Prevent duplicate active sessions for the same class
    existing = db.query(models.LiveSession).filter(
        models.LiveSession.class_id == payload.class_id,
        models.LiveSession.status == models.LiveSessionStatusEnum.active,
    ).first()
    if existing:
        raise HTTPException(400, "A live session is already active for this class")

    session = models.LiveSession(
        class_id=payload.class_id,
        lecturer_id=current_user.id,
        status=models.LiveSessionStatusEnum.active,
        total_cookies_sent=0,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    from app.services.cookie_scheduler import run_cookie_scheduler
    background_tasks.add_task(run_cookie_scheduler, session.id)

    return session


@router.post("/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """End a live session, calculate attendance scores, notify all connected students."""
    session = _get_own_session(session_id, current_user.id, db)

    if session.status == models.LiveSessionStatusEnum.ended:
        raise HTTPException(400, "Session already ended")

    session.status = models.LiveSessionStatusEnum.ended
    session.ended_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(session)

    # Score every enrolled student
    from app.services.attendance_calculator import calculate_session_attendance
    calculate_session_attendance(session_id)

    # Notify all students still connected via WebSocket
    from app.routers.websocket import broadcast_to_session
    await broadcast_to_session(session_id, {
        "type": "session_end",
        "message": "Session has ended",
    })

    return session


@router.get("/my-history")
def my_session_history(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Student's own live-session attendance history across all enrolled classes."""
    if current_user.role != models.RoleEnum.student:
        raise HTTPException(403, "Students only")

    att_rows = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.student_id == current_user.id,
            models.Attendance.session_id.isnot(None),
        )
        .order_by(models.Attendance.date.desc())
        .all()
    )

    result = []
    for rec in att_rows:
        session = db.query(models.LiveSession).filter(
            models.LiveSession.id == rec.session_id
        ).first()
        cls = db.query(models.Class).filter(models.Class.id == rec.class_id).first()

        total_cookies = (
            db.query(models.AttendanceCookie)
            .filter(models.AttendanceCookie.session_id == rec.session_id)
            .count()
        )
        cookies_clicked = (
            db.query(models.CookieResponse)
            .join(models.AttendanceCookie, models.CookieResponse.cookie_id == models.AttendanceCookie.id)
            .filter(
                models.AttendanceCookie.session_id == rec.session_id,
                models.CookieResponse.student_id == current_user.id,
                models.CookieResponse.is_valid == True,
            )
            .count()
        )

        result.append({
            "session_id": rec.session_id,
            "class_id": rec.class_id,
            "class_name": cls.name if cls else "Unknown",
            "course_code": cls.course_code if cls else None,
            "date": rec.date,
            "started_at": session.started_at if session else None,
            "ended_at": session.ended_at if session else None,
            "cookies_clicked": cookies_clicked,
            "total_cookies": total_cookies,
            "score": rec.score,
            "status": rec.status.value,
        })

    return result


@router.get("/{session_id}", response_model=SessionResponse)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get session details and current status."""
    session = db.query(models.LiveSession).filter(
        models.LiveSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")
    return session


# ── Cookie Dispatch (Internal / Manual Trigger) ───────────────────────────────

@router.post("/{session_id}/dispatch-cookie", response_model=CookieOut, status_code=201)
async def dispatch_cookie(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """Manually broadcast a single cookie to all connected students."""
    session = _get_own_session(session_id, current_user.id, db)
    if session.status == models.LiveSessionStatusEnum.ended:
        raise HTTPException(400, "Cannot dispatch a cookie to an ended session")

    now = datetime.now(timezone.utc)
    cookie = models.AttendanceCookie(
        session_id=session_id,
        sent_at=now,
        expires_at=now + timedelta(seconds=15),
    )
    db.add(cookie)
    db.commit()
    db.refresh(cookie)

    from app.routers.websocket import broadcast_to_session
    await broadcast_to_session(session_id, {
        "type": "cookie",
        "cookie_id": cookie.id,
        "expires_in": 15,
    })

    return cookie


# ── Student Cookie Click ───────────────────────────────────────────────────────

@cookies_router.post("/{cookie_id}/click", status_code=200)
def click_cookie(
    cookie_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Register a student's click on an attendance cookie."""
    if current_user.role != models.RoleEnum.student:
        raise HTTPException(403, "Students only")

    cookie = db.query(models.AttendanceCookie).filter(
        models.AttendanceCookie.id == cookie_id
    ).first()
    if not cookie:
        raise HTTPException(404, "Cookie not found")

    now = datetime.now(timezone.utc)

    # Check expiry
    expires = cookie.expires_at
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    is_valid = expires is None or now <= expires

    # Prevent duplicate clicks
    already = db.query(models.CookieResponse).filter(
        models.CookieResponse.cookie_id == cookie_id,
        models.CookieResponse.student_id == current_user.id,
    ).first()
    if already:
        raise HTTPException(409, "Cookie already clicked")

    response = models.CookieResponse(
        cookie_id=cookie_id,
        student_id=current_user.id,
        clicked_at=now,
        is_valid=is_valid,
    )
    db.add(response)
    db.commit()

    return {
        "ok": True,
        "is_valid": is_valid,
        "message": "Click registered" if is_valid else "Cookie had already expired",
    }


# ── Attendance Results ─────────────────────────────────────────────────────────

@router.get("/{session_id}/attendance", response_model=List[AttendanceResult])
def session_attendance(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """Get all students' attendance scores for a session (lecturer only)."""
    _get_own_session(session_id, current_user.id, db)

    records = (
        db.query(models.Attendance)
        .filter(models.Attendance.session_id == session_id)
        .all()
    )

    total_cookies = (
        db.query(models.AttendanceCookie)
        .filter(models.AttendanceCookie.session_id == session_id)
        .count()
    )

    results = []
    for rec in records:
        clicked = (
            db.query(models.CookieResponse)
            .join(models.AttendanceCookie, models.CookieResponse.cookie_id == models.AttendanceCookie.id)
            .filter(
                models.AttendanceCookie.session_id == session_id,
                models.CookieResponse.student_id == rec.student_id,
                models.CookieResponse.is_valid == True,
            )
            .count()
        )
        student = db.query(models.User).filter(models.User.id == rec.student_id).first()
        results.append(AttendanceResult(
            student_id=rec.student_id,
            name=student.name if student else "Unknown",
            cookies_clicked=clicked,
            total_cookies=total_cookies,
            score=rec.score or 0.0,
            status=rec.status.value if rec.status else "absent",
        ))
    return results


@router.get("/{session_id}/attendance/me", response_model=AttendanceResult)
def my_session_attendance(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get the requesting student's own score for a session."""
    if current_user.role != models.RoleEnum.student:
        raise HTTPException(403, "Students only")

    session = db.query(models.LiveSession).filter(
        models.LiveSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")

    total_cookies = (
        db.query(models.AttendanceCookie)
        .filter(models.AttendanceCookie.session_id == session_id)
        .count()
    )

    clicked = (
        db.query(models.CookieResponse)
        .join(models.AttendanceCookie, models.CookieResponse.cookie_id == models.AttendanceCookie.id)
        .filter(
            models.AttendanceCookie.session_id == session_id,
            models.CookieResponse.student_id == current_user.id,
            models.CookieResponse.is_valid == True,
        )
        .count()
    )

    score = (clicked / total_cookies * 100) if total_cookies > 0 else 0.0

    rec = (
        db.query(models.Attendance)
        .filter(
            models.Attendance.session_id == session_id,
            models.Attendance.student_id == current_user.id,
        )
        .first()
    )

    return AttendanceResult(
        student_id=current_user.id,
        name=current_user.name,
        cookies_clicked=clicked,
        total_cookies=total_cookies,
        score=round(score, 1),
        status=rec.status.value if rec and rec.status else "absent",
    )


@classes_live_router.get("/{class_id}/sessions")
def list_class_sessions(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """All ended live sessions for a class with summary stats."""
    from datetime import timezone as tz
    cls = db.query(models.Class).filter(
        models.Class.id == class_id,
        models.Class.lecturer_id == current_user.id,
    ).first()
    if not cls:
        raise HTTPException(404, "Class not found or access denied")

    sessions = (
        db.query(models.LiveSession)
        .filter(
            models.LiveSession.class_id == class_id,
            models.LiveSession.status == models.LiveSessionStatusEnum.ended,
        )
        .order_by(models.LiveSession.started_at.desc())
        .all()
    )

    result = []
    for s in sessions:
        total_cookies = (
            db.query(models.AttendanceCookie)
            .filter(models.AttendanceCookie.session_id == s.id)
            .count()
        )
        att_rows = (
            db.query(models.Attendance)
            .filter(models.Attendance.session_id == s.id)
            .all()
        )
        present = sum(1 for a in att_rows if a.status == models.StatusEnum.present)
        partial = sum(1 for a in att_rows if a.status == models.StatusEnum.partial)
        absent  = sum(1 for a in att_rows if a.status == models.StatusEnum.absent)

        duration_mins = None
        if s.started_at and s.ended_at:
            started = s.started_at.replace(tzinfo=timezone.utc) if s.started_at.tzinfo is None else s.started_at
            ended   = s.ended_at.replace(tzinfo=timezone.utc)   if s.ended_at.tzinfo is None   else s.ended_at
            duration_mins = round((ended - started).total_seconds() / 60)

        result.append({
            "id": s.id,
            "started_at": s.started_at,
            "ended_at": s.ended_at,
            "total_cookies": total_cookies,
            "duration_mins": duration_mins,
            "present_count": present,
            "partial_count": partial,
            "absent_count": absent,
            "total_students": len(att_rows),
        })

    return result


@classes_live_router.get("/{class_id}/attendance/summary", response_model=SessionAttendanceSummary)
def class_attendance_summary(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    """Aggregate live-session attendance across all ended sessions for a class."""
    cls = db.query(models.Class).filter(
        models.Class.id == class_id,
        models.Class.lecturer_id == current_user.id,
    ).first()
    if not cls:
        raise HTTPException(404, "Class not found or access denied")

    sessions = (
        db.query(models.LiveSession)
        .filter(
            models.LiveSession.class_id == class_id,
            models.LiveSession.status == models.LiveSessionStatusEnum.ended,
        )
        .all()
    )

    enrollments = (
        db.query(models.Enrollment)
        .filter(models.Enrollment.class_id == class_id)
        .all()
    )

    student_stats: dict[int, dict] = {}
    for enrollment in enrollments:
        sid = enrollment.student_id
        student = db.query(models.User).filter(models.User.id == sid).first()
        student_stats[sid] = {
            "student_id": sid,
            "name": student.name if student else "Unknown",
            "cookies_clicked": 0,
            "total_cookies": 0,
        }

    for s in sessions:
        total = (
            db.query(models.AttendanceCookie)
            .filter(models.AttendanceCookie.session_id == s.id)
            .count()
        )
        for sid in student_stats:
            clicked = (
                db.query(models.CookieResponse)
                .join(
                    models.AttendanceCookie,
                    models.CookieResponse.cookie_id == models.AttendanceCookie.id,
                )
                .filter(
                    models.AttendanceCookie.session_id == s.id,
                    models.CookieResponse.student_id == sid,
                    models.CookieResponse.is_valid == True,
                )
                .count()
            )
            student_stats[sid]["cookies_clicked"] += clicked
            student_stats[sid]["total_cookies"] += total

    results = []
    for stat in student_stats.values():
        total = stat["total_cookies"]
        clicked = stat["cookies_clicked"]
        score = (clicked / total * 100) if total > 0 else 0.0
        if score >= 70:
            status = "present"
        elif score >= 30:
            status = "partial"
        else:
            status = "absent"
        results.append(AttendanceResult(
            student_id=stat["student_id"],
            name=stat["name"],
            cookies_clicked=clicked,
            total_cookies=total,
            score=round(score, 1),
            status=status,
        ))

    return SessionAttendanceSummary(
        class_id=class_id,
        total_sessions=len(sessions),
        students=results,
    )
