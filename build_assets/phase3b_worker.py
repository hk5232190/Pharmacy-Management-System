# Phase 3B boot worker. ASCII only.
# Usage: venv_python pms_3b_worker.py <path-to-sqlite-copy> <label>
# Sets DATABASE_URL to the ISOLATED copy BEFORE importing main, boots the real
# FastAPI app via TestClient (runs the real startup_event: run_migrations(engine)
# + sync_system_notifications(db) + backup-on-start gating), then hits / and the
# health endpoint. Prints RESULT lines (ASCII). The copy is never the LIVE/CLEAN
# original - the parent guarantees that by construction.
import os
import sys
from pathlib import Path

db_copy = Path(sys.argv[1]).resolve()
label = sys.argv[2]

if not db_copy.exists():
    print("RESULT FAIL worker missing copy", str(db_copy))
    sys.exit(1)

# Isolated mutation on the COPY only: disable auto-backup so boot produces no
# external artifacts (backup pipeline correctness is Phase 5, out of 3B scope).
import sqlite3
con = sqlite3.connect(str(db_copy))
try:
    con.execute("UPDATE backup_settings SET IsAutoBackupEnabled = 0, BackupOnStartup = 0")
    con.commit()
finally:
    con.close()

os.environ["DATABASE_URL"] = "sqlite:///" + db_copy.as_posix()
os.chdir(str(db_copy.parent))  # matches how the real server is launched (cwd=backend)

try:
    import main  # noqa: F401  (import binds engine to the temp copy; startup runs on TestClient enter)

    from fastapi.testclient import TestClient

    with TestClient(main.app) as client:
        r_root = client.get("/")
        r_health = client.get("/api/v1/health") if hasattr(client, "get") else None
        root_ok = r_root.status_code == 200
        health_ok = r_health is not None and r_health.status_code == 200
        print("RESULT root", r_root.status_code)
        if r_health is not None:
            print("RESULT health", r_health.status_code, r_health.text[:120].replace("\n", " "))
        print("RESULT boot_ok", bool(root_ok and health_ok))
except Exception as e:
    print("RESULT BOOT_EXC", type(e).__name__, str(e)[:160])
    sys.exit(1)

# Post-boot verify against the SAME temp copy (via the app's own engine state).
try:
    from database import SessionLocal
    db = SessionLocal()
    from models import Notification
    ncount = db.query(Notification).count()
    db.close()
    stamp = None
    con = sqlite3.connect(str(db_copy))
    tabs = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    if "alembic_version" in tabs:
        row = con.execute("SELECT version_num FROM alembic_version").fetchone()
        stamp = row[0] if row else None
    con.close()
    print("RESULT stamp", stamp)
    print("RESULT notifications_seeded", ncount if ncount is not None else "ERR")
except Exception as e:
    print("RESULT VERIFY_EXC", type(e).__name__, str(e)[:160])
print("RESULT DONE", label)
