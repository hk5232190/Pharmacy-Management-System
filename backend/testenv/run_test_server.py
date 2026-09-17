"""Start the backend on an isolated test database.

Usage:
    python -m testenv.run_test_server [--no-restart]
"""
import os
import subprocess
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import setup_test_db as env


def server_ready(timeout: int = 90) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(env.SERVER_URL + "/", timeout=2) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            time.sleep(0.5)
    return False


def stop():
    if env.PID_FILE.exists():
        try:
            pid = int(env.PID_FILE.read_text().strip())
            subprocess.run(
                ["taskkill", "/PID", str(pid), "/F"],
                capture_output=True,
            )
        except Exception:
            pass
        env.PID_FILE.unlink(missing_ok=True)


def main(restart: bool = True) -> int:
    if restart:
        stop()

    env.setup()

    env.OUT_LOG.parent.mkdir(parents=True, exist_ok=True)
    os.environ["DATABASE_URL"] = env.database_url()
    os.environ["SECRET_KEY"] = env.TEST_SECRET_KEY
    os.environ["PYTHONUNBUFFERED"] = "1"

    with open(env.OUT_LOG, "w") as out, open(env.ERR_LOG, "w") as err:
        proc = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(env.TEST_PORT),
                "--log-level",
                "info",
            ],
            cwd=str(env.BACKEND_DIR),
            env={**os.environ},
            stdout=out,
            stderr=err,
            creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
        )
    env.PID_FILE.write_text(str(proc.pid))

    if server_ready():
        print(f"Test-server-ready: {env.SERVER_URL} (pid {proc.pid})")
        print(f"DB: {env.TEST_DB_PATH}")
        print(f"Logs: {env.OUT_LOG} / {env.ERR_LOG}")
        return 0

    print("Test-server-FAILED to become ready. err.log tail (last 40 lines):")
    if env.ERR_LOG.exists():
        lines = env.ERR_LOG.read_text(encoding="utf-8", errors="replace").splitlines()
        print("\n".join(lines[-40:]))
    return 1


if __name__ == "__main__":
    sys.exit(main())