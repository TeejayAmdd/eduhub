"""
Calculates per-student attendance scores when a live session ends.

Score = (valid_clicks / total_cookies_dispatched) * 100
  >= 70 %  → present
  >= 30 %  → partial
  <  30 %  → absent

Results are written to (or updated in) the existing `attendance` table.
Each live-session record is tagged with the session_id so it is distinct
from manually-marked attendance rows (which have session_id = NULL).
"""

from datetime import date, timezone
from typing import List

from app.database import SessionLocal
import app.models as models


def calculate_session_attendance(session_id: int) -> List[dict]:
    """
    Compute scores for all enrolled students and persist to Attendance.
    Returns a list of result dicts (also used by the API response).
    """
    db = SessionLocal()
    try:
        session = db.query(models.LiveSession).filter(
            models.LiveSession.id == session_id
        ).first()
        if not session:
            return []

        # Use the actual number of dispatched cookies (handles early-end correctly)
        total_cookies = (
            db.query(models.AttendanceCookie)
            .filter(models.AttendanceCookie.session_id == session_id)
            .count()
        )
        if total_cookies == 0:
            return []

        enrollments = (
            db.query(models.Enrollment)
            .filter(models.Enrollment.class_id == session.class_id)
            .all()
        )

        results: List[dict] = []
        today = date.today()

        for enrollment in enrollments:
            student_id = enrollment.student_id

            # Count cookies this student validly clicked for this session
            cookies_clicked = (
                db.query(models.CookieResponse)
                .join(
                    models.AttendanceCookie,
                    models.CookieResponse.cookie_id == models.AttendanceCookie.id,
                )
                .filter(
                    models.AttendanceCookie.session_id == session_id,
                    models.CookieResponse.student_id == student_id,
                    models.CookieResponse.is_valid == True,
                )
                .count()
            )

            score = (cookies_clicked / total_cookies) * 100

            if score >= 70:
                status = models.StatusEnum.present
            elif score >= 30:
                status = models.StatusEnum.partial
            else:
                status = models.StatusEnum.absent

            # Upsert: update existing record for this session, or create new
            existing = (
                db.query(models.Attendance)
                .filter(
                    models.Attendance.class_id == session.class_id,
                    models.Attendance.student_id == student_id,
                    models.Attendance.session_id == session_id,
                )
                .first()
            )
            if existing:
                existing.status = status
                existing.score = round(score, 1)
                existing.lecture_id = session.lecture_id
            else:
                db.add(models.Attendance(
                    class_id=session.class_id,
                    student_id=student_id,
                    session_id=session_id,
                    lecture_id=session.lecture_id,
                    date=today,
                    status=status,
                    score=round(score, 1),
                ))

            student = db.query(models.User).filter(models.User.id == student_id).first()
            results.append({
                "student_id": student_id,
                "name": student.name if student else "Unknown",
                "cookies_clicked": cookies_clicked,
                "total_cookies": total_cookies,
                "score": round(score, 1),
                "status": status.value,
            })

        db.commit()
        return results
    finally:
        db.close()
