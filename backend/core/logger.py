import logging
import sys
import os

from core.config import DATA_DIR, IS_FROZEN

# Resolve log file path
_log_file = os.path.join(DATA_DIR, 'logs', 'app_audit.log') if IS_FROZEN else 'app_audit.log'

# Configure basic logger for the application
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(_log_file)
    ]
)

logger = logging.getLogger("pms")

