from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Dict
from app.database import get_db
from app.auth import get_current_user
from app.schemas import NotificationOut
from app.utils.notif_prefs import normalized, CATEGORY_DEFAULTS
import app.models as models

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


class PreferencesIn(BaseModel):
    prefs: Dict[str, bool]


@router.get("", response_model=List[NotificationOut])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .limit(30)
        .all()
    )


@router.get("/preferences")
def get_preferences(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return normalized(current_user.notification_prefs)


@router.put("/preferences")
def set_preferences(
    payload: PreferencesIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # Accept only known categories; coerce to bool. Merge into existing overrides.
    incoming = {k: bool(v) for k, v in payload.prefs.items() if k in CATEGORY_DEFAULTS}
    merged = {**(current_user.notification_prefs or {}), **incoming}
    current_user.notification_prefs = merged
    db.add(current_user)
    db.commit()
    return normalized(current_user.notification_prefs)


@router.get("/unread-count")
def unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    count = (
        db.query(models.Notification)
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read == False,
        )
        .count()
    )
    return {"count": count}


@router.patch("/{notification_id}/read")
def mark_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    notif = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"ok": True}


@router.patch("/read-all")
def mark_all_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"ok": True}
