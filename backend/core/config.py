import os
import sys
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


IS_FROZEN = bool(getattr(sys, "frozen", False))
BUNDLE_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))
DATA_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "PMS-Data" if IS_FROZEN else Path.cwd()
if IS_FROZEN:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

class Settings(BaseSettings):
    PROJECT_NAME: str = "Pharmacy Management System"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = "sqlite:///./pharma_db.sqlite"
    
    # Adding security settings for the future
    SECRET_KEY: str = "super_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DEFAULT_TAX_RATE: float = 0.0
    EXPIRY_ALERT_DAYS: int = 30

    model_config = SettingsConfigDict(
        env_file=str(DATA_DIR / ".env") if IS_FROZEN else ".env",
        extra="ignore",
    )

settings = Settings()
