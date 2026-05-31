import os
from urllib.parse import quote_plus

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings


def _build_db_url() -> str:
    # Railway's PostgreSQL plugin always injects individual PG* vars.
    # Use them directly to avoid DATABASE_URL format/parsing surprises.
    pghost = os.environ.get("PGHOST")
    if pghost:
        user = quote_plus(os.environ.get("PGUSER", "postgres"))
        password = quote_plus(os.environ.get("PGPASSWORD", ""))
        port = os.environ.get("PGPORT", "5432")
        dbname = os.environ.get("PGDATABASE", "railway")
        return f"postgresql://{user}:{password}@{pghost}:{port}/{dbname}"

    # Local dev fallback: use DATABASE_URL from .env, fixing postgres:// scheme
    return settings.DATABASE_URL.replace("postgres://", "postgresql://", 1)


engine = create_engine(
    _build_db_url(),
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
