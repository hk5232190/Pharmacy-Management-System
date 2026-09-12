"""
PMS Backend Launcher — Production entry point for PyInstaller sidecar.

Responsibilities:
  1. Initialize DATA_DIR (%LOCALAPPDATA%/PMS-Data) on first run
  2. Copy template database, license keys, and .env if missing
  3. Find a free port (prefer 8000, fallback to OS-assigned)
  4. Print PMS_PORT:<port> to stdout for Tauri to capture
  5. Start uvicorn on the chosen port
  6. Handle clean shutdown on SIGTERM / process kill
"""

import sys
import os
import socket
import shutil
import signal

def find_free_port(preferred: int = 8000) -> int:
    """Try the preferred port first; if busy, let the OS assign one."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        sock.bind(('127.0.0.1', preferred))
        sock.close()
        return preferred
    except OSError:
        sock.close()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
        sock.close()
        return port


def initialize_data_dir():
    """On first run, copy template files from the bundle to DATA_DIR."""
    from core.config import DATA_DIR, BUNDLE_DIR, IS_FROZEN

    if not IS_FROZEN:
        return  # Dev mode — nothing to do

    # Template database
    template_db = os.path.join(BUNDLE_DIR, 'data_template', 'pharma_db.sqlite')
    target_db = os.path.join(DATA_DIR, 'pharma_db.sqlite')
    if os.path.isfile(template_db) and not os.path.isfile(target_db):
        shutil.copy2(template_db, target_db)
        print(f"[PMS] Initialized database at {target_db}", flush=True)

    # License keys
    template_keys = os.path.join(BUNDLE_DIR, 'data_template', 'keys')
    target_keys = os.path.join(DATA_DIR, 'utils', 'keys')
    if os.path.isdir(template_keys) and not os.path.isdir(target_keys):
        os.makedirs(target_keys, exist_ok=True)
        for f in os.listdir(template_keys):
            src = os.path.join(template_keys, f)
            dst = os.path.join(target_keys, f)
            if os.path.isfile(src) and not os.path.isfile(dst):
                shutil.copy2(src, dst)

    # Licenses directory
    template_lic = os.path.join(BUNDLE_DIR, 'data_template', 'licenses')
    target_lic = os.path.join(DATA_DIR, 'licenses')
    if os.path.isdir(template_lic):
        os.makedirs(target_lic, exist_ok=True)
        for f in os.listdir(template_lic):
            src = os.path.join(template_lic, f)
            dst = os.path.join(target_lic, f)
            if os.path.isfile(src) and not os.path.isfile(dst):
                shutil.copy2(src, dst)

    # Default .env — write it with an ABSOLUTE database path so the engine
    # always resolves to the persistent DATA_DIR file, never to a relative
    # path depending on the current working directory.
    target_env = os.path.join(DATA_DIR, '.env')
    if not os.path.isfile(target_env):
        with open(target_env, 'w') as f:
            f.write(f'DATABASE_URL=sqlite:///{target_db.replace(chr(92), "/")}\n')
            f.write('EXPIRY_ALERT_DAYS=30\n')
        print(f"[PMS] Initialized config at {target_env}", flush=True)


def main():
    # Set the working directory to the bundle root (important for relative paths)
    if getattr(sys, 'frozen', False):
        os.chdir(os.path.dirname(sys.executable))

    # Initialize first-run data
    initialize_data_dir()

    # Find a free port
    port = find_free_port(8000)

    # ── CRITICAL: Print the port for Tauri to capture ──────────────────────
    print(f"PMS_PORT:{port}", flush=True)

    # Graceful shutdown handler
    def shutdown_handler(signum, frame):
        print("[PMS] Shutting down gracefully...", flush=True)
        sys.exit(0)

    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)

    # Start uvicorn
    import uvicorn
    from main import app  # Direct import so PyInstaller bundles it
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=port,
        log_level="info",
        reload=False,
    )


if __name__ == "__main__":
    main()
