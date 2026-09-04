from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class NotificationResponse(BaseModel):
    NotificationId: int
    Type: str
    Title: str
    Message: str
    Priority: str
    RelatedModule: Optional[str] = None
    RelatedRecordId: Optional[str] = None
    EntityKey: Optional[str] = None
    ActionUrl: Optional[str] = None
    IsRead: bool
    CreatedAt: datetime

    class Config:
        from_attributes = True

class NotificationListResponse(BaseModel):
    items: List[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int
    total_pages: int

class NotificationUnreadCountResponse(BaseModel):
    unread_count: int
