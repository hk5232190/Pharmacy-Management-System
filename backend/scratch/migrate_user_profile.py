import sqlite3
import os

def migrate_users_table():
    db_path = os.path.join(os.path.dirname(__file__), '..', 'pharma_db.sqlite')
    print(f"Connecting to database at {db_path}...")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check existing columns
    cursor.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]
    print(f"Existing columns in 'users' table: {columns}")
    
    # Add FullName
    if 'FullName' not in columns:
        print("Adding 'FullName' column...")
        cursor.execute("ALTER TABLE users ADD COLUMN FullName VARCHAR(100)")
    else:
        print("'FullName' column already exists.")
        
    # Add PhoneNumber
    if 'PhoneNumber' not in columns:
        print("Adding 'PhoneNumber' column...")
        cursor.execute("ALTER TABLE users ADD COLUMN PhoneNumber VARCHAR(20)")
    else:
        print("'PhoneNumber' column already exists.")
        
    # Add ProfilePhotoPath
    if 'ProfilePhotoPath' not in columns:
        print("Adding 'ProfilePhotoPath' column...")
        cursor.execute("ALTER TABLE users ADD COLUMN ProfilePhotoPath VARCHAR(255)")
    else:
        print("'ProfilePhotoPath' column already exists.")
        
    conn.commit()
    conn.close()
    print("Migration completed successfully.")

if __name__ == "__main__":
    migrate_users_table()
