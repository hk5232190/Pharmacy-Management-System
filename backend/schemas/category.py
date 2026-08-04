from pydantic import BaseModel, ConfigDict
from typing import Optional

class CategoryBase(BaseModel):
    CategoryName: str
    IsActive: bool = True

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    CategoryName: Optional[str] = None
    IsActive: Optional[bool] = None

class CategoryResponse(CategoryBase):
    CategoryId: int

    model_config = ConfigDict(from_attributes=True)
