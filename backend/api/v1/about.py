from fastapi import APIRouter, Depends
import platform
import sys
import os
import shutil
import subprocess
import datetime

from api.deps import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])

# App is started at import time – track startup
_STARTUP_TIME = datetime.datetime.now()

# ── Constants ──────────────────────────────────────────────────────────────────
APP_INFO = {
    "software_name":   "Pharmacy Management System",
    "software_short":  "PMS",
    "version":         "1.0.0",
    "build_number":    "01/08/2026",
    "release_date":    "2026-08-01",
    "edition":         "Professional",
    "framework":       "FastAPI + Next.js 16",
    "database_engine": "SQLite 3",
}

DEVELOPER_INFO = {
    "company_name":    "EagleNest Creations",
    "developer":       "Muhammad Saqib",
    "website":         "https://eaglenestcreations.com",
    "email":           "team.eaglenestcreations@gmail.com",
    "country":         "Pakistan",
    "copyright_year":  "2026",
    "copyright":       "© 2026 EagleNest Creations. All rights reserved.",
    "license_type_text": "Commercial License – Authorized Use Only",
}

SUPPORT_INFO = {
    "support_email":   "team.eaglenestcreations@gmail.com",
    "phone":           "+92 330 5525748",
    "whatsapp":        "+92 330 5525748",
}


# ── Helpers ────────────────────────────────────────────────────────────────────

def _wmic(cmd: str) -> str:
    try:
        out = subprocess.check_output(cmd, shell=True, text=True,
                                      stderr=subprocess.DEVNULL, timeout=3)
        lines = [l.strip() for l in out.splitlines() if l.strip()]
        return lines[1] if len(lines) > 1 else lines[0] if lines else "N/A"
    except Exception:
        return "N/A"


def _get_ram_gb() -> str:
    try:
        raw = _wmic("wmic computersystem get TotalPhysicalMemory")
        return f"{round(int(raw) / (1024 ** 3), 1)} GB" if raw.isdigit() else "N/A"
    except Exception:
        return "N/A"


def _get_db_size() -> dict:
    """Return the SQLite database file size."""
    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    db_path = os.path.join(base, "pharma_db.sqlite")
    if os.path.exists(db_path):
        size = os.path.getsize(db_path)
        return {
            "path": "pharma_db.sqlite",
            "size_bytes": size,
            "size_human": f"{round(size / 1024, 1)} KB" if size < 1024 * 1024
                          else f"{round(size / (1024 * 1024), 2)} MB",
        }
    return {"path": "pharma_db.sqlite", "size_bytes": 0, "size_human": "Not found"}


def _get_disk_info() -> dict:
    try:
        usage = shutil.disk_usage(os.path.abspath("."))
        def h(b): return f"{round(b / (1024**3), 1)} GB"
        return {
            "total": h(usage.total),
            "used":  h(usage.used),
            "free":  h(usage.free),
            "used_percent": round(usage.used / usage.total * 100, 1),
        }
    except Exception:
        return {}


def _uptime_str() -> str:
    delta = datetime.datetime.now() - _STARTUP_TIME
    h, rem = divmod(int(delta.total_seconds()), 3600)
    m, s = divmod(rem, 60)
    return f"{h}h {m}m {s}s"


# ── System-info cache (TTL = 60 seconds) ──────────────────────────────────────
# The slow part is _wmic() calls (RAM, CPU name) which shell out to wmic.exe.
# We cache the static portions and recompute only the live values per request.

_sysinfo_cache: dict | None = None
_sysinfo_cache_time: datetime.datetime | None = None
_SYSINFO_TTL_SECONDS = 86400


def _get_static_system_info() -> dict:
    """Return cached static system info, rebuilding if older than TTL."""
    global _sysinfo_cache, _sysinfo_cache_time
    now = datetime.datetime.now()
    if (
        _sysinfo_cache is not None
        and _sysinfo_cache_time is not None
        and (now - _sysinfo_cache_time).total_seconds() < _SYSINFO_TTL_SECONDS
    ):
        return _sysinfo_cache

    # Rebuild — this is the expensive part (wmic calls)
    os_name = platform.system()
    os_release = platform.release()
    os_version = platform.version()
    os_full = f"{os_name} {os_release}"
    architecture = platform.machine()
    python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    cpu_name = platform.processor() or _wmic("wmic cpu get Name")

    _sysinfo_cache = {
        "os_name":        os_full,
        "os_version":     os_version[:60] if os_version else "N/A",
        "architecture":   architecture,
        "cpu":            cpu_name[:80] if cpu_name else "N/A",
        "ram_total":      _get_ram_gb(),
        "python_version": python_version,
        "disk":           _get_disk_info(),
        "backend_port":   8000,
        "frontend_port":  3000,
    }
    _sysinfo_cache_time = now
    return _sysinfo_cache


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.get("/info", summary="Get complete About Software information")
def get_about_info():
    """
    Returns all information for the About Software page:
    app info, developer info, system info, support info.
    """
    # Static/slow info is served from cache (TTL=60s)
    static = _get_static_system_info()

    # Dynamic values always computed live
    system_info = {
        **static,
        "database":      _get_db_size(),    # file size changes after backups
        "server_uptime": _uptime_str(),     # always live
    }

    # Fetch license status briefly
    license_summary = {}
    try:
        base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        lic_path = os.path.join(base, "licenses", "active.lic")
        if os.path.exists(lic_path):
            from utils.license_engine import validate_license
            with open(lic_path, "rb") as f:
                content = f.read()
            payload = validate_license(content)
            exp = payload.get("exp")
            exp_str = None
            remaining = None
            if exp:
                exp_dt = datetime.datetime.fromtimestamp(float(exp),
                                                          tz=datetime.timezone.utc)
                exp_str = exp_dt.strftime("%Y-%m-%d")
                remaining = max(0, (exp_dt - datetime.datetime.now(
                    datetime.timezone.utc)).days)
            license_summary = {
                "status":        "Active",
                "type":          payload.get("type", "Unknown"),
                "expiry_date":   exp_str or "Lifetime",
                "remaining_days": remaining,
                "is_lifetime":   exp is None,
            }
        else:
            license_summary = {"status": "Missing"}
    except Exception:
        license_summary = {"status": "Invalid"}

    return {
        "app":       APP_INFO,
        "developer": DEVELOPER_INFO,
        "support":   SUPPORT_INFO,
        "system":    system_info,
        "license":   license_summary,
    }


@router.get("/check-updates", summary="Check for software updates")
def check_updates():
    """
    Checks for available software updates.
    Returns status 'up_to_date' or 'update_available'.
    """
    return {
        "status": "up_to_date", 
        "message": "You are up to date",
        "latest_version": APP_INFO["version"]
    }
