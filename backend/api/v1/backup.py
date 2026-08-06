import os
import sqlite3
import hashlib
import zipfile
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import SQLALCHEMY_DATABASE_URL, engine
from models import BackupHistory, User
from schemas.backup import BackupRequest, BackupResponse, RestoreRequest, RestoreResponse
from api.deps import get_db, get_current_user
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

@router.post("/manual", response_model=BackupResponse)
def create_manual_backup(
    req: BackupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    src_db_path = get_db_path()
    if not os.path.exists(src_db_path):
        raise HTTPException(status_code=500, detail="Source database not found.")

    backup_dir = sanitize_and_prepare_path(req.backup_location)
    
    # Generate filenames
    db_filename = f"{req.backup_name}.sqlite"
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
        if req.compress:
            zip_filename = f"{req.backup_name}.zip"
            zip_path = backup_dir / zip_filename
            with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(dst_db_path, arcname=db_filename)
            
            # Remove the uncompressed db backup
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
            BackupType="Manual",
            Status="Success",
            ChecksumSHA256=checksum
        )
        db.add(history_record)
        db.commit()
        db.refresh(history_record)
        
        return history_record
        
    except Exception as e:
        # Record failure
        history_record = BackupHistory(
            BackupName=req.backup_name,
            BackupLocation=str(backup_dir),
            SizeBytes=0,
            BackupType="Manual",
            Status="Failed",
            ChecksumSHA256=None
        )
        db.add(history_record)
        db.commit()
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
        safety_backup_name = f"Safety_Backup_{datetime.now().strftime('%Y_%m_%d_%H%M%S')}"
        safety_backup_dir = src_db_path.parent / "backups" / "safety"
        safety_backup_dir.mkdir(parents=True, exist_ok=True)
        safety_db_path = safety_backup_dir / f"{safety_backup_name}.sqlite"
        
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
            raise HTTPException(status_code=500, detail=f"Restore failed during file swap. Rolled back to safety backup. Error: {str(e)}")

        return RestoreResponse(success=True, message="Restore completed successfully. Please reload.")
        
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
