"""Deletion service for cleanup operations."""

from datetime import datetime, timedelta

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.history import GenerationStatus, GenerationType, History
from app.models.setting import Setting

logger = get_logger(__name__)


class DeletionService:
    """Service for handling deletion operations."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def should_log_deletions(self) -> bool:
        """Check if deletion logging is enabled."""
        setting = await self.db.get(Setting, "preferences.log_deletions")
        return setting.value if setting else True  # Default to True

    async def execute_cleanup(
        self,
        retention_days: int,
        delete_from_ghost: bool = False,
        schedule_id: str | None = None,
    ) -> dict:
        """Execute cleanup of old history entries.

        Args:
            retention_days: Delete entries older than this many days
            delete_from_ghost: Also delete associated Ghost posts
            schedule_id: If from a scheduled job

        Returns:
            Dict with deletion results
        """
        from app.integrations.ghost import ghost_client

        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

        # Find entries to delete (only generation entries, not deletion logs)
        result = await self.db.execute(
            select(History).where(
                and_(
                    History.created_at < cutoff_date,
                    History.type != GenerationType.DELETION,
                )
            )
        )
        entries = result.scalars().all()

        deleted_count = 0
        ghost_deleted_count = 0
        errors: list[str] = []

        for entry in entries:
            # Delete from Ghost if requested and post exists
            if delete_from_ghost and entry.ghost_post_id:
                try:
                    await ghost_client.delete_post(entry.ghost_post_id)
                    ghost_deleted_count += 1
                except Exception as e:
                    logger.warning(f"Failed to delete Ghost post {entry.ghost_post_id}: {e}")
                    errors.append(f"Ghost post {entry.ghost_post_id}: {str(e)}")

            await self.db.delete(entry)
            deleted_count += 1

        await self.db.commit()

        deletion_result = {
            "deleted_count": deleted_count,
            "ghost_deleted_count": ghost_deleted_count,
            "retention_days": retention_days,
            "errors": errors if errors else None,
        }

        # Log deletion in history if enabled
        if await self.should_log_deletions():
            await self._create_deletion_history(
                deletion_result=deletion_result,
                schedule_id=schedule_id,
            )

        logger.info(
            f"Cleanup complete: {deleted_count} entries deleted, "
            f"{ghost_deleted_count} Ghost posts deleted"
        )
        return deletion_result

    async def log_manual_deletion(
        self,
        deleted_count: int,
        ghost_deleted_count: int = 0,
        errors: list[str] | None = None,
    ) -> None:
        """Log a manual deletion action from the History page."""
        if not await self.should_log_deletions():
            return

        deletion_result = {
            "deleted_count": deleted_count,
            "ghost_deleted_count": ghost_deleted_count,
            "retention_days": 0,  # Manual deletion, no retention period
            "errors": errors,
        }

        await self._create_deletion_history(
            deletion_result=deletion_result,
            schedule_id=None,
        )

    async def _create_deletion_history(
        self,
        deletion_result: dict,
        schedule_id: str | None = None,
    ) -> None:
        """Create a history entry for a deletion operation."""
        history = History(
            type=GenerationType.DELETION,
            status=GenerationStatus.SUCCESS,
            schedule_id=schedule_id,
            template_id=None,
            generation_config=None,
            items_count=deletion_result["deleted_count"],
            deletion_result=deletion_result,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
        )
        self.db.add(history)
        await self.db.commit()
