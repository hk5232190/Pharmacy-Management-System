import sys
from database import SessionLocal
from models import User
from core.security import get_password_hash_and_salt

def create_or_reset_user(username, password, role="admin"):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.Username == username).first()
        hash_str, salt_str = get_password_hash_and_salt(password)
        if user:
            user.PasswordHash = hash_str
            user.Salt = salt_str
            user.IsActive = True
            db.commit()
            print(f"User '{username}' already exists. Password successfully reset!")
            return

        new_user = User(
            Username=username,
            PasswordHash=hash_str,
            Salt=salt_str,
            IsActive=True,
            Role=role
        )
        db.add(new_user)
        db.commit()
        print(f"User '{username}' successfully created!")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) not in (3, 4):
        print("Usage: python create_admin.py <username> <password> [role]")
    else:
        role = sys.argv[3] if len(sys.argv) == 4 else "admin"
        create_or_reset_user(sys.argv[1], sys.argv[2], role)
