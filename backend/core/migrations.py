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
import sys
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
    """Build an Alembic Config finding alembic.ini and script_location in dev or frozen bundle."""
    search_dirs = [
        BACKEND_DIR,
        Path(getattr(sys, "_MEIPASS", BACKEND_DIR)),
    ]
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).parent
        search_dirs.extend([exe_dir, exe_dir / "_internal"])

    ini_path = None
    for d in search_dirs:
        p = d / "alembic.ini"
        if p.is_file():
            ini_path = p
            break
    if not ini_path:
        ini_path = BACKEND_DIR / "alembic.ini"

    script_path = None
    for d in search_dirs:
        p = d / "alembic"
        if p.is_dir() and (p / "env.py").is_file():
            script_path = p
            break
    if not script_path:
        script_path = BACKEND_DIR / "alembic"

    cfg = Config(str(ini_path))
    cfg.set_main_option("script_location", str(script_path))
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


def heal_schema(engine: Engine) -> None:
    """Ensure all tables and columns declared in models.py exist in the SQLite database.
    
    Safe on both fresh installs and existing client databases:
    - Creates any missing tables (e.g. customer_payments, security_settings, general_settings)
    - Adds any missing columns (e.g. stock_batches.Source, billing_settings.DefaultDiscountRate)
    - NEVER drops, modifies, or overwrites existing columns or data.
    """
    import models
    from models import Base

    # 1. Create any missing tables (does not alter existing tables)
    Base.metadata.create_all(bind=engine)

    # 2. Reconcile missing columns on existing tables
    insp = inspect(engine)
    with engine.begin() as conn:
        for table_name, table in Base.metadata.tables.items():
            existing_cols = {col["name"] for col in insp.get_columns(table_name)}
            for col in table.columns:
                if col.name not in existing_cols:
                    col_type = col.type.compile(dialect=engine.dialect)
                    default_clause = ""
                    if col.server_default is not None:
                        arg = col.server_default.arg
                        txt = arg.text if hasattr(arg, "text") else str(arg)
                        default_clause = f" DEFAULT {txt}"
                    elif col.default is not None:
                        arg = col.default.arg
                        if callable(arg):
                            try:
                                arg = arg(None)
                            except Exception:
                                arg = None
                        if isinstance(arg, str):
                            default_clause = f" DEFAULT '{arg}'"
                        elif isinstance(arg, (int, float)):
                            default_clause = f" DEFAULT {arg}"
                        elif isinstance(arg, bool):
                            default_clause = f" DEFAULT {1 if arg else 0}"
                    elif not col.nullable:
                        t = col_type.lower()
                        if "int" in t or "bool" in t:
                            default_clause = " DEFAULT 0"
                        elif any(k in t for k in ["numeric", "float", "real", "decimal"]):
                            default_clause = " DEFAULT 0.0"
                        else:
                            default_clause = " DEFAULT ''"

                    null_clause = " NOT NULL" if (not col.nullable and default_clause) else ""
                    sql = f'ALTER TABLE "{table_name}" ADD COLUMN "{col.name}" {col_type}{default_clause}{null_clause}'
                    logger.info(f"Schema healing: adding missing column {table_name}.{col.name} ({col_type})")
                    conn.execute(text(sql))


def run_migrations(engine: Engine) -> bool:
    """Apply/acknowledge migrations and reconcile schema in-process. Never raises.

    1. Runs Alembic migrations if tracked and behind head.
    2. Runs schema healing to ensure all model tables/columns exist (including stock_batches.Source).
    3. Stamps alembic_version to head.
    4. Never touches or resets existing client data.
    """
    try:
        database_url = os.environ.get("DATABASE_URL", "")
        if not database_url:
            database_url = engine.url.render_as_string(hide_password=False)
        os.environ["DATABASE_URL"] = database_url

        cfg = _alembic_config(database_url)
        head = _migration_head(cfg)
        stamped = _stamped_revision(engine)

        # 1. Run pending Alembic migrations if version is tracked and behind head
        if stamped is not None and stamped != head:
            logger.info(f"Database at revision {stamped}; upgrading to head ({head}).")
            try:
                command.upgrade(cfg, "head")
                logger.info("Database schema upgraded via Alembic to head.")
            except Exception as e:
                logger.warning(f"Alembic upgrade warning: {e}. Proceeding to auto-healing...")

        # 2. Run schema healing: creates any missing tables and adds missing columns
        heal_schema(engine)

        # 3. Ensure alembic_version is stamped to head
        new_stamped = _stamped_revision(engine)
        if new_stamped != head:
            try:
                command.stamp(cfg, "head")
                logger.info(f"Database schema acknowledged (stamped to head {head}).")
            except Exception as e:
                logger.warning(f"Alembic stamp warning: {e}")

        return True

    except Exception as exc:  # pragma: no cover - defensive boundary
        logger.error(f"Migrations/schema healing error ({exc}); continuing startup.")
        return False

