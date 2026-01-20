"""Database connection and session management."""

from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""

    pass


# Ensure config directory exists
config_path = Path(settings.config_dir)
config_path.mkdir(parents=True, exist_ok=True)

# Database URLs
DATABASE_URL = f"sqlite:///{settings.config_dir}/ghostarr.db"
SYNC_DATABASE_URL = DATABASE_URL  # Alias for APScheduler job store
ASYNC_DATABASE_URL = f"sqlite+aiosqlite:///{settings.config_dir}/ghostarr.db"

# SQLite connection args with timeout to prevent locking issues
SQLITE_CONNECT_ARGS = {
    "check_same_thread": False,
    "timeout": 30,  # Wait up to 30 seconds for locks
}

# Sync engine for Alembic migrations
sync_engine = create_engine(
    DATABASE_URL,
    connect_args=SQLITE_CONNECT_ARGS,
    echo=settings.app_env == "development",
)

# Async engine for application with connection pool settings
async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    connect_args=SQLITE_CONNECT_ARGS,
    echo=settings.app_env == "development",
    pool_size=5,  # Number of connections to keep open
    max_overflow=10,  # Additional connections allowed above pool_size
    pool_pre_ping=True,  # Verify connections before using
)


# Enable WAL mode for better concurrency
@event.listens_for(sync_engine, "connect")
def set_sqlite_pragma_sync(dbapi_connection, connection_record):
    """Set SQLite pragmas for better performance and concurrency."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")  # 30 seconds
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()


@event.listens_for(async_engine.sync_engine, "connect")
def set_sqlite_pragma_async(dbapi_connection, connection_record):
    """Set SQLite pragmas for better performance and concurrency."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA busy_timeout=30000")  # 30 seconds
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

# Session factories
SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    autocommit=False,
    autoflush=False,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


def get_sync_db():
    """Get synchronous database session for Alembic."""
    db = SyncSessionLocal()
    try:
        yield db
    finally:
        db.close()
