from pydantic import BaseModel, ConfigDict
from typing import Optional

class CompanyBase(BaseModel):
    CompanyName: str
    IsActive: bool = True

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    CompanyName: Optional[str] = None
    IsActive: Optional[bool] = None

class CompanyResponse(CompanyBase):
    CompanyId: int

    model_config = ConfigDict(from_attributes=True)
