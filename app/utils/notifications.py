from sqlalchemy.orm import Session
import app.models as models


def push(db: Session, user_id: int, type: str, title: str, body: str = None, link: str = None):
    notif = models.Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        link=link,
    )
    db.add(notif)
    db.flush()  # get the generated ID without committing

    # Push to the user's open WebSocket if they're connected
    try:
        from app.routers.websocket import push_notification_ws
        push_notification_ws(user_id, {
            "event": "notification",
            "id": notif.id,
            "type": type,
            "title": title,
            "body": body,
            "link": link,
            "is_read": False,
            "created_at": notif.created_at.isoformat() if notif.created_at else None,
        })
    except Exception:
        pass  # WS push is best-effort — never block the main flow

    # caller is responsible for db.commit()
