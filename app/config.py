from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    JAAS_APP_ID: Optional[str] = None
    JAAS_API_KEY_ID: Optional[str] = None
    JAAS_PRIVATE_KEY_FILE: Optional[str] = None   # legacy: path to PEM file
    JAAS_PRIVATE_KEY: Optional[str] = None         # preferred: PEM content as env var

    # ── Email (Gmail SMTP) ───────────────────────────────────────────────────
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None          # your Gmail address
    SMTP_PASSWORD: Optional[str] = None      # 16-char App Password from Google
    EMAIL_FROM_NAME: str = "EduHub"

    class Config:
        env_file = ".env"


settings = Settings()
