"""Add live_sessions, attendance_cookies, cookie_responses tables
   and extend attendance table with session_id + score columns.

Revision ID: 001
Revises: (initial)
Create Date: 2026-05-11

NOTE: This project uses PostgreSQL + Base.metadata.create_all().
New tables are created automatically on server start. New columns on existing
tables are handled by _add_column_if_missing() in main.py using
ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
"""

from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── live_sessions ─────────────────────────────────────────────────────────
    op.create_table(
        "live_sessions",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("class_id", sa.Integer, sa.ForeignKey("classes.id"), nullable=False),
        sa.Column("lecturer_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status",
            sa.Enum("active", "ended", name="livesessionstatusenum"),
            nullable=False,
            server_default="active",
        ),
        sa.Column("total_cookies_sent", sa.Integer, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── attendance_cookies ────────────────────────────────────────────────────
    op.create_table(
        "attendance_cookies",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("session_id", sa.Integer, sa.ForeignKey("live_sessions.id"), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── cookie_responses ──────────────────────────────────────────────────────
    op.create_table(
        "cookie_responses",
        sa.Column("id", sa.Integer, primary_key=True, index=True),
        sa.Column("cookie_id", sa.Integer, sa.ForeignKey("attendance_cookies.id"), nullable=False),
        sa.Column("student_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("clicked_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("is_valid", sa.Boolean, server_default="false"),
    )

    # ── attendance (extend existing table) ────────────────────────────────────
    op.add_column(
        "attendance",
        sa.Column("session_id", sa.Integer, sa.ForeignKey("live_sessions.id"), nullable=True),
    )
    op.add_column(
        "attendance",
        sa.Column("score", sa.Float, nullable=True),
    )

    # Add 'partial' to the status enum (PostgreSQL-specific; SQLite is a no-op)
    op.execute("ALTER TYPE statusenum ADD VALUE IF NOT EXISTS 'partial'")


def downgrade() -> None:
    op.drop_column("attendance", "score")
    op.drop_column("attendance", "session_id")
    op.drop_table("cookie_responses")
    op.drop_table("attendance_cookies")
    op.drop_table("live_sessions")
