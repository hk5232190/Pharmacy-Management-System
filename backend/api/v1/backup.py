import os
import sqlite3
import hashlib
import zipfile
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from tkinter import Tk, filedialog
import plyer

from database import SQLALCHEMY_DATABASE_URL, engine
from models import BackupHistory, User, BackupSettings
from schemas.backup import BackupRequest, BackupResponse, RestoreRequest, RestoreResponse, DatabaseInfoResponse, DatabaseHealthResponse
from api.deps import get_db, get_current_user
from core.logger import logger
from core.security import verify_password
from utils.hwid import generate_hwid
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import padding
from sqlalchemy import text
import shutil
import tempfile
import subprocess
import sys

router = APIRouter(prefix="/backup", tags=["backup"])

def get_db_path():
    # SQLALCHEMY_DATABASE_URL is like "sqlite:///./pharma_db.sqlite"
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite:///"):
        return SQLALCHEMY_DATABASE_URL.replace("sqlite:///", "")
    return "pharma_db.sqlite"

@router.get("/browse-folder")
def browse_folder():
    script = "import tkinter.filedialog, tkinter; root = tkinter.Tk(); root.withdraw(); root.attributes('-topmost', True); print(tkinter.filedialog.askdirectory())"
    try:
        result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, timeout=30)
        path = result.stdout.strip()
        return {"path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/browse-file")
