from pydantic import BaseModel
from typing import Optional

class BackupSettingsBase(BaseModel):
    IsAutoBackupEnabled: bool = False
    BackupFrequency: str = "Daily"
    BackupTime: str = "23:00"
    BackupLocation: str = "./backups/automatic"
    RetentionCount: Optional[int] = 7
    BackupOnStartup: Optional[bool] = False
    CompressBackup: Optional[bool] = True
    AutoVerify: Optional[bool] = False

class BackupSettingsResponse(BackupSettingsBase):
    SettingsId: int

    class Config:
        from_attributes = True

class BackupSettingsUpdate(BackupSettingsBase):
    pass
