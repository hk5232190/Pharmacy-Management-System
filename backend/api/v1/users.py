from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from api.deps import get_db, get_current_admin_user
from models import User
from schemas.users import UserCreate, UserUpdate, UserResponse, VALID_ROLES
from core.security import get_password_hash_and_salt
from core.logger import logger

router = APIRouter(dependencies=[Depends(get_current_admin_user)])


def active_admin_count(db: Session) -> int:
    return db.query(User).filter(User.Role == "admin", User.IsActive == True).count()  # noqa: E712


def serialize_user(user: User) -> dict:
    return UserResponse.model_validate(user).model_dump()


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
    new_user = User(
        Username=user_in.username,
        FullName=user_in.full_name,
        PasswordHash=hash_str,
        Salt=salt_str,
        IsActive=True,
        Role=user_in.role
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