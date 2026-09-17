import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from api.deps import get_db, get_current_admin_user
from models import User
from schemas.users import UserCreate, UserUpdate, UserPermissionsUpdate, UserResponse, VALID_ROLES, DEFAULT_CASHIER_PERMISSIONS
from core.security import get_password_hash_and_salt
from core.logger import logger

router = APIRouter(dependencies=[Depends(get_current_admin_user)])


def active_admin_count(db: Session) -> int:
    return db.query(User).filter(User.Role == "admin", User.IsActive == True).count()  # noqa: E712


def _parse_permissions(user: User) -> list[str]:
    """Return the parsed permissions list for a user."""
    if user.Role == "admin":
        return []  # admins have full access — no explicit list needed
    try:
        perms = json.loads(user.Permissions or "[]")
        return perms if isinstance(perms, list) else DEFAULT_CASHIER_PERMISSIONS
    except (json.JSONDecodeError, TypeError):
        return DEFAULT_CASHIER_PERMISSIONS


def serialize_user(user: User) -> dict:
    base = UserResponse.model_validate(user).model_dump()
    base["Permissions"] = _parse_permissions(user)
    return base


@router.get("", summary="List all users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.UserId).all()
    return {"success": True, "data": [serialize_user(u) for u in users]}


@router.post("", summary="Create a new user (admin or cashier)")
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    if user_in.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'cashier'.")

    if db.query(User).filter(User.Username == user_in.username).first():
        raise HTTPException(status_code=400, detail="Username already exists.")

    hash_str, salt_str = get_password_hash_and_salt(user_in.password)
    # New cashiers start with Sales-only access
    default_perms = json.dumps(DEFAULT_CASHIER_PERMISSIONS) if user_in.role == "cashier" else None
    new_user = User(
        Username=user_in.username,
        FullName=user_in.full_name,
        PasswordHash=hash_str,
        Salt=salt_str,
        IsActive=True,
        Role=user_in.role,
        Permissions=default_perms,
    )
    db.add(new_user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Username already exists.")
    db.refresh(new_user)

    logger.info(f"AUDIT: User {current_user.Username} created user '{new_user.Username}' with role '{new_user.Role}'.")
    return {"success": True, "data": serialize_user(new_user), "message": "User created successfully"}


@router.put("/{user_id}", summary="Update a user (role, name, active status, password)")
def update_user(
    user_id: int,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    user = db.query(User).filter(User.UserId == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    role = user_in.role
    is_active = user_in.is_active

    if role is not None and role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'cashier'.")

    # Self-protection: you cannot demote or deactivate your own account
    if user_id == current_user.UserId:
        if role is not None and role != "admin":
            raise HTTPException(status_code=400, detail="You cannot change your own role.")
        if is_active is False:
            raise HTTPException(status_code=400, detail="You cannot deactivate your own account.")

    # Keep the system usable: never remove the last active admin
    removing_admin = (role is not None and role != "admin") or (is_active is False)
    if removing_admin and user.Role == "admin" and user.IsActive and active_admin_count(db) <= 1:
        raise HTTPException(status_code=400, detail="Cannot demote or disable the last active admin account.")

    if user_in.full_name is not None:
        user.FullName = user_in.full_name
    if role is not None:
        user.Role = role
        # When promoted to admin clear permissions; when demoted to cashier set defaults
        if role == "admin":
            user.Permissions = None
        elif user.Permissions is None:
            user.Permissions = json.dumps(DEFAULT_CASHIER_PERMISSIONS)
    if is_active is not None:
        user.IsActive = is_active
    if user_in.password:
        hash_str, salt_str = get_password_hash_and_salt(user_in.password)
        user.PasswordHash = hash_str
        user.Salt = salt_str

    db.commit()
    db.refresh(user)

    logger.info(f"AUDIT: User {current_user.Username} updated user '{user.Username}' (role={user.Role}, active={user.IsActive}).")
    return {"success": True, "data": serialize_user(user), "message": "User updated successfully"}


@router.put("/{user_id}/permissions", summary="Set module permissions for a cashier")
def update_user_permissions(
    user_id: int,
    perms_in: UserPermissionsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    user = db.query(User).filter(User.UserId == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.Role == "admin":
        raise HTTPException(status_code=400, detail="Admin accounts always have full access — permissions cannot be restricted.")

    # Sanitise: keep only known modules; always include "sales"
    from schemas.users import ALL_MODULES
    valid = [m for m in perms_in.permissions if m in ALL_MODULES]
    if "sales" not in valid:
        valid = ["sales"] + valid  # sales is always on

    user.Permissions = json.dumps(valid)
    db.commit()
    db.refresh(user)

    logger.info(f"AUDIT: Admin {current_user.Username} updated permissions for '{user.Username}': {valid}")
    return {"success": True, "data": serialize_user(user), "message": "Permissions updated successfully"}