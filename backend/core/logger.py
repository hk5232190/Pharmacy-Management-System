import logging
import sys
import os
from pathlib import Path

IS_FROZEN = bool(getattr(sys, "frozen", False))
DATA_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "PMS-Data" if IS_FROZEN else Path.cwd()
if IS_FROZEN:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

log_path = DATA_DIR / "app_audit.log"

# Configure basic logger for the application
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(str(log_path))
    ]
)

logger = logging.getLogger("pms")
