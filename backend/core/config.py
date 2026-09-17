import os
import sys
from pathlib import Path
from typing import Annotated

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator, field_validator
from pydantic_settings.sources.base import NoDecode

from core.logger import logger

IS_FROZEN = bool(getattr(sys, "frozen", False))
BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))
DATA_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "PMS-Data" if IS_FROZEN else Path.cwd()
if IS_FROZEN:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_SECRET_KEY = "super_secret_key_change_in_production"
TEST_SECRET_KEY = "test-secret-key-for-testing-only"

class Settings(BaseSettings):
    PROJECT_NAME: str = "Pharmacy Management System"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "sqlite:///./pharma_db.sqlite"
    
    # Adding security settings for the future
    SECRET_KEY: str = DEFAULT_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DEFAULT_TAX_RATE: float = 0.0
    EXPIRY_ALERT_DAYS: int = 30

    # Comma-separated list of allowed browser origins. NoDecode lets the env var
    # arrive as a raw comma string instead of forcing a JSON payload.
    CORS_ORIGINS: Annotated[list[str], NoDecode] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://tauri.localhost",
        "https://tauri.localhost",
        "tauri://localhost",
    ]

    model_config = SettingsConfigDict(
        env_file=str(DATA_DIR / ".env") if IS_FROZEN else ".env",
        extra="ignore",
    )

    @model_validator(mode="after")
    def _validate_secret_key(self) -> "Settings":
        if self.SECRET_KEY == DEFAULT_SECRET_KEY:
            logger.critical(
                "SECURITY: SECRET_KEY is set to the insecure default value. "
                "Set a strong random SECRET_KEY in backend/.env before any production deployment."
            )
        return self

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value):
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        return value

settings = Settings()