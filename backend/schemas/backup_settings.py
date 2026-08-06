from pydantic import BaseModel
from typing import Optional

class BackupSettingsBase(BaseModel):
    IsAutoBackupEnabled: bool = False
    BackupFrequency: str = "Daily"
    BackupTime: str = "23:00"
    BackupLocation: str = "./backups/automatic"
    RetentionCount: int = 7
    BackupOnStartup: bool = False
    CompressBackup: bool = True

class BackupSettingsResponse(BackupSettingsBase):
    SettingsId: int

    class Config:
        from_attributes = True

class BackupSettingsUpdate(BackupSettingsBase):
    pass
