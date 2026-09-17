"""Programmatic Alembic runner — the single schema authority for the backend.

Consolidates the three-way schema authority (Problem #4) so Alembic is the ONLY
place that owns the schema:

  * models.py                       - still declares columns/types (metadata)
  * inline main.py DDL (removed)    - no longer performs schema mutations
  * migrations/                     - owns all CREATE/ALTER (single authority)

Strategy (never touches a database it could damage, never crashes startup):

  * DB with ``alembic_version`` stamped *behind* head
        -> ``alembic upgrade head`` (only pending, guarded/idempotent bullets)
  * DB with ``alembic_version`` stamped *at* head  -> no-op (already current)
  * DB with full schema but NO stamp (fresh install copy of the clean
        baseline)                              -> ``stamp head`` only
  * Completely empty DB                        -> ``upgrade head`` (build all)
  * Any failure -> logged and swallowed; startup never blocks on migrations.
"""

import os
import re
from pathlib import Path
from typing import Optional

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from core.logger import logger

BACKEND_DIR = Path(__file__).resolve().parents[1]
_HEAD_CACHE: Optional[str] = None


def _alembic_config(database_url: str) -> Config:
    """Build an Alembic Config rooted at backend/, driving the shipped alembic.ini."""
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    cfg.set_main_option("sqlalchemy.url", database_url)
    return cfg


def _migration_head(cfg: Config) -> str:
    """Return the current migration-chain head revision id (cached)."""
    global _HEAD_CACHE
    if _HEAD_CACHE is None:
        _HEAD_CACHE = ScriptDirectory.from_config(cfg).get_current_head()
    return _HEAD_CACHE


def _stamped_revision(engine: Engine) -> Optional[str]:
    """Current alembic_version stamp, or None if the table/row is absent."""
    insp = inspect(engine)
    if not insp.has_table("alembic_version"):
        return None
    with engine.connect() as conn:
        row = conn.execute(text("SELECT version_num FROM alembic_version")).fetchone()
    return row[0] if row else None


def _has_schema_tables(engine: Engine) -> bool:
    """True when the DB already contains application tables (any)."""
    insp = inspect(engine)
    # A SQLite DB always has sqlite_sequence/internal tables; ignore those.
    names = [n for n in insp.get_table_names() if not n.startswith("sqlite_")]
    return bool(names)


def run_migrations(engine: Engine) -> bool:
    """Apply/acknowledge Alembic migrations in-process. Never raises.

    Returns True if the schema was upgraded/stamped (or was already current),
    False if migrations could not run safely (logged, startup continues).
    """
    try:
        database_url = os.environ.get("DATABASE_URL", "")
        if not database_url:
            database_url = engine.url.render_as_string(hide_password=False)
        # The env.py script reads DATABASE_URL from the environment; set it so
        # the in-process runner targets exactly the same file as the app engine.
        os.environ["DATABASE_URL"] = database_url

        cfg = _alembic_config(database_url)
        head = _migration_head(cfg)

        stamped = _stamped_revision(engine)

        if stamped == head:
            logger.info(f"Database schema already at migration head ({head}).")
            return True

        if stamped is not None:
            logger.info(f"Database at revision {stamped}; upgrading to head ({head}).")
            command.upgrade(cfg, "head")
            logger.info("Database schema upgraded to head.")
            return True

        if _has_schema_tables(engine):
            # Full schema present but never stamped (clean baseline / fresh copy):
            # acknowledge current version without replaying any DDL.
            logger.info(f"Unstamped schema detected; stamping to head ({head}).")
            command.stamp(cfg, "head")
            logger.info("Database schema acknowledged (stamped to head).")
            return True

        # Truly empty database: build the entire schema from migrations.
        logger.info("Empty database detected; running migrations to build schema.")
        command.upgrade(cfg, "head")
        logger.info("Database schema created via migrations.")
        return True

    except Exception as exc:  # pragma: no cover - defensive boundary
        logger.error(f"Migrations could not be run safely ({exc}); continuing startup.")
        return False
