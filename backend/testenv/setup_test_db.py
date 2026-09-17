"""Isolated test database + shared test environment configuration.

Phase 0 safety harness. Every script in this package reuses these paths so the
backend can be exercised against a throwaway SQLite database without ever
touching the live `backend/pharma_db.sqlite`.
"""
import os
import shutil
import tempfile
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent

TEST_DIR = Path(tempfile.gettempdir()) / "pms_testdb"
TEST_DB_PATH = TEST_DIR / "pharma_db.sqlite"
CLEAN_DB = PROJECT_ROOT / "build_assets" / "clean_pharma_db.sqlite"

TEST_PORT = int(os.environ.get("TEST_PORT", "8123"))
TEST_SECRET_KEY = "test-secret-key-for-testing-only"

OUT_LOG = TEST_DIR / "out.log"
ERR_LOG = TEST_DIR / "err.log"
PID_FILE = TEST_DIR / "server.pid"

SERVER_URL = f"http://127.0.0.1:{TEST_PORT}"


def database_url() -> str:
    return f"sqlite:///{TEST_DB_PATH.as_posix()}"


def setup() -> Path:
    """Create a clean isolated copy of the baseline database."""
    TEST_DIR.mkdir(parents=True, exist_ok=True)
    for suffix in ("", "-wal", "-shm"):
        candidate = Path(str(TEST_DB_PATH) + suffix)
        if candidate.exists():
            candidate.unlink()
    shutil.copy2(CLEAN_DB, TEST_DB_PATH)
    return TEST_DB_PATH