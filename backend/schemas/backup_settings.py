from pydantic import BaseModel
from typing import Optional

class BackupSettingsBase(BaseModel):
    IsAutoBackupEnabled: bool = False
    BackupFrequency: str = "Daily"       # Kept for DB compat; no longer drives a scheduler
    BackupTime: str = "23:00"            # Kept for DB compat; no longer drives a scheduler
    BackupLocation: str = "./backups/automatic"
    RetentionCount: Optional[int] = 7
    BackupOnStartup: Optional[bool] = False
    BackupOnExit: Optional[bool] = True  # Backup on logout / window close
    CompressBackup: Optional[bool] = True
    AutoVerify: Optional[bool] = False

class BackupSettingsResponse(BackupSettingsBase):
    SettingsId: int

    class Config:
        from_attributes = True

class BackupSettingsUpdate(BackupSettingsBase):
    pass
