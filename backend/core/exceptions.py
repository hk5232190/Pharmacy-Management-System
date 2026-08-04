from fastapi import Request
from fastapi.responses import JSONResponse
from core.logger import logger

class PMSException(Exception):
    """Base exception class for all PMS application errors."""
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code

class NotFoundError(PMSException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(message, status_code=404)

class ValidationError(PMSException):
    def __init__(self, message: str = "Invalid input provided"):
        super().__init__(message, status_code=422)

class LicenseError(PMSException):
    def __init__(self, message: str = "License validation failed", error_code: str = "LICENSE_ERROR"):
        self.error_code = error_code
        super().__init__(message, status_code=403)

class LicenseExpiredError(LicenseError):
    def __init__(self):
        super().__init__("The license has expired.", error_code="LICENSE_EXPIRED")

class HardwareMismatchError(LicenseError):
    def __init__(self):
        super().__init__("The license is not valid for this machine.", error_code="HARDWARE_MISMATCH")

class TamperedLicenseError(LicenseError):
    def __init__(self):
        super().__init__("The license file has been tampered with or is invalid.", error_code="LICENSE_TAMPERED")

class AuthenticationError(PMSException):
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message, status_code=401)

def pms_exception_handler(request: Request, exc: PMSException):
    # Log the custom application error
    logger.error(f"PMSException caught: {exc.message} (status: {exc.status_code}) | Path: {request.url.path}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": exc.message, "path": request.url.path}
    )

def general_exception_handler(request: Request, exc: Exception):
    # Log unexpected, unhandled server errors
    logger.exception(f"Unhandled Exception caught: {str(exc)} | Path: {request.url.path}")
    return JSONResponse(
        status_code=500,
        content={"success": False, "error": "Internal Server Error"}
    )
