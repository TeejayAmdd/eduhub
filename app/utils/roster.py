"""Shared helpers for paginating enrolled students with search.

Used by CA, quiz results and assignment roster so large courses (1000+
students) load one page at a time instead of all at once.
"""

from sqlalchemy import or_
from sqlalchemy.orm import Session

import app.models as models

DEFAULT_LIMIT = 50
MAX_LIMIT = 100


def clamp_page(limit: int, offset: int) -> tuple[int, int]:
    limit = max(1, min(int(limit or DEFAULT_LIMIT), MAX_LIMIT))
    offset = max(0, int(offset or 0))
    return limit, offset


def enrolled_students_query(db: Session, class_id: int, search: str = ""):
    """Base query of users enrolled in a class, optionally filtered by name/matric."""
    q = (
        db.query(models.User)
        .join(models.Enrollment, models.Enrollment.student_id == models.User.id)
        .filter(models.Enrollment.class_id == class_id)
    )
    if search and search.strip():
        like = f"%{search.strip()}%"
        q = q.filter(or_(
            models.User.name.ilike(like),
            models.User.matric_number.ilike(like),
        ))
    return q


def paginate_students(q, limit: int, offset: int):
    """Return (total, page_of_students) ordered alphabetically by name."""
    total = q.count()
    students = (
        q.order_by(models.User.name.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return total, students
