from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from core.config import settings

SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=connect_args)

# PMS-Software Phase 4 formalization - approved 2026.
# LOCKED POLICY: foreign_keys stays = ON. Every delete route in api/v1 blocks on
# its dependent children (see category/company/supplier/customer/medicine delete
# guards) and the full reset path uses dependency-ordered DELETE with a pre-
# snapshot. NO route relies on FK-unenforced orphan removal. Keep it this way.
# PRAGMA authority (single source): journal_mode=WAL, busy_timeout=5000,
# synchronous=NORMAL, foreign_keys=ON. No inline overrides anywhere in the app.
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA cache_size=-64000")   # 64 MB page cache
        cursor.execute("PRAGMA mmap_size=268435456")  # 256 MB memory-mapped I/O
        cursor.execute("PRAGMA temp_store=MEMORY")   # temp tables in RAM
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

Base = declarative_base()
