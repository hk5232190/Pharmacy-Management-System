"""Stop the backend test server started by testenv.run_test_server."""
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import setup_test_db as env


def main() -> int:
    if not env.PID_FILE.exists():
        print("No test server running (no pid file).")
        return 0
    try:
        pid = int(env.PID_FILE.read_text().strip())
    except ValueError:
        print("Invalid pid file; removing.")
        env.PID_FILE.unlink(missing_ok=True)
        return 0
    result = subprocess.run(["taskkill", "/PID", str(pid), "/F"], capture_output=True)
    env.PID_FILE.unlink(missing_ok=True)
    if result.returncode == 0:
        print(f"Stopped test server (pid {pid}).")
        return 0
    print(f"Failed to stop pid {pid}: {result.stderr.decode(errors='replace')}")
    return 1


if __name__ == "__main__":
    sys.exit(main())