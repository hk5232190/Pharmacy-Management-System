from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime

class BackupRequest(BaseModel):
    backup_name: str
    backup_location: str
    compress: bool

class BackupResponse(BaseModel):
    BackupId: int
    BackupName: str
    BackupLocation: str
    SizeBytes: int
    BackupType: str
    Status: str
    ChecksumSHA256: Optional[str] = None
    CreatedAt: datetime
    model_config = ConfigDict(from_attributes=True)

class RestoreRequest(BaseModel):
    backup_file_path: str

class RestoreResponse(BaseModel):
    success: bool
    message: str
