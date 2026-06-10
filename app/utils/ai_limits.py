"""Central rate limiting for Claude/AI calls.

Protects the Anthropic subscription with:
  • per-user daily limits per feature, and
  • a global daily cap across the whole app.

Every Claude call should go through `enforce_ai_quota(...)` first.
"""

import os
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

import app.models as models

# Per-user daily limits by operation kind
PER_USER_DAILY = {
    "chat":                 int(os.environ.get("AI_LIMIT_CHAT", "30")),
    "quiz_generate":        int(os.environ.get("AI_LIMIT_QUIZ_GEN", "20")),
    "assignment_generate":  int(os.environ.get("AI_LIMIT_ASSIGN_GEN", "20")),
    "assignment_grade":     int(os.environ.get("AI_LIMIT_GRADE", "300")),
    "lecture_prep":         int(os.environ.get("AI_LIMIT_LECTURE_PREP", "20")),
}
DEFAULT_PER_USER = 20

# Global safety cap across ALL users per day — the hard ceiling on spend.
GLOBAL_DAILY_CAP = int(os.environ.get("AI_GLOBAL_DAILY_CAP", "1500"))


def _today_start() -> datetime:
    return datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)


def enforce_ai_quota(db: Session, user_id: int, kind: str, record: bool = True) -> None:
    """Raise 429 if the user's daily limit for `kind` or the global daily cap is reached.
    On success (and when `record`), logs one usage row."""
    start = _today_start()
    per_user = PER_USER_DAILY.get(kind, DEFAULT_PER_USER)

    user_today = db.query(models.AIUsage).filter(
        models.AIUsage.user_id == user_id,
        models.AIUsage.kind == kind,
        models.AIUsage.created_at >= start,
    ).count()
    if user_today >= per_user:
        raise HTTPException(
            status_code=429,
            detail=f"You've reached today's AI limit for this feature ({per_user}/day). Please try again tomorrow.",
        )

    global_today = db.query(models.AIUsage).filter(
        models.AIUsage.created_at >= start,
    ).count()
    if global_today >= GLOBAL_DAILY_CAP:
        raise HTTPException(
            status_code=429,
            detail="The AI service is at capacity right now. Please try again later.",
        )

    if record:
        db.add(models.AIUsage(user_id=user_id, kind=kind))
        db.commit()
