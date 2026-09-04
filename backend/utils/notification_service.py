import os
from datetime import datetime, date, timedelta
from typing import Set
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from models import (
    Notification,
    Medicine,
    StockBatch,
    InventorySettings,
    BackupHistory,
    AuditLog
)
from core.logger import logger

LICENSE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "licenses")
ACTIVE_LICENSE_PATH = os.path.join(LICENSE_DIR, "active.lic")


def sync_system_notifications(db: Session) -> dict:
    """
    Synchronizes real-time PMS system notifications based on actual database states:
    - Out of Stock
    - Low Stock (using dynamic settings & per-medicine reorder levels)
    - Expired Medicines
    - Expiring Soon Medicines (using dynamic InventorySettings.ExpiryAlertDays)
    - License alerts (Missing, Expired, Expiring Soon)
    - Backup events (Success & Failure from BackupHistory)

    Features:
    - SQLite Native Date Math: Auto-cleans notifications older than 90 days.
    - Strict Dynamic Settings: Queries inventory_settings table.
    - Stateful Auto-Resolution (Ghost Prevention): Purges condition alerts when resolved.
    - Deduplication: Prevents duplicate notifications for active entities.
    """
    stats = {
        "cleaned_stale_90d": 0,
        "auto_resolved_ghosts": 0,
        "created_new": 0,
        "active_conditions": 0
    }

    try:
        # ── 1. SQLite Native Date Math: 90-Day Auto-Cleanup ───────────────────
        cleanup_query = text("DELETE FROM notifications WHERE CreatedAt < datetime('now', '-90 days')")
        cleanup_result = db.execute(cleanup_query)
        stats["cleaned_stale_90d"] = cleanup_result.rowcount if cleanup_result else 0

        # ── 2. Strict Dynamic Inventory Settings ──────────────────────────────
        inv_settings = db.query(InventorySettings).first()
        low_stock_threshold = (
            int(inv_settings.LowStockThreshold)
            if inv_settings and inv_settings.LowStockThreshold is not None and int(inv_settings.LowStockThreshold) > 0
            else 10
        )
        expiry_alert_days = (
            int(inv_settings.ExpiryAlertDays)
            if inv_settings and hasattr(inv_settings, "ExpiryAlertDays") and inv_settings.ExpiryAlertDays is not None and int(inv_settings.ExpiryAlertDays) > 0
            else 90
        )

        today = date.today()
        expiry_cutoff_date = today + timedelta(days=expiry_alert_days)

        active_condition_keys: Set[str] = set()
        new_notifications = []

        # Existing entity keys currently in the notifications table
        existing_keys = {
            r[0] for r in db.query(Notification.EntityKey).filter(Notification.EntityKey.isnot(None)).all()
        }

        # ── 3. Stock Conditions (Out of Stock & Low Stock) ─────────────────────
        # Aggregate active stock quantities per active medicine
        medicine_stocks = (
            db.query(
                Medicine.MedicineId,
                Medicine.BrandName,
                Medicine.Barcode,
                Medicine.ReorderLevel,
                func.coalesce(func.sum(StockBatch.Quantity), 0).label("total_qty")
            )
            .outerjoin(StockBatch, Medicine.MedicineId == StockBatch.MedicineId)
            .filter(Medicine.IsActive == True)
            .group_by(Medicine.MedicineId, Medicine.BrandName, Medicine.Barcode, Medicine.ReorderLevel)
            .all()
        )

        for med_id, brand_name, barcode, reorder_level, total_qty in medicine_stocks:
            total_qty = int(total_qty or 0)
            # Effective threshold: COALESCE(NULLIF(ReorderLevel, 0), low_stock_threshold)
            effective_reorder = int(reorder_level) if reorder_level and int(reorder_level) > 0 else low_stock_threshold

            if total_qty <= 0:
                entity_key = f"OUT_OF_STOCK:med:{med_id}"
                active_condition_keys.add(entity_key)

                if entity_key not in existing_keys:
                    new_notifications.append(
                        Notification(
                            Type="OUT_OF_STOCK",
                            Title=f"Out of Stock: {brand_name}",
                            Message=f"Medicine '{brand_name}' has 0 units in stock. Please create a purchase order to replenish.",
                            Priority="High",
                            RelatedModule="inventory",
                            RelatedRecordId=str(med_id),
                            EntityKey=entity_key,
                            ActionUrl=f"/dashboard/inventory?tab=current&status=Out+of+Stock&search={brand_name}",
                            IsRead=False
                        )
                    )
            elif total_qty <= effective_reorder:
                entity_key = f"LOW_STOCK:med:{med_id}"
                active_condition_keys.add(entity_key)

                if entity_key not in existing_keys:
                    new_notifications.append(
                        Notification(
                            Type="LOW_STOCK",
                            Title=f"Low Stock: {brand_name}",
                            Message=f"Medicine '{brand_name}' is running low with {total_qty} units remaining (Reorder threshold: {effective_reorder}).",
                            Priority="High" if total_qty <= max(1, effective_reorder // 3) else "Normal",
                            RelatedModule="inventory",
                            RelatedRecordId=str(med_id),
                            EntityKey=entity_key,
                            ActionUrl=f"/dashboard/inventory?tab=current&status=Low+Stock&search={brand_name}",
                            IsRead=False
                        )
                    )

        # ── 4. Expiry Conditions (Expired & Expiring Soon) ──────────────────────
        batches = (
            db.query(StockBatch, Medicine.BrandName)
            .join(Medicine, StockBatch.MedicineId == Medicine.MedicineId)
            .filter(StockBatch.Quantity > 0, Medicine.IsActive == True)
            .all()
        )

        for batch, brand_name in batches:
            if not batch.ExpiryDate:
                continue

            batch_exp: date = batch.ExpiryDate
            if isinstance(batch_exp, datetime):
                batch_exp = batch_exp.date()

            if batch_exp < today:
                # Expired Medicine
                entity_key = f"EXPIRED_MEDICINE:batch:{batch.BatchId}"
                active_condition_keys.add(entity_key)

                if entity_key not in existing_keys:
                    formatted_exp = batch_exp.strftime("%d %b %Y")
                    new_notifications.append(
                        Notification(
                            Type="EXPIRED_MEDICINE",
                            Title=f"Expired Medicine: {brand_name}",
                            Message=f"Batch '{batch.BatchCode}' of '{brand_name}' ({batch.Quantity} units) expired on {formatted_exp}. Please remove from stock.",
                            Priority="Critical",
                            RelatedModule="inventory",
                            RelatedRecordId=str(batch.BatchId),
                            EntityKey=entity_key,
                            ActionUrl="/dashboard/inventory?tab=expiry",
                            IsRead=False
                        )
                    )
            elif today <= batch_exp <= expiry_cutoff_date:
                # Expiring Soon
                entity_key = f"EXPIRING_SOON:batch:{batch.BatchId}"
                active_condition_keys.add(entity_key)

                if entity_key not in existing_keys:
                    days_left = (batch_exp - today).days
                    formatted_exp = batch_exp.strftime("%d %b %Y")
                    priority = "High" if days_left <= 30 else "Normal"
                    new_notifications.append(
                        Notification(
                            Type="EXPIRING_SOON",
                            Title=f"Expiring Soon: {brand_name}",
                            Message=f"Batch '{batch.BatchCode}' of '{brand_name}' ({batch.Quantity} units) expires in {days_left} days on {formatted_exp}.",
                            Priority=priority,
                            RelatedModule="inventory",
                            RelatedRecordId=str(batch.BatchId),
                            EntityKey=entity_key,
                            ActionUrl="/dashboard/inventory?tab=expiry",
                            IsRead=False
                        )
                    )

        # ── 5. License Status Conditions ──────────────────────────────────────
        try:
            if not os.path.exists(ACTIVE_LICENSE_PATH):
                lic_key = "LICENSE_ALERT:missing"
                active_condition_keys.add(lic_key)
                if lic_key not in existing_keys:
                    new_notifications.append(
                        Notification(
                            Type="LICENSE_ALERT",
                            Title="License Missing",
                            Message="No active software license file found. Please activate your PMS software license.",
                            Priority="Critical",
                            RelatedModule="license",
                            RelatedRecordId="license_file",
                            EntityKey=lic_key,
                            ActionUrl="/dashboard/settings/license",
                            IsRead=False
                        )
                    )
            else:
                from utils.license_engine import validate_license
                with open(ACTIVE_LICENSE_PATH, "rb") as f:
                    content = f.read()

                try:
                    payload = validate_license(content)
                    exp = payload.get("exp")
                    lic_type = payload.get("type", "Unknown")
                    is_lifetime = (lic_type == "Lifetime" or exp is None)

                    if not is_lifetime and exp:
                        exp_dt = datetime.fromtimestamp(float(exp))
                        days_left = (exp_dt.date() - today).days

                        if days_left <= 0:
                            lic_key = "LICENSE_ALERT:expired"
                            active_condition_keys.add(lic_key)
                            if lic_key not in existing_keys:
                                new_notifications.append(
                                    Notification(
                                        Type="LICENSE_ALERT",
                                        Title="Software License Expired",
                                        Message="Your software license has expired. Please renew your license immediately to continue operations.",
                                        Priority="Critical",
                                        RelatedModule="license",
                                        RelatedRecordId="active_license",
                                        EntityKey=lic_key,
                                        ActionUrl="/dashboard/settings/license",
                                        IsRead=False
                                    )
                                )
                        elif days_left <= 30:
                            lic_key = "LICENSE_ALERT:expiring_soon"
                            active_condition_keys.add(lic_key)
                            if lic_key not in existing_keys:
                                priority = "Critical" if days_left <= 3 else "High" if days_left <= 7 else "Normal"
                                new_notifications.append(
                                    Notification(
                                        Type="LICENSE_ALERT",
                                        Title="Software License Expiring Soon",
                                        Message=f"Your software license will expire in {days_left} day{'s' if days_left != 1 else ''}. Please contact your vendor to renew.",
                                        Priority=priority,
                                        RelatedModule="license",
                                        RelatedRecordId="active_license",
                                        EntityKey=lic_key,
                                        ActionUrl="/dashboard/settings/license",
                                        IsRead=False
                                    )
                                )
                except Exception as lic_err:
                    lic_key = "LICENSE_ALERT:invalid"
                    active_condition_keys.add(lic_key)
                    if lic_key not in existing_keys:
                        new_notifications.append(
                            Notification(
                                Type="LICENSE_ALERT",
                                Title="License Validation Alert",
                                Message=f"Active license validation failed: {str(lic_err)}",
                                Priority="Critical",
                                RelatedModule="license",
                                RelatedRecordId="invalid_license",
                                EntityKey=lic_key,
                                ActionUrl="/dashboard/settings/license",
                                IsRead=False
                            )
                        )
        except Exception as e:
            logger.error(f"Error checking license in notification sync: {e}")

        # ── 6. Backup Events (from BackupHistory past 7 days) ───────────────────
        try:
            recent_backups = (
                db.query(BackupHistory)
                .filter(BackupHistory.CreatedAt >= (datetime.utcnow() - timedelta(days=7)))
                .order_by(BackupHistory.CreatedAt.desc())
                .limit(20)
                .all()
            )
            for bkp in recent_backups:
                bkp_key = f"BACKUP:{bkp.BackupId}"
                if bkp_key not in existing_keys:
                    if bkp.Status == "Success":
                        new_notifications.append(
                            Notification(
                                Type="BACKUP_SUCCESS",
                                Title=f"Backup Successful ({bkp.BackupType})",
                                Message=f"Backup '{bkp.FileName}' ({bkp.FileSize}) was created successfully.",
                                Priority="Low",
                                RelatedModule="backup",
                                RelatedRecordId=str(bkp.BackupId),
                                EntityKey=bkp_key,
                                ActionUrl="/dashboard/backup",
                                IsRead=False,
                                CreatedAt=bkp.CreatedAt
                            )
                        )
                    else:
                        new_notifications.append(
                            Notification(
                                Type="BACKUP_FAILED",
                                Title=f"Backup Failed ({bkp.BackupType})",
                                Message=f"Automatic or manual backup '{bkp.FileName}' failed to complete.",
                                Priority="High",
                                RelatedModule="backup",
                                RelatedRecordId=str(bkp.BackupId),
                                EntityKey=bkp_key,
                                ActionUrl="/dashboard/backup",
                                IsRead=False,
                                CreatedAt=bkp.CreatedAt
                            )
                        )
        except Exception as e:
            logger.error(f"Error checking backups in notification sync: {e}")

        # ── 7. Stateful Auto-Resolution (Ghost Prevention) ─────────────────────
        # If a previously flagged condition is no longer true (e.g. medicine restocked,
        # batch returned/disposed, license renewed), auto-resolve & remove it!
        condition_types = [
            "OUT_OF_STOCK",
            "LOW_STOCK",
            "EXPIRING_SOON",
            "EXPIRED_MEDICINE",
            "LICENSE_ALERT"
        ]

        stale_notifications = (
            db.query(Notification)
            .filter(
                Notification.Type.in_(condition_types),
                Notification.EntityKey.isnot(None)
            )
            .all()
        )

        ghosts_to_remove = [
            n.NotificationId
            for n in stale_notifications
            if n.EntityKey not in active_condition_keys
        ]

        if ghosts_to_remove:
            db.query(Notification).filter(Notification.NotificationId.in_(ghosts_to_remove)).delete(synchronize_session=False)
            stats["auto_resolved_ghosts"] = len(ghosts_to_remove)

        # ── 8. Commit Newly Detected Condition Notifications ──────────────────
        if new_notifications:
            db.add_all(new_notifications)
            stats["created_new"] = len(new_notifications)

        stats["active_conditions"] = len(active_condition_keys)

        db.commit()
        return stats

    except Exception as e:
        db.rollback()
        logger.error(f"Error syncing system notifications: {e}")
        raise e
