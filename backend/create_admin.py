import sys
from database import SessionLocal
from models import User
from core.security import get_password_hash_and_salt

def create_admin_user(username, password):
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.Username == username).first()
        if user:
            print(f"User '{username}' already exists.")
            return

        hash_str, salt_str = get_password_hash_and_salt(password)
        new_user = User(
            Username=username,
            PasswordHash=hash_str,
            Salt=salt_str,
            IsActive=True
        )
        db.add(new_user)
        db.commit()
        print(f"User '{username}' successfully created!")
    finally:
        db.close()

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python create_admin.py <username> <password>")
    else:
        create_admin_user(sys.argv[1], sys.argv[2])
