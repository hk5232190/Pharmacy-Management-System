"""Orchestrate the isolated test environment.

Flow:
    1. Reset + copy the clean baseline DB into the temp test dir.
    2. Start the backend against it on TEST_PORT.
    3. Run pytest (backend/tests) against the running server.
    4. Stop the server regardless of test outcome.

Usage:
    python -m testenv.run_tests [pytest ...extra-args]
"""
import os
import subprocess
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import setup_test_db as env
from run_test_server import server_ready, stop


def main() -> int:
    stop()
    env.setup()

    os_env = dict(__import__("os").environ)
    os_env["DATABASE_URL"] = env.database_url()
    os_env["SECRET_KEY"] = env.TEST_SECRET_KEY
    os_env["PYTHONUNBUFFERED"] = "1"

    env.OUT_LOG.parent.mkdir(parents=True, exist_ok=True)
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
            env=os_env,
            stdout=out,
            stderr=err,
            creationflags=getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0),
        )
    env.PID_FILE.write_text(str(proc.pid))

    try:
        if not server_ready():
            print("Test-server-FAILED to become ready; skipping tests.")
            if env.ERR_LOG.exists():
                lines = env.ERR_LOG.read_text(encoding="utf-8", errors="replace").splitlines()
                print("\n".join(lines[-40:]))
            return 1

        print(f"Test-server-ready: {env.SERVER_URL}")
        pytest_args = ["-m", "pytest", "-q"]
        if sys.argv[1:]:
            pytest_args = ["-m", "pytest", "-v"] + sys.argv[1:]
        return subprocess.call([sys.executable] + pytest_args, cwd=str(env.BACKEND_DIR))
    finally:
        if env.PID_FILE.exists():
            time.sleep(0.5)
            stop()


if __name__ == "__main__":
    sys.exit(main())