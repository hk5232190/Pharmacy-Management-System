from pydantic import BaseModel
from typing import Generic, TypeVar, Optional, Any

T = TypeVar("T")

class BaseResponse(BaseModel, Generic[T]):
    """Standardized successful API response schema."""
    success: bool = True
    message: str = "Operation successful"
    data: Optional[T] = None

class ErrorResponse(BaseModel):
    """Standardized error API response schema."""
    success: bool = False
    error: str
    path: Optional[str] = None
