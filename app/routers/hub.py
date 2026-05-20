from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import re

from app.database import get_db
from app.auth import get_current_user, require_lecturer
from app.schemas import (
    TutorApplyRequest, TutorApplicationOut, SelectTutorsRequest,
    HubBroadcastCreate, HubBroadcastOut,
    HubLiveSessionCreate, HubLiveSessionOut,
    HubInfoOut, TutorInfo,
)
from app.utils.notifications import push
import app.models as models

router = APIRouter(prefix="/api/hub", tags=["Study Hub"])


def _jitsi_room(class_id: int, tutor_id: int, session_id: int) -> str:
    return f"eduhub-hub-{class_id}-{tutor_id}-{session_id}"


def _broadcast_out(b: models.HubBroadcast, db: Session) -> HubBroadcastOut:
    tutor = db.query(models.User).filter(models.User.id == b.tutor_id).first()
    return HubBroadcastOut(
        id=b.id,
        class_id=b.class_id,
        tutor_id=b.tutor_id,
        tutor_name=tutor.name if tutor else "Tutor",
        message=b.message,
        created_at=b.created_at,
    )


def _live_out(s: models.HubLiveSession, db: Session) -> HubLiveSessionOut:
    tutor = db.query(models.User).filter(models.User.id == s.tutor_id).first()
    return HubLiveSessionOut(
        id=s.id,
        class_id=s.class_id,
        tutor_id=s.tutor_id,
        tutor_name=tutor.name if tutor else "Tutor",
        title=s.title,
        jitsi_room=s.jitsi_room,
        status=s.status,
        started_at=s.started_at,
        ended_at=s.ended_at,
    )


def _approved_tutor_ids(class_id: int, db: Session) -> List[int]:
    apps = db.query(models.TutorApplication).filter(
        models.TutorApplication.class_id == class_id,
        models.TutorApplication.status == models.TutorApplicationStatusEnum.approved,
    ).all()
    return [a.student_id for a in apps]


