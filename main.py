from dotenv import load_dotenv
load_dotenv()  # ensure .env values are in os.environ before any router imports

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.routers.auth import router as auth_router
from app.routers.students import router as students_router
from app.routers.assignments import router as assignments_router
from app.routers.lectures import router as lectures_router
from app.routers.notifications import router as notifications_router
from app.routers.search import router as search_router
from app.routers.other_routers import (
    classes_router,
    attendance_router,
    schedule_router,
    exams_router,
    messages_router,
    announcements_router,
    analytics_router,
    users_router,
    reports_router,
)
from app.routers.sessions import router as sessions_router, cookies_router, classes_live_router
from app.routers.websocket import router as websocket_router
from app.routers.quizzes import router as quizzes_router
from app.routers.hub import router as hub_router
from app.routers.materials import router as materials_router
from app.routers.converter import router as converter_router
from app.routers.ai import router as ai_router
from app.routers.lecture_prep import router as lecture_prep_router

# Ensure new models are registered with Base metadata before create_all
import app.models  # noqa: F401 — side-effect import registers LiveSession, AttendanceCookie, CookieResponse

from sqlalchemy import text

def _add_column_if_missing(table: str, column: str, col_def: str):
    with engine.connect() as conn:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {col_def}"))
        conn.commit()

def _run_db_migrations():
    """Create tables and apply incremental column migrations. Called inside startup_event."""
    Base.metadata.create_all(bind=engine)
    _add_column_if_missing("classes",      "level",           "VARCHAR(20)")
    _add_column_if_missing("assignments",  "submission_type", "VARCHAR(50) DEFAULT 'any'")
    _add_column_if_missing("lectures",     "jitsi_room",      "VARCHAR(200)")
    _add_column_if_missing("attendance",   "session_id",      "INTEGER")
    _add_column_if_missing("attendance",   "score",           "REAL")
    _add_column_if_missing("attendance",   "lecture_id",      "INTEGER")
    _add_column_if_missing("live_sessions","lecture_id",      "INTEGER")
    _add_column_if_missing("users",        "is_verified",     "BOOLEAN DEFAULT TRUE")
    _add_column_if_missing("quiz_attempts","answers",         "TEXT")
    _add_column_if_missing("quiz_attempts","score",           "INTEGER")
    _add_column_if_missing("quiz_attempts","total",           "INTEGER")
    _add_column_if_missing("schedules",    "is_locked",       "BOOLEAN DEFAULT FALSE")
    _add_column_if_missing("messages",     "is_pinned",       "BOOLEAN DEFAULT FALSE")
    _add_column_if_missing("messages",     "forwarded_from_id","INTEGER")
    _add_column_if_missing("messages",     "attachment_path", "VARCHAR(500)")
    _add_column_if_missing("messages",     "attachment_name", "VARCHAR(300)")
    _add_column_if_missing("messages",     "attachment_type", "VARCHAR(100)")
    _add_column_if_missing("messages",     "attachment_size", "INTEGER")
    _add_column_if_missing("messages",     "attachment_data", "BYTEA")
    _add_column_if_missing("course_materials", "file_data", "BYTEA")
    # lecture_prep_history columns added after the table's first deploy
    _add_column_if_missing("lecture_prep_history", "class_name",  "VARCHAR(200)")
    _add_column_if_missing("lecture_prep_history", "course_code", "VARCHAR(50)")
    _add_column_if_missing("lecture_prep_history", "slide_data",  "JSON")
    # AI chat history table is created by create_all; no extra columns needed

app = FastAPI(
    title="Cortex API",
    description="Backend API for the Cortex Learning Platform",
    version="1.0.0",
)


