"""Database connection and session management."""

from collections.abc import AsyncGenerator
from pathlib import Path

from sqlalchemy import create_engine
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

# Sync engine for Alembic migrations
sync_engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=settings.app_env == "development",
)

# Async engine for application
async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=settings.app_env == "development",
)

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