def browse_file():
    script = "import tkinter.filedialog, tkinter; root = tkinter.Tk(); root.withdraw(); root.attributes('-topmost', True); print(tkinter.filedialog.askopenfilename(filetypes=[('SQLite/Zip Backup', '*.sqlite *.zip')]))"
    try:
        result = subprocess.run([sys.executable, "-c", script], capture_output=True, text=True, timeout=30)
        path = result.stdout.strip()
        return {"path": path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def calculate_sha256(filepath: str) -> str:
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def sanitize_and_prepare_path(user_location: str) -> Path:
    try:
        path = Path(user_location).resolve()
        
        # Prevent writing to critical system roots directly
        if str(path) == path.anchor: # e.g., 'C:\' or '/'
            raise ValueError("Cannot backup directly to root directory.")
            
        # Create directory if it doesn't exist
        path.mkdir(parents=True, exist_ok=True)
        
        # Test write permissions
        test_file = path / ".test_write"
        test_file.touch()
        test_file.unlink()
        
        return path
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid or inaccessible backup location: {str(e)}")

def execute_backup(db: Session, backup_name: str, backup_location: str, compress: bool, backup_type: str = "Manual"):
    src_db_path = get_db_path()
    if not os.path.exists(src_db_path):
        raise ValueError("Source database not found.")

    backup_dir = sanitize_and_prepare_path(backup_location)
    db_filename = f"{backup_name}.sqlite"
    dst_db_path = backup_dir / db_filename
    
    try:
        # 1. Use sqlite3.backup() for safe online backup
        src = sqlite3.connect(src_db_path)
        dst = sqlite3.connect(dst_db_path)
        try:
            src.backup(dst)
        finally:
            dst.close()
            src.close()
            
        final_file_path = dst_db_path
        
        # 2. Optionally compress
        if compress:
            zip_filename = f"{backup_name}.zip"
            zip_path = backup_dir / zip_filename
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(dst_db_path, arcname=db_filename)
            os.remove(dst_db_path)
            final_file_path = zip_path
            
        # 3. Calculate SHA-256
        checksum = calculate_sha256(str(final_file_path))
        file_size = os.path.getsize(final_file_path)
        
        # 4. Record history
        history_record = BackupHistory(
            BackupName=final_file_path.name,
            BackupLocation=str(final_file_path.parent),
            SizeBytes=file_size,
            BackupType=backup_type,
            Status="Success",
            ChecksumSHA256=checksum
        )
        db.add(history_record)
        
        # 5. Retention Logic for Automatic Backups
        if backup_type == "Automatic":
            settings = db.query(BackupSettings).first()
            if settings and settings.RetentionCount > 0:
                # Find older backups exceeding RetentionCount
                auto_backups = db.query(BackupHistory).filter(BackupHistory.BackupType == "Automatic").order_by(BackupHistory.CreatedAt.desc()).all()
                if len(auto_backups) > settings.RetentionCount:
                    backups_to_delete = auto_backups[settings.RetentionCount:]
                    for old_backup in backups_to_delete:
                        old_file_path = Path(old_backup.BackupLocation) / old_backup.BackupName
                        if old_file_path.exists():
                            try:
                                os.remove(old_file_path)
                            except OSError:
                                pass # ignore deletion errors for retention
                        db.delete(old_backup)

        db.commit()
        db.refresh(history_record)

        logger.info(f"Database Backup Executed | Type: {backup_type} | File: {final_file_path.name} | Size: {file_size} bytes | Status: Success")

        if backup_type == "Automatic":
            try:
                plyer.notification.notify(
                    title="Automatic Backup Successful",
                    message=f"Created: {final_file_path.name}",
                    app_name="Pharmacy Management System",
                    timeout=5
                )
            except Exception:
                pass # ignore plyer errors on unsupported platforms
        
        return history_record
        
    except Exception as e:
        # Record failure
        history_record = BackupHistory(
            BackupName=backup_name,
            BackupLocation=str(backup_dir),
            SizeBytes=0,
            BackupType=backup_type,
            Status="Failed",
            ChecksumSHA256=None
        )
        db.add(history_record)
        db.commit()
        
        logger.error(f"Database Backup Failed | Type: {backup_type} | Name: {backup_name} | Error: {str(e)}")
        
        if backup_type == "Automatic":
            try:
                plyer.notification.notify(
                    title="Automatic Backup Failed",
                    message=str(e),
                    app_name="Pharmacy Management System",
                    timeout=5
                )
            except Exception:
                pass
                
        raise e

@router.get("/db-info", response_model=DatabaseInfoResponse)
def get_database_info(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    src_db_path = get_db_path()
    size_bytes = os.path.getsize(src_db_path) if os.path.exists(src_db_path) else 0
    
    conn = sqlite3.connect(src_db_path)
    cursor = conn.cursor()
    cursor.execute("select sqlite_version();")
    version = cursor.fetchone()[0]
    conn.close()

    last_backup = db.query(BackupHistory).filter(BackupHistory.Status == "Success").order_by(BackupHistory.CreatedAt.desc()).first()
    total_backups = db.query(BackupHistory).count()

    return DatabaseInfoResponse(
        engine="SQLite",
        version=version,
        size_bytes=size_bytes,
        last_backup_date=last_backup.CreatedAt if last_backup else None,
        total_backups=total_backups
    )

@router.get("/db-health", response_model=DatabaseHealthResponse)
def get_database_health(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    src_db_path = get_db_path()
    try:
        conn = sqlite3.connect(src_db_path)
        cursor = conn.cursor()
        cursor.execute("PRAGMA integrity_check;")
        result = cursor.fetchone()
        conn.close()
        
        if result and result[0] == "ok":
            return DatabaseHealthResponse(status="Healthy", message="Database integrity check passed.")
        else:
            return DatabaseHealthResponse(status="Corrupted", message=f"Database integrity check failed: {result}")
    except Exception as e:
        return DatabaseHealthResponse(status="Error", message=f"Failed to run integrity check: {str(e)}")

@router.post("/manual", response_model=BackupResponse)
def create_manual_backup(
    req: BackupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        return execute_backup(
            db=db, 
            backup_name=req.backup_name, 
            backup_location=req.backup_location, 
            compress=req.compress, 
            backup_type="Manual"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")

@router.get("/history")
def get_backup_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    backups = db.query(BackupHistory).order_by(BackupHistory.CreatedAt.desc()).all()
    return backups

@router.post("/restore", response_model=RestoreResponse)
def restore_backup(
    req: RestoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(req.password, current_user.PasswordHash, current_user.Salt):
        logger.warning(f"Failed password verification during restore by user {current_user.Username}")
        raise HTTPException(status_code=401, detail="Invalid password.")

    backup_file = Path(req.backup_file_path)
    if not backup_file.exists():
        raise HTTPException(status_code=404, detail="Backup file not found.")
        
    temp_dir = Path(tempfile.mkdtemp())
    try:
        # 1. Validation
        if backup_file.suffix == '.zip':
            with zipfile.ZipFile(backup_file, 'r') as zipf:
                zipf.extractall(temp_dir)
            extracted_files = list(temp_dir.glob('*.sqlite'))
            if not extracted_files:
                raise HTTPException(status_code=400, detail="No SQLite database found in zip.")
            db_to_restore = extracted_files[0]
        elif backup_file.suffix == '.sqlite':
            db_to_restore = backup_file
        else:
            raise HTTPException(status_code=400, detail="Invalid backup file type.")

        try:
            conn = sqlite3.connect(db_to_restore)
            try:
                cursor = conn.cursor()
                cursor.execute("PRAGMA integrity_check;")
                result = cursor.fetchone()
                if result[0] != "ok":
                    raise Exception("Integrity check failed.")
                
                # Alembic Schema Check
                try:
                    cursor.execute("SELECT version_num FROM alembic_version;")
                    backup_version = cursor.fetchone()
                except sqlite3.OperationalError:
                    backup_version = None
                
                live_version = db.execute(text("SELECT version_num FROM alembic_version")).fetchone()
                
                if backup_version and live_version:
                    if backup_version[0] != live_version[0]:
                        raise Exception(f"Schema version mismatch: Backup is at {backup_version[0]}, live is at {live_version[0]}. Please run database migrations first.")
            finally:
                conn.close()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Backup validation failed: {str(e)}")

        src_db_path = Path(get_db_path())
        
        # 2. Safety Backup
        safety_backup_dir = src_db_path.parent / "backups" / "safety"
        safety_backup_dir.mkdir(parents=True, exist_ok=True)
        safety_db_path = safety_backup_dir / "pre_restore_safety_snapshot.sqlite"
        
        logger.info(f"Database Restore Initiated | Creating safety snapshot: {safety_db_path}")
        
        src = sqlite3.connect(src_db_path)
        dst = sqlite3.connect(safety_db_path)
        try:
            src.backup(dst)
        finally:
            dst.close()
            src.close()
        # 3. Restore with Atomic Swap and engine.dispose()
        try:
            # Nullify active session pools
            db.close()
            engine.dispose()
            
            temp_swap_path = src_db_path.with_suffix(".temp_swap")
            shutil.copy2(db_to_restore, temp_swap_path)
            
            # Atomic swap on Windows
            os.replace(temp_swap_path, src_db_path)
            
        except Exception as e:
            # 4. Strict Rollback to Safety Backup
            try:
                os.replace(safety_db_path, src_db_path)
            except:
                pass
            logger.error(f"Database Restore Failed | Error: {str(e)} | Rolled back to safety snapshot")
            raise HTTPException(status_code=500, detail=f"Restore failed during file swap. Rolled back to safety backup. Error: {str(e)}")

        logger.info(f"Database Restore Successful | Restored from: {req.backup_file_path} by user {current_user.Username}")
        return RestoreResponse(success=True, message="Restore completed successfully. Please reload.")
        
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

import time
import anyio

@router.delete("/history/{backup_id}")
def delete_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    backup_record = db.query(BackupHistory).filter(BackupHistory.BackupId == backup_id).first()
    if not backup_record:
        raise HTTPException(status_code=404, detail="Backup record not found.")

    file_path = Path(backup_record.BackupLocation) / backup_record.BackupName
    
    # 1. Transactional Deletion with Lock Retries
    if file_path.exists():
        max_retries = 3
        deleted = False
        for i in range(max_retries):
            try:
                os.remove(file_path)
                deleted = True
                break
            except OSError as e:
                time.sleep(0.5)
        if not deleted:
            raise HTTPException(status_code=400, detail="Could not delete physical file due to OS lock.")
            
    db.delete(backup_record)
    db.commit()
    
    return {"success": True, "message": "Backup deleted successfully."}

@router.post("/history/{backup_id}/verify")
def verify_backup(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    backup_record = db.query(BackupHistory).filter(BackupHistory.BackupId == backup_id).first()
    if not backup_record:
        raise HTTPException(status_code=404, detail="Backup record not found.")
        
    file_path = Path(backup_record.BackupLocation) / backup_record.BackupName
    
    report = {
        "checksum": {"status": "Pending", "message": ""},
        "integrity": {"status": "Pending", "message": ""},
        "schema": {"status": "Pending", "message": ""}
    }
    
    if not file_path.exists():
        report["checksum"] = {"status": "Failed", "message": "Physical file is missing from disk."}
        return {"overall": "Failed", "report": report}
        
    # 1. Chunked SHA-256 calculation (64KB buffer) to prevent memory spikes
    sha256_hash = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(65536), b""):
                sha256_hash.update(byte_block)
        calculated_hash = sha256_hash.hexdigest()
        
        if calculated_hash == backup_record.ChecksumSHA256:
            report["checksum"] = {"status": "Passed", "message": "SHA-256 matched successfully."}
        else:
            report["checksum"] = {"status": "Failed", "message": "Checksum mismatch. File is corrupted."}
            return {"overall": "Failed", "report": report}
    except Exception as e:
        report["checksum"] = {"status": "Failed", "message": f"Read error: {str(e)}"}
        return {"overall": "Failed", "report": report}
        
    # 2 & 3. Integrity & Schema
    temp_dir = Path(tempfile.mkdtemp())
    try:
        db_to_verify = None
        
        if file_path.suffix == '.zip':
            with zipfile.ZipFile(file_path, 'r') as zipf:
                zipf.extractall(temp_dir)
            extracted = list(temp_dir.glob('*.sqlite')) + list(temp_dir.glob('*.enc'))
            if not extracted:
                report["integrity"] = {"status": "Failed", "message": "No database found in zip."}
                return {"overall": "Failed", "report": report}
            target_file = extracted[0]
        else:
            target_file = file_path
            
        # Decrypt HWID AES-256 if encrypted
        hwid = generate_hwid()
        aes_key = hashlib.sha256(hwid.encode()).digest()
        
        with open(target_file, "rb") as f:
            header = f.read(16)
            
        if header != b'SQLite format 3\000':
            try:
                with open(target_file, "rb") as f:
                    iv = f.read(16)
                    ciphertext = f.read()
                cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv), backend=default_backend())
                decryptor = cipher.decryptor()
                decrypted_padded = decryptor.update(ciphertext) + decryptor.finalize()
                
                unpadder = padding.PKCS7(128).unpadder()
                decrypted_data = unpadder.update(decrypted_padded) + unpadder.finalize()
                
                decrypted_path = temp_dir / "decrypted_verify.sqlite"
                with open(decrypted_path, "wb") as f:
                    f.write(decrypted_data)
                db_to_verify = decrypted_path
            except Exception as e:
                report["integrity"] = {"status": "Failed", "message": "HWID Decryption failed. Incorrect machine or invalid key."}
                return {"overall": "Failed", "report": report}
        else:
            db_to_verify = target_file
            
        # Integrity Check
        try:
            conn = sqlite3.connect(db_to_verify)
            cursor = conn.cursor()
            cursor.execute("PRAGMA integrity_check;")
            result = cursor.fetchone()
            if result[0] != "ok":
                report["integrity"] = {"status": "Failed", "message": f"SQLite reported: {result[0]}"}
            else:
                report["integrity"] = {"status": "Passed", "message": "B-Tree structures intact."}
                
            # Schema Validation
            try:
                cursor.execute("SELECT version_num FROM alembic_version;")
                backup_version = cursor.fetchone()
            except sqlite3.OperationalError:
                backup_version = None
                
            live_version = db.execute(text("SELECT version_num FROM alembic_version")).fetchone()
            
            if backup_version and live_version:
                if backup_version[0] != live_version[0]:
                    report["schema"] = {"status": "Failed", "message": f"Version mismatch: {backup_version[0]} vs {live_version[0]}"}
                else:
                    report["schema"] = {"status": "Passed", "message": f"Schema {backup_version[0]} matches live DB."}
            else:
                report["schema"] = {"status": "Passed", "message": "No schema versioning found, skipping check."}
                
        except Exception as e:
            report["integrity"] = {"status": "Failed", "message": f"Integrity check crashed: {str(e)}"}
        finally:
            if 'conn' in locals():
                conn.close()
                
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
        
    overall = "Passed" if report["integrity"]["status"] == "Passed" and report["schema"]["status"] == "Passed" else "Failed"
    return {"overall": overall, "report": report}

# Allowlist: only allow opening folders inside the workspace or known backup folders
def _is_path_allowed(path: Path) -> bool:
    try:
        allowed_dirs = [
            Path(get_db_path()).parent.resolve(),
            Path("./backups").resolve()
        ]
        resolved_path = path.resolve()
        for allowed in allowed_dirs:
            if allowed in resolved_path.parents or allowed == resolved_path:
                return True
        return False
    except:
        return False

@router.post("/history/{backup_id}/open-folder")
async def open_backup_folder(
    backup_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    backup_record = db.query(BackupHistory).filter(BackupHistory.BackupId == backup_id).first()
    if not backup_record:
        raise HTTPException(status_code=404, detail="Backup record not found.")
        
    folder_path = Path(backup_record.BackupLocation)
    
    if not folder_path.exists() or not folder_path.is_dir():
        raise HTTPException(status_code=404, detail="Backup folder does not exist.")
        
    if not _is_path_allowed(folder_path):
        raise HTTPException(status_code=403, detail="Directory outside allowed backup paths.")
        
    try:
        # Non-blocking async os.startfile using anyio
        await anyio.to_thread.run_sync(os.startfile, str(folder_path))
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open folder: {str(e)}")
