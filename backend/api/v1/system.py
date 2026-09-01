from fastapi import APIRouter
import platform
import psutil
import os
import sys
import datetime
from .about import _STARTUP_TIME

router = APIRouter()

@router.get("/diagnostics", summary="Get live backend system diagnostics")
def get_diagnostics():
    os_name = platform.system()
    os_release = platform.release()
    architecture = platform.machine()
    cpu_model = platform.processor() or "Unknown"
    os_version = platform.version()

    python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    
    delta = datetime.datetime.now() - _STARTUP_TIME
    h, rem = divmod(int(delta.total_seconds()), 3600)
    m, s = divmod(rem, 60)
    server_uptime = f"{h}h {m}m {s}s"

    ram = psutil.virtual_memory()
    total_ram_gb = round(ram.total / (1024**3), 1)
    available_ram_gb = round(ram.available / (1024**3), 1)

    base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    db_path = os.path.join(base, "pharma_db.sqlite")
    db_size_bytes = os.path.getsize(db_path) if os.path.exists(db_path) else 0
    db_size_human = f"{round(db_size_bytes / 1024, 1)} KB" if db_size_bytes < 1024 * 1024 else f"{round(db_size_bytes / (1024 * 1024), 2)} MB"

    disk = psutil.disk_usage(os.path.abspath("."))
    total_disk_gb = round(disk.total / (1024**3), 1)
    used_disk_gb = round(disk.used / (1024**3), 1)
    disk_used_percent = disk.percent

    return {
        "os_name": f"{os_name} {os_release}",
        "architecture": architecture,
        "cpu_model": cpu_model,
        "os_version": os_version,
        "python_version": python_version,
        "server_uptime": server_uptime,
        "total_ram_gb": total_ram_gb,
        "available_ram_gb": available_ram_gb,
        "db_file": "pharma_db.sqlite",
        "db_size_human": db_size_human,
        "disk_total_gb": total_disk_gb,
        "disk_used_gb": used_disk_gb,
        "disk_used_percent": disk_used_percent,
        "backend_port": 8000,
        "frontend_port": 3000
    }
