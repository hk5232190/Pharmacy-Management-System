import sys
import os

# ── Production vs Development detection ────────────────────────────────────
IS_FROZEN = getattr(sys, 'frozen', False)

if IS_FROZEN:
    # PyInstaller bundle: sys.executable is the .exe. For onefile builds the
    # bundled data (data_template/, frontend/) is extracted to sys._MEIPASS.
    BUNDLE_DIR = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    DATA_DIR = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~')), 'PMS-Data')
    _env_file = os.path.join(DATA_DIR, '.env')
else:
    # Development: everything relative to the backend/ directory
    BUNDLE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
    DATA_DIR = BUNDLE_DIR
    _env_file = os.path.join(BUNDLE_DIR, '.env')

# Ensure DATA_DIR subdirectories exist
for _sub in ('logs', 'uploads/logo', 'uploads/background', 'uploads/profile', 'backups', 'licenses'):
    os.makedirs(os.path.join(DATA_DIR, _sub), exist_ok=True)

# ── Resolve database path ──────────────────────────────────────────────────
_db_path = os.path.join(DATA_DIR, 'pharma_db.sqlite')
_default_db_url = f"sqlite:///{_db_path}"

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Pharmacy Management System"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str = _default_db_url
    
    # Adding security settings for the future
    SECRET_KEY: str = "super_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    DEFAULT_TAX_RATE: float = 0.0
    EXPIRY_ALERT_DAYS: int = 30

    model_config = SettingsConfigDict(env_file=_env_file, extra="ignore")

settings = Settings()
