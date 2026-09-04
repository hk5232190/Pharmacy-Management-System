from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from typing import Optional
from datetime import datetime

from models import Notification, AuditLog
from schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    NotificationUnreadCountResponse
)
from api.deps import get_current_user, get_db
from utils.notification_service import sync_system_notifications
from core.logger import logger

router = APIRouter()

# In-memory timestamp to debounce auto-sync (max once every 20 seconds per server)
_last_sync_time: Optional[datetime] = None


def _maybe_auto_sync(db: Session):
    global _last_sync_time
    now = datetime.utcnow()
    if _last_sync_time is None or (now - _last_sync_time).total_seconds() > 20:
        try:
            sync_system_notifications(db)
            _last_sync_time = now
        except Exception as e:
            logger.error(f"Error during debounced notification sync: {e}")


@router.get("", response_model=NotificationListResponse, summary="Get paginated notifications with filters")
def get_notifications(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    status: str = Query("all", description="Filter by status: 'all', 'unread', 'read'"),
    category: Optional[str] = Query(None, description="Category filter: 'stock', 'expiry', 'license', 'backup', 'all'"),
    priority: Optional[str] = Query(None, description="Priority filter: 'Critical', 'High', 'Normal', 'Low'"),
    search: Optional[str] = Query(None, description="Search term in Title or Message"),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    # Run debounced real-time state check
    _maybe_auto_sync(db)

    query = db.query(Notification)

    # Status filter
    if status == "unread":
        query = query.filter(Notification.IsRead == False)
    elif status == "read":
        query = query.filter(Notification.IsRead == True)

    # Category/Type filter
    if category and category.lower() != "all":
        cat = category.lower()
        if cat == "stock":
            query = query.filter(Notification.Type.in_(["OUT_OF_STOCK", "LOW_STOCK"]))
        elif cat == "expiry":
            query = query.filter(Notification.Type.in_(["EXPIRED_MEDICINE", "EXPIRING_SOON"]))
        elif cat == "license":
            query = query.filter(Notification.Type == "LICENSE_ALERT")
        elif cat == "backup":
            query = query.filter(Notification.Type.in_(["BACKUP_SUCCESS", "BACKUP_FAILED"]))
        elif cat == "security":
            query = query.filter(Notification.Type == "SECURITY_ALERT")

    # Priority filter
    if priority and priority.lower() != "all":
        query = query.filter(Notification.Priority == priority)

    # Search filter
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Notification.Title.ilike(term),
                Notification.Message.ilike(term),
                Notification.RelatedModule.ilike(term)
            )
        )

    total = query.count()
    unread_count = db.query(Notification).filter(Notification.IsRead == False).count()

    total_pages = (total + page_size - 1) // page_size if total > 0 else 1
    offset = (page - 1) * page_size

    items = (
        query.order_by(desc(Notification.CreatedAt))
        .offset(offset)
        .limit(page_size)
        .all()
    )

    return {
        "items": items,
        "total": total,
        "unread_count": unread_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


@router.get("/unread-count", response_model=NotificationUnreadCountResponse, summary="Get unread notifications count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    count = db.query(Notification).filter(Notification.IsRead == False).count()
    return {"unread_count": count}


@router.get("/latest", summary="Get top 10 latest notifications for header dropdown")
def get_latest_notifications(
    limit: int = Query(10, ge=1, le=20),
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    _maybe_auto_sync(db)

    items = (
        db.query(Notification)
        .order_by(desc(Notification.CreatedAt))
        .limit(limit)
        .all()
    )
    unread_count = db.query(Notification).filter(Notification.IsRead == False).count()

    return {
        "items": [NotificationResponse.from_orm(item) for item in items],
        "unread_count": unread_count
    }


@router.put("/{notification_id}/read", summary="Mark a single notification as read")
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    notif = db.query(Notification).filter(Notification.NotificationId == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.IsRead = True
    db.commit()
    return {"success": True, "message": "Notification marked as read"}


@router.put("/read-all", summary="Mark all unread notifications as read")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    updated_count = (
        db.query(Notification)
        .filter(Notification.IsRead == False)
        .update({Notification.IsRead: True}, synchronize_session=False)
    )
    db.commit()
    return {"success": True, "count": updated_count, "message": f"{updated_count} notifications marked as read"}


@router.delete("/{notification_id}", summary="Delete a notification with SRS Chapter 6 Audit Logging")
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    notif = db.query(Notification).filter(Notification.NotificationId == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif_type = notif.Type
    notif_title = notif.Title

    db.delete(notif)

    # ── SRS Chapter 6 (Module 10) Audit Logging ───────────────────────────────
    audit_desc = f"Deleted notification #{notification_id} (Type: {notif_type}, Title: '{notif_title}')"
    logger.info(f"AUDIT: User {current_user.Username} {audit_desc}.")

    audit_entry = AuditLog(
        UserId=current_user.UserId,
        Action="NOTIFICATION_DELETE",
        Description=audit_desc
    )
    db.add(audit_entry)

    db.commit()
    return {"success": True, "message": "Notification deleted successfully"}


@router.delete("/clear-read", summary="Delete all read notifications with SRS Chapter 6 Audit Logging")
def clear_read_notifications(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    read_count = db.query(Notification).filter(Notification.IsRead == True).count()
    if read_count > 0:
        db.query(Notification).filter(Notification.IsRead == True).delete(synchronize_session=False)

        # ── SRS Chapter 6 (Module 10) Audit Logging ───────────────────────────
        audit_desc = f"Cleared {read_count} read notifications from Notification Center"
        logger.info(f"AUDIT: User {current_user.Username} {audit_desc}.")

        audit_entry = AuditLog(
            UserId=current_user.UserId,
            Action="NOTIFICATION_CLEAR_READ",
            Description=audit_desc
        )
        db.add(audit_entry)

        db.commit()

    return {"success": True, "cleared_count": read_count, "message": f"{read_count} read notifications cleared"}


@router.post("/sync", summary="Trigger manual notification sync and 90-day cleanup")
def trigger_notification_sync(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    stats = sync_system_notifications(db)
    return {"success": True, "stats": stats}
