#!/usr/bin/env python3
"""Database initialization script for Docker.

This script handles:
1. Fresh installs: Creates all tables and stamps alembic to head
2. Existing installs: Runs alembic migrations normally
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

    # Check if application tables exist (not just alembic_version)
    existing_tables = inspector.get_table_names()
    print(f"Existing tables: {existing_tables}")

    # Check for actual application tables, not just alembic_version
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

        # Stamp alembic to head (so it knows we're up to date)
        print("Stamping alembic version to head...")
        with engine.connect() as conn:
            # Create alembic_version table if it doesn't exist
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS alembic_version (
                    version_num VARCHAR(32) NOT NULL,
                    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
                )
            """))
            # Insert current head version
            conn.execute(text("DELETE FROM alembic_version"))
            conn.execute(text("INSERT INTO alembic_version (version_num) VALUES ('001_add_scheduled_deletion')"))
            conn.commit()
        print("Alembic stamped to head")

    else:
        # Existing database - run alembic migrations
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
