#!/usr/bin/env python3
"""Database initialization script for Docker.

This script handles:
1. Fresh installs: Creates all tables and stamps alembic to head
2. Existing installs with up-to-date schema: Stamps alembic to head
3. Existing installs needing migration: Runs alembic migrations
"""

import os
import sys

from sqlalchemy import create_engine, inspect, text

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:////app/data/ghostarr.db"
)

# Convert async URL to sync for this script
# sqlite+aiosqlite:////path -> sqlite:////path
SYNC_DATABASE_URL = DATABASE_URL.replace("+aiosqlite", "")

# Current alembic head version
ALEMBIC_HEAD = "001_add_scheduled_deletion"


def stamp_alembic(engine):
    """Stamp alembic version to head."""
    print(f"Stamping alembic version to {ALEMBIC_HEAD}...")
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS alembic_version (
                version_num VARCHAR(32) NOT NULL,
                CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
            )
        """))
        conn.execute(text("DELETE FROM alembic_version"))
        conn.execute(text(f"INSERT INTO alembic_version (version_num) VALUES ('{ALEMBIC_HEAD}')"))
        conn.commit()
    print("Alembic stamped to head")


def check_schema_up_to_date(inspector):
    """Check if schema has all columns from latest migration."""
    # Check if schedules table has schedule_type column (added in migration 001)
    if "schedules" in inspector.get_table_names():
        columns = [col["name"] for col in inspector.get_columns("schedules")]
        if "schedule_type" in columns:
            return True
    return False


def init_database():
    """Initialize the database."""
    print(f"Initializing database: {SYNC_DATABASE_URL}")

    # Ensure data directory exists
    db_path = SYNC_DATABASE_URL.replace("sqlite:///", "")
    if db_path.startswith("/"):
        db_dir = os.path.dirname(db_path)
        os.makedirs(db_dir, exist_ok=True)
        print(f"Ensured data directory exists: {db_dir}")

    engine = create_engine(SYNC_DATABASE_URL)
    inspector = inspect(engine)

    # Check existing tables
    existing_tables = inspector.get_table_names()
    print(f"Existing tables: {existing_tables}")

    # Check for actual application tables
    app_tables = {"schedules", "templates", "history", "settings", "logs"}
    has_app_tables = bool(app_tables & set(existing_tables))

    if not has_app_tables:
        # Fresh install - create all tables
        print("Fresh install detected (no application tables), creating all tables...")

        # Import models to register them with Base
        from app.database import Base
        from app.models import (
            History,
            Label,
            Log,
            Schedule,
            Setting,
            Template,
            UserPreference,
            template_labels,
        )

        # Create all tables
        Base.metadata.create_all(bind=engine)
        print("All tables created successfully")

        # Stamp alembic to head
        stamp_alembic(engine)

    elif check_schema_up_to_date(inspector):
        # Tables exist and schema is up to date - just stamp alembic
        print("Existing database with up-to-date schema detected")
        stamp_alembic(engine)

    else:
        # Existing database needs migration
        print("Existing database detected, running alembic migrations...")
        import subprocess
        result = subprocess.run(["alembic", "upgrade", "head"], capture_output=True, text=True)
        print(result.stdout)
        if result.returncode != 0:
            print(f"Alembic error: {result.stderr}", file=sys.stderr)
            sys.exit(1)

    print("Database initialization complete!")


if __name__ == "__main__":
    init_database()
