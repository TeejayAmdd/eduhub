from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Railway injects DATABASE_URL as postgres:// but SQLAlchemy 2.x requires postgresql://
_db_url = settings.DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    _db_url,
    pool_size=20,
    max_overflow=40,
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
