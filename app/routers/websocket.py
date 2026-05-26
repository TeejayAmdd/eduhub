"""
WebSocket endpoint for live session attendance.

Students connect via:
  ws://<host>/ws/session/{session_id}?token=<jwt>

Connection registry shape:
  { session_id: { student_id: WebSocket } }

CORS note: Starlette's CORSMiddleware does not filter WebSocket upgrade requests.
The allowed origins are enforced by the `Origin` header check below.
"""

import asyncio
import json
from typing import Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import JWTError, jwt

from app.config import settings
from app.database import SessionLocal
import app.models as models

router = APIRouter(tags=["WebSocket"])

# ── Live-session attendance registry ─────────────────────────────────────────
# Shared registry — imported by cookie_scheduler and sessions router
registry: Dict[int, Dict[int, WebSocket]] = {}

# ── Notification push registry ────────────────────────────────────────────────
# user_id → open WebSocket connection for real-time notification delivery
notification_registry: Dict[int, WebSocket] = {}

# ── Messaging registry ────────────────────────────────────────────────────────
# user_id → open WebSocket connection for real-time message delivery & typing
message_registry: Dict[int, WebSocket] = {}

# Reference to the running event loop — captured on startup so sync code
# (e.g. push() in notifications.py) can schedule async WS sends.
_loop: Optional[asyncio.AbstractEventLoop] = None


def set_event_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


async def _send_notification_ws(user_id: int, data: dict) -> None:
    ws = notification_registry.get(user_id)
    if ws:
        try:
            await ws.send_json(data)
        except Exception:
            notification_registry.pop(user_id, None)


def push_notification_ws(user_id: int, data: dict) -> None:
    """Sync-callable: fire-and-forget WS push to a connected user."""
    if _loop and _loop.is_running():
        asyncio.run_coroutine_threadsafe(_send_notification_ws(user_id, data), _loop)


async def _send_message_ws(user_id: int, data: dict) -> None:
    ws = message_registry.get(user_id)
    if ws:
        try:
            await ws.send_json(data)
        except Exception:
            message_registry.pop(user_id, None)


def push_message_ws(user_id: int, data: dict) -> None:
    """Sync-callable: push a real-time message/event to a connected user."""
    if _loop and _loop.is_running():
        asyncio.run_coroutine_threadsafe(_send_message_ws(user_id, data), _loop)

_ALLOWED_ORIGINS = {
    "http://localhost:3000",
    "https://v0-learning-manage.vercel.app",
}


def _decode_token(token: str) -> Optional[int]:
    """Return user_id from a valid JWT, or None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        uid = payload.get("sub")
        return int(uid) if uid is not None else None
    except (JWTError, ValueError):
        return None


async def broadcast_to_session(session_id: int, data: dict) -> None:
    """
    Send a JSON message to every student connected to session_id.
    Dead connections are pruned silently.
    """
    if session_id not in registry:
        return

    dead: List[int] = []
    for student_id, ws in list(registry[session_id].items()):
        try:
            await ws.send_json(data)
        except Exception:
            dead.append(student_id)

    for sid in dead:
        registry[session_id].pop(sid, None)

    if session_id in registry and not registry[session_id]:
        registry.pop(session_id, None)


@router.websocket("/ws/session/{session_id}")
async def websocket_session(
    websocket: WebSocket,
    session_id: int,
    token: str = Query(..., description="JWT access token"),
):
    # ── Origin check ──────────────────────────────────────────────────────────
    origin = websocket.headers.get("origin", "")
    if origin and origin not in _ALLOWED_ORIGINS:
        await websocket.close(code=4003)
        return

    # ── Auth ──────────────────────────────────────────────────────────────────
    user_id = _decode_token(token)
    if user_id is None:
        await websocket.close(code=4001)
        return

    # ── Verify session is active ───────────────────────────────────────────────
    db = SessionLocal()
    try:
        session = db.query(models.LiveSession).filter(
            models.LiveSession.id == session_id
        ).first()
        if not session or session.status == models.LiveSessionStatusEnum.ended:
            await websocket.close(code=4004)
            return
    finally:
        db.close()

    # ── Accept & register ──────────────────────────────────────────────────────
    await websocket.accept()

    if session_id not in registry:
        registry[session_id] = {}
    registry[session_id][user_id] = websocket

    try:
        # Hold the connection open; students interact via REST (cookie clicks).
        # We still receive to handle client pings and detect clean disconnects.
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        if session_id in registry:
            registry[session_id].pop(user_id, None)
            if not registry[session_id]:
                registry.pop(session_id, None)


@router.websocket("/ws/notifications")
async def websocket_notifications(
    websocket: WebSocket,
    token: str = Query(...),
):
    origin = websocket.headers.get("origin", "")
    if origin and origin not in _ALLOWED_ORIGINS:
        await websocket.close(code=4003)
        return

    user_id = _decode_token(token)
    if user_id is None:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    notification_registry[user_id] = websocket

    try:
        # Keep connection alive; client sends pings, we echo pong
        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    finally:
        notification_registry.pop(user_id, None)


@router.websocket("/ws/messages")
async def websocket_messages(
    websocket: WebSocket,
    token: str = Query(...),
):
    origin = websocket.headers.get("origin", "")
    if origin and origin not in _ALLOWED_ORIGINS:
        await websocket.close(code=4003)
        return

    user_id = _decode_token(token)
    if user_id is None:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    message_registry[user_id] = websocket

    try:
        while True:
            raw = await websocket.receive_text()
            if raw == "ping":
                await websocket.send_text("pong")
                continue
            try:
                data = json.loads(raw)
            except Exception:
                continue

            if data.get("type") == "typing":
                to_id = data.get("to_user_id")
                if to_id:
                    await _send_message_ws(int(to_id), {
                        "type": "typing",
                        "from_user_id": user_id,
                        "is_typing": bool(data.get("is_typing", False)),
                    })
    except WebSocketDisconnect:
        pass
    finally:
        message_registry.pop(user_id, None)
