"""
One-time migration: SQLite → PostgreSQL
Run from the eduhub/ folder:
    python migrate_sqlite_to_postgres.py
"""
import sqlite3
import sys
from sqlalchemy import create_engine, text

SQLITE_URL = "sqlite:///./eduhub.db"
# Reads POSTGRES url from .env
from app.config import settings
PG_URL = settings.DATABASE_URL

if PG_URL.startswith("sqlite"):
    print("ERROR: DATABASE_URL in .env is still pointing to SQLite. Update it to PostgreSQL first.")
    sys.exit(1)

# Use superuser for migration so we can disable FK triggers
import re
pg_super_url = re.sub(r"postgresql://[^@]+@", "postgresql://postgres:@", PG_URL)
postgres_password = input("Enter your postgres superuser password: ")
pg_super_url = re.sub(r"postgresql://postgres:@", f"postgresql://postgres:{postgres_password}@", pg_super_url)

# Tables in insertion order (parents before children)
TABLES = [
    "users",
    "classes",
    "enrollments",
    "assignments",
    "submissions",
    "attendance",
    "schedules",
    "exams",
    "exam_results",
    "lectures",
    "messages",
    "notifications",
    "announcements",
    "live_sessions",
    "attendance_cookies",
    "cookie_responses",
    "quizzes",
    "quiz_questions",
    "quiz_attempts",
    "course_materials",
    "tutor_applications",
    "hub_broadcasts",
    "hub_live_sessions",
    "weekly_digest_log",
]

sqlite_conn = sqlite3.connect("./eduhub.db")
sqlite_conn.row_factory = sqlite3.Row
pg_engine = create_engine(pg_super_url)

total_rows = 0

with pg_engine.begin() as pg_conn:
    # Disable FK trigger checks for the migration (superuser only)
    pg_conn.execute(text("SET session_replication_role = replica;"))

    for table in TABLES:
        # Check table exists in SQLite
        check = sqlite_conn.execute(
            f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'"
        ).fetchone()
        if not check:
            print(f"  SKIP  {table} (not in SQLite)")
            continue

        rows = sqlite_conn.execute(f"SELECT * FROM {table}").fetchall()
        if not rows:
            print(f"  EMPTY {table}")
            continue

        columns = [desc[0] for desc in sqlite_conn.execute(f"SELECT * FROM {table} LIMIT 0").description]
        col_list = ", ".join(f'"{c}"' for c in columns)
        placeholders = ", ".join(f":{c}" for c in columns)

        data = [dict(row) for row in rows]

        # PostgreSQL needs True/False not 1/0 for booleans — convert
        bool_cols = [c for c in columns if any(
            kw in c for kw in ["is_", "has_", "published", "verified", "active", "locked"]
        )]
        for row in data:
            for col in bool_cols:
                if col in row and row[col] is not None:
                    row[col] = bool(row[col])

        pg_conn.execute(
            text(f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'),
            data,
        )

        # Sync the PostgreSQL sequence so future auto-increment IDs don't clash
        if "id" in columns:
            pg_conn.execute(text(
                f"SELECT setval(pg_get_serial_sequence('\"{table}\"', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM \"{table}\"), 1), true)"
            ))

        print(f"  OK    {table} — {len(rows)} rows")
        total_rows += len(rows)

    pg_conn.execute(text("SET session_replication_role = DEFAULT;"))

sqlite_conn.close()
print(f"\nDone. {total_rows} total rows migrated.")