def _run_weekly_digest_startup():
    """Run once on startup: if we haven't sent the weekly digest for this Monday, send it now."""
    from datetime import date, datetime, timedelta
    from sqlalchemy.orm import Session
    from app.database import SessionLocal
    import app.models as models
    from app.routers.other_routers import _get_week_bounds, _ensure_week_lectures, _build_rows
    from app.utils.notifications import push
    from app.services.email_service import send_weekly_timetable

    db: Session = SessionLocal()
    try:
        monday, sunday = _get_week_bounds()

        # Check if digest already sent this week
        already_sent = db.query(models.WeeklyDigestLog).filter(
            models.WeeklyDigestLog.week_start == monday
        ).first()
        if already_sent:
            return

        week_label = f"{monday.strftime('%d %b')} – {sunday.strftime('%d %b %Y')}"
        total_recipients = 0

        # Auto-create this week's lectures for every lecturer
        lecturers = db.query(models.User).filter(
            models.User.role == models.RoleEnum.lecturer,
            models.User.is_active == True,
        ).all()
        for lecturer in lecturers:
            own_ids = (
                db.query(models.Class.id)
                .filter(models.Class.lecturer_id == lecturer.id)
                .subquery()
            )
            slots = db.query(models.Schedule).filter(
                models.Schedule.class_id.in_(own_ids)
            ).all()
            _ensure_week_lectures(db, slots, monday)
            rows = _build_rows(db, slots, monday, 'enrolled_count')
            if not rows:
                continue
            push(db, lecturer.id, type="schedule",
                 title=f"Your teaching timetable: {week_label}",
                 body=f"{len(rows)} class slot(s) this week",
                 link="/schedule")
            send_weekly_timetable(lecturer.email, lecturer.name, week_label, rows, 'lecturer')
            total_recipients += 1

        db.commit()

        # Send to all active students
        students = db.query(models.User).filter(
            models.User.role == models.RoleEnum.student,
            models.User.is_active == True,
        ).all()
        for student in students:
            stu_ids = {
                e.class_id for e in db.query(models.Enrollment)
                .filter(models.Enrollment.student_id == student.id).all()
            }
            if not stu_ids:
                continue
            stu_slots = db.query(models.Schedule).filter(
                models.Schedule.class_id.in_(stu_ids)
            ).all()
            rows = _build_rows(db, stu_slots, monday, 'lecturer_name')
            if not rows:
                continue
            push(db, student.id, type="schedule",
                 title=f"Your timetable: {week_label}",
                 body=f"{len(rows)} class slot(s) this week",
                 link="/student/schedule")
            send_weekly_timetable(student.email, student.name, week_label, rows, 'student')
            total_recipients += 1

        db.commit()

        # Log that we've sent it
        log_entry = models.WeeklyDigestLog(
            week_start=monday,
            recipient_count=total_recipients,
        )
        db.add(log_entry)
        db.commit()

    except Exception as exc:
        import logging
        logging.getLogger(__name__).error("Weekly digest startup failed: %s", exc)
    finally:
        db.close()


@app.on_event("startup")
async def startup_event():
    import asyncio
    import threading

    # Run DB migrations synchronously first (uvicorn is already listening at this point)
    _run_db_migrations()

    # Capture the running event loop so sync code can schedule WS pushes
    from app.routers.websocket import set_event_loop
    set_event_loop(asyncio.get_event_loop())

    # Run weekly digest in background thread (non-blocking)
    t = threading.Thread(target=_run_weekly_digest_startup, daemon=True)
    t.start()

# CORS — allow the frontend to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",                        # Next.js local dev   
        "https://eduhub-lasu.netlify.app",              # Netlify (old name)
        "https://cortex-lasu.netlify.app",              # Netlify frontend (current)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all routers
app.include_router(auth_router)
app.include_router(classes_router)
app.include_router(students_router)
app.include_router(assignments_router)
app.include_router(lectures_router)
app.include_router(attendance_router)
app.include_router(schedule_router)
app.include_router(exams_router)
app.include_router(messages_router)
app.include_router(announcements_router)
app.include_router(analytics_router)
app.include_router(notifications_router)
app.include_router(search_router)
app.include_router(users_router)
app.include_router(sessions_router)
app.include_router(cookies_router)
app.include_router(classes_live_router)
app.include_router(websocket_router)
app.include_router(quizzes_router)
app.include_router(hub_router)
app.include_router(materials_router)
app.include_router(reports_router)
app.include_router(converter_router)
app.include_router(ai_router)
app.include_router(lecture_prep_router)


@app.get("/")
def root():
    return {"message": "EduHub API is running", "docs": "/docs"}