# ── Student: apply to be tutor ─────────────────────────────────────────────────
@router.post("/{class_id}/apply", status_code=201)
def apply_tutor(
    class_id: int,
    payload: TutorApplyRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only students can apply")

    enrolled = db.query(models.Enrollment).filter(
        models.Enrollment.class_id == class_id,
        models.Enrollment.student_id == current_user.id,
    ).first()
    if not enrolled:
        raise HTTPException(status_code=403, detail="You are not enrolled in this course")

    existing = db.query(models.TutorApplication).filter(
        models.TutorApplication.class_id == class_id,
        models.TutorApplication.student_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You have already applied for this course")

    app_obj = models.TutorApplication(
        class_id=class_id,
        student_id=current_user.id,
        motivation=payload.motivation,
        status=models.TutorApplicationStatusEnum.pending,
    )
    db.add(app_obj)
    db.commit()
    db.refresh(app_obj)
    return {"message": "Application submitted"}


# ── Student/Tutor: get hub info ────────────────────────────────────────────────
@router.get("/{class_id}", response_model=HubInfoOut)
def get_hub(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not class_:
        raise HTTPException(status_code=404, detail="Class not found")

    # Verify access
    if current_user.role == models.RoleEnum.student:
        enrolled = db.query(models.Enrollment).filter(
            models.Enrollment.class_id == class_id,
            models.Enrollment.student_id == current_user.id,
        ).first()
        if not enrolled:
            raise HTTPException(status_code=403, detail="Not enrolled in this course")

    member_count = db.query(models.Enrollment).filter(
        models.Enrollment.class_id == class_id
    ).count()

    approved_apps = db.query(models.TutorApplication).filter(
        models.TutorApplication.class_id == class_id,
        models.TutorApplication.status == models.TutorApplicationStatusEnum.approved,
    ).all()

    tutors = []
    for a in approved_apps:
        student = db.query(models.User).filter(models.User.id == a.student_id).first()
        if student:
            tutors.append(TutorInfo(
                student_id=student.id,
                name=student.name,
                matric_number=student.matric_number,
            ))

    my_app_status = None
    i_am_tutor = False
    if current_user.role == models.RoleEnum.student:
        my_app = db.query(models.TutorApplication).filter(
            models.TutorApplication.class_id == class_id,
            models.TutorApplication.student_id == current_user.id,
        ).first()
        if my_app:
            my_app_status = my_app.status
        i_am_tutor = current_user.id in [t.student_id for t in tutors]

    broadcasts = db.query(models.HubBroadcast).filter(
        models.HubBroadcast.class_id == class_id,
    ).order_by(models.HubBroadcast.created_at.desc()).limit(50).all()

    active_live = db.query(models.HubLiveSession).filter(
        models.HubLiveSession.class_id == class_id,
        models.HubLiveSession.status == "active",
    ).first()

    return HubInfoOut(
        class_id=class_id,
        class_name=class_.name,
        course_code=class_.course_code,
        member_count=member_count,
        tutors=tutors,
        my_application_status=my_app_status,
        i_am_tutor=i_am_tutor,
        broadcasts=[_broadcast_out(b, db) for b in broadcasts],
        active_live_session=_live_out(active_live, db) if active_live else None,
    )


# ── Lecturer: view applications ────────────────────────────────────────────────
@router.get("/{class_id}/applications", response_model=List[TutorApplicationOut])
def get_applications(
    class_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    apps = db.query(models.TutorApplication).filter(
        models.TutorApplication.class_id == class_id,
    ).order_by(models.TutorApplication.applied_at).all()

    result = []
    for a in apps:
        student = db.query(models.User).filter(models.User.id == a.student_id).first()
        result.append(TutorApplicationOut(
            id=a.id,
            class_id=a.class_id,
            student_id=a.student_id,
            student_name=student.name if student else "Unknown",
            matric_number=student.matric_number if student else None,
            motivation=a.motivation,
            status=a.status,
            applied_at=a.applied_at,
        ))
    return result


# ── Lecturer: select exactly 2 tutors ─────────────────────────────────────────
@router.post("/{class_id}/select")
def select_tutors(
    class_id: int,
    payload: SelectTutorsRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_lecturer),
):
    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    if not class_ or class_.lecturer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if len(payload.student_ids) != 2:
        raise HTTPException(status_code=400, detail="You must select exactly 2 tutors")

    # Reset all existing approved/rejected for this class
    all_apps = db.query(models.TutorApplication).filter(
        models.TutorApplication.class_id == class_id,
    ).all()

    selected_info = []
    rejected_info = []

    for a in all_apps:
        student = db.query(models.User).filter(models.User.id == a.student_id).first()
        if a.student_id in payload.student_ids:
            a.status = models.TutorApplicationStatusEnum.approved
            if student:
                selected_info.append((student.email, student.name))
                push(db, student.id, type="announcement",
                     title="You're a Peer Tutor!",
                     body=f"You've been selected as a tutor for {class_.name}",
                     link=f"/student/hub/{class_id}")
        else:
            a.status = models.TutorApplicationStatusEnum.rejected
            if student:
                rejected_info.append((student.email, student.name))
                push(db, student.id, type="announcement",
                     title="Tutor Application Update",
                     body=f"Your tutor application for {class_.name} was not selected this time",
                     link=f"/student/hub/{class_id}")

    db.commit()

    course_name = class_.name

    def _notify_selected(info, course):
        from app.services.email_service import send_tutor_selected
        for email, name in info:
            send_tutor_selected(email, name, course)

    def _notify_rejected(info, course):
        from app.services.email_service import send_tutor_rejected
        for email, name in info:
            send_tutor_rejected(email, name, course)

    background_tasks.add_task(_notify_selected, selected_info, course_name)
    background_tasks.add_task(_notify_rejected, rejected_info, course_name)

    return {"message": "Tutors selected", "selected": payload.student_ids}


# ── Tutor: broadcast message ───────────────────────────────────────────────────
@router.post("/{class_id}/broadcast", response_model=HubBroadcastOut, status_code=201)
def broadcast_message(
    class_id: int,
    payload: HubBroadcastCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only tutors can broadcast")

    if current_user.id not in _approved_tutor_ids(class_id, db):
        raise HTTPException(status_code=403, detail="You are not a tutor for this course")

    broadcast = models.HubBroadcast(
        class_id=class_id,
        tutor_id=current_user.id,
        message=payload.message,
    )
    db.add(broadcast)
    db.flush()

    enrolled = db.query(models.Enrollment).filter(
        models.Enrollment.class_id == class_id
    ).all()
    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    for e in enrolled:
        if e.student_id != current_user.id:
            push(db, e.student_id, type="announcement",
                 title=f"Tutor message in {class_.name if class_ else 'your course'}",
                 body=payload.message[:80] + ("..." if len(payload.message) > 80 else ""),
                 link=f"/student/hub/{class_id}")

    db.commit()
    db.refresh(broadcast)
    return _broadcast_out(broadcast, db)


# ── Tutor: start live session ──────────────────────────────────────────────────
@router.post("/{class_id}/start-live", response_model=HubLiveSessionOut, status_code=201)
def start_live_session(
    class_id: int,
    payload: HubLiveSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != models.RoleEnum.student:
        raise HTTPException(status_code=403, detail="Only tutors can start live sessions")

    if current_user.id not in _approved_tutor_ids(class_id, db):
        raise HTTPException(status_code=403, detail="You are not a tutor for this course")

    existing = db.query(models.HubLiveSession).filter(
        models.HubLiveSession.class_id == class_id,
        models.HubLiveSession.status == "active",
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A live session is already active for this course")

    session = models.HubLiveSession(
        class_id=class_id,
        tutor_id=current_user.id,
        title=payload.title,
        status="active",
    )
    db.add(session)
    db.flush()
    session.jitsi_room = _jitsi_room(class_id, current_user.id, session.id)

    enrolled = db.query(models.Enrollment).filter(
        models.Enrollment.class_id == class_id
    ).all()
    class_ = db.query(models.Class).filter(models.Class.id == class_id).first()
    for e in enrolled:
        if e.student_id != current_user.id:
            push(db, e.student_id, type="announcement",
                 title=f"Live tutorial started — {class_.name if class_ else ''}",
                 body=f"{payload.title} · Join now!",
                 link=f"/student/hub/{class_id}")

    db.commit()
    db.refresh(session)
    return _live_out(session, db)


# ── Tutor: end live session ────────────────────────────────────────────────────
@router.patch("/{class_id}/end-live/{session_id}", response_model=HubLiveSessionOut)
def end_live_session(
    class_id: int,
    session_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    session = db.query(models.HubLiveSession).filter(
        models.HubLiveSession.id == session_id,
        models.HubLiveSession.class_id == class_id,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.tutor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the tutor who started this session can end it")

    from datetime import datetime
    session.status = "ended"
    session.ended_at = datetime.utcnow()
    db.commit()
    db.refresh(session)
    return _live_out(session, db)
