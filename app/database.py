from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

if _is_sqlite:
    # SQLite — dev/testing only, no pooling
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
else:
    # PostgreSQL — production settings
    engine = create_engine(
        settings.DATABASE_URL,
        pool_size=20,        # persistent connections kept open
        max_overflow=40,     # extra connections allowed under burst load
        pool_timeout=30,     # wait up to 30s for a free connection
        pool_pre_ping=True,  # drop stale connections automatically
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
