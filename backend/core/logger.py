import logging
import sys

# Configure basic logger for the application
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("app_audit.log")
    ]
)

logger = logging.getLogger("pms")
