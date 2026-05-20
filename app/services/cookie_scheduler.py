"""
Background task: dispatches N random attendance cookies during a live session.

Cookies are spread over COOKIE_WINDOW_SECONDS using random offsets.
Each cookie is visible for COOKIE_VISIBLE_SECONDS (15 s) before it expires.

For a 2-hour class, set COOKIE_WINDOW_SECONDS = 7200.
The default (600 s = 10 min) is intentionally short for quick demo/testing.
"""

import asyncio
import random
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.database import SessionLocal
import app.models as models

COOKIE_WINDOW_SECONDS: int = 600   # spread cookies across this many seconds
COOKIE_VISIBLE_SECONDS: int = 15   # how long each cookie stays on screen


async def run_cookie_scheduler(session_id: int) -> None:
    """
    Launched as a FastAPI BackgroundTask when a session starts.
    Picks N cookies, space them randomly within the window, then dispatches
    each one and waits before the next.
    """
    # Lazy import avoids a circular import at module load time
    from app.routers.websocket import broadcast_to_session

    n_cookies = random.randint(5, 10)

    # Random sorted offsets within [0, COOKIE_WINDOW_SECONDS]
    offsets = sorted(random.uniform(0, COOKIE_WINDOW_SECONDS) for _ in range(n_cookies))

    # Convert absolute offsets → relative sleep durations between dispatches
    sleep_durations = [offsets[0]] + [
        offsets[i] - offsets[i - 1] for i in range(1, n_cookies)
    ]

    dispatched = 0

    for sleep_secs in sleep_durations:
        await asyncio.sleep(sleep_secs)

        cookie_id: Optional[int] = None

        db = SessionLocal()
        try:
            # Abort early if the lecturer already ended the session
            session = db.query(models.LiveSession).filter(
                models.LiveSession.id == session_id
            ).first()
            if not session or session.status == models.LiveSessionStatusEnum.ended:
                break

            now = datetime.now(timezone.utc)
            cookie = models.AttendanceCookie(
                session_id=session_id,
                sent_at=now,
                expires_at=now + timedelta(seconds=COOKIE_VISIBLE_SECONDS),
            )
            db.add(cookie)
            db.commit()
            db.refresh(cookie)

            cookie_id = cookie.id
            dispatched += 1
        finally:
            db.close()

        if cookie_id is not None:
            await broadcast_to_session(session_id, {
                "type": "cookie",
                "cookie_id": cookie_id,
                "expires_in": COOKIE_VISIBLE_SECONDS,
            })

    # Persist the final dispatched count (may be < n_cookies if session ended early)
    db = SessionLocal()
    try:
        session = db.query(models.LiveSession).filter(
            models.LiveSession.id == session_id
        ).first()
        if session:
            session.total_cookies_sent = dispatched
            db.commit()
    finally:
        db.close()
