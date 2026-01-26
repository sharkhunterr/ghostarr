"""Progress tracker service for newsletter generation."""

from datetime import datetime
from typing import Any

from app.core.events import event_manager
from app.core.logging import get_logger
from app.schemas.history import ProgressStep, ProgressStepStatus

logger = get_logger(__name__)


class GenerationStep:
    """Definition of a generation step."""

    def __init__(
        self,
        step_id: str,
        name: str,
        weight: int = 10,
    ):
        self.step_id = step_id
        self.name = name
        self.weight = weight


# Define all generation steps with their weights (for progress calculation)
GENERATION_STEPS = [
    GenerationStep("fetch_tautulli", "Fetching media from Tautulli", 15),
    GenerationStep("enrich_tmdb", "Enriching with TMDB metadata", 20),
    GenerationStep("fetch_romm", "Fetching games from ROMM", 10),
    GenerationStep("fetch_komga", "Fetching books from Komga", 10),
    GenerationStep("fetch_audiobookshelf", "Fetching audiobooks", 10),
    GenerationStep("fetch_tunarr", "Fetching TV programming", 10),
    GenerationStep("fetch_statistics", "Fetching statistics", 10),
    GenerationStep("render_template", "Rendering template", 10),
    GenerationStep("publish_ghost", "Publishing to Ghost", 5),
]


class ProgressTracker:
    """Tracks and broadcasts progress of newsletter generation."""

    def __init__(self, generation_id: str, enabled_steps: list[str] | None = None):
        """Initialize progress tracker.

        Args:
            generation_id: Unique ID for this generation
            enabled_steps: List of step IDs that will be executed (for accurate progress)
        """
        self.generation_id = generation_id
        self.enabled_steps = enabled_steps or [s.step_id for s in GENERATION_STEPS]
        self.steps: list[ProgressStep] = []
        self.current_step: str | None = None
        self.is_cancelled = False
        self._start_time = datetime.utcnow()
        self._step_start_time: datetime | None = None

        # Calculate total weight for enabled steps
        self._total_weight = sum(
            s.weight for s in GENERATION_STEPS if s.step_id in self.enabled_steps
        )
        self._completed_weight = 0

        # Initialize steps
        for step in GENERATION_STEPS:
            if step.step_id in self.enabled_steps:
                self.steps.append(
                    ProgressStep(
                        step=step.step_id,
                        status=ProgressStepStatus.PENDING,
                        message=step.name,
                    )
                )

    async def broadcast_started(self) -> None:
        """Broadcast generation started event with enabled steps."""
        steps_data = [
            {"step": step.step, "message": step.message}
            for step in self.steps
        ]
        await event_manager.generation_started(
            generation_id=self.generation_id,
            steps=steps_data,
        )
        logger.info(f"Generation {self.generation_id}: Started with {len(self.steps)} steps")

    def _calculate_progress(self) -> int:
        """Calculate overall progress percentage."""
        if self._total_weight == 0:
            return 0
        return min(100, int((self._completed_weight / self._total_weight) * 100))

    def _get_step(self, step_id: str) -> ProgressStep | None:
        """Get step by ID."""
        for step in self.steps:
            if step.step == step_id:
                return step
        return None

    def _get_step_weight(self, step_id: str) -> int:
        """Get weight for a step."""
        for step in GENERATION_STEPS:
            if step.step_id == step_id:
                return step.weight
        return 0

    async def start_step(self, step_id: str, message: str | None = None) -> None:
        """Mark a step as started and broadcast event."""
        if self.is_cancelled:
            return

        step = self._get_step(step_id)
        if not step:
            return

        self.current_step = step_id
        self._step_start_time = datetime.utcnow()

        step.status = ProgressStepStatus.RUNNING
        step.started_at = self._step_start_time.isoformat()
        if message:
            step.message = message

        logger.info(f"Generation {self.generation_id}: Starting step {step_id}")

        await event_manager.step_start(
            generation_id=self.generation_id,
            step=step_id,
            progress=self._calculate_progress(),
            message=step.message,
        )

    async def complete_step(
        self,
        step_id: str,
        message: str | None = None,
        items_count: int | None = None,
    ) -> None:
        """Mark a step as completed and broadcast event."""
        if self.is_cancelled:
            return

        step = self._get_step(step_id)
        if not step:
            return

        now = datetime.utcnow()
        step.status = ProgressStepStatus.SUCCESS
        step.completed_at = now.isoformat()

        if self._step_start_time:
            step.duration_ms = int((now - self._step_start_time).total_seconds() * 1000)

        if items_count is not None:
            step.items_count = items_count
        if message:
            step.message = message

        # Update completed weight
        self._completed_weight += self._get_step_weight(step_id)

        logger.info(
            f"Generation {self.generation_id}: Completed step {step_id} "
            f"({items_count} items, {step.duration_ms}ms)"
        )

        await event_manager.step_complete(
            generation_id=self.generation_id,
            step=step_id,
            progress=self._calculate_progress(),
            message=step.message,
            items_count=items_count,
        )

    async def skip_step(self, step_id: str, message: str = "Skipped") -> None:
        """Mark a step as skipped and broadcast event."""
        if self.is_cancelled:
            return

        step = self._get_step(step_id)
        if not step:
            return

        step.status = ProgressStepStatus.SKIPPED
        step.message = message

        # Still count weight as completed for progress
        self._completed_weight += self._get_step_weight(step_id)

        logger.info(f"Generation {self.generation_id}: Skipped step {step_id}")

        # Broadcast skip event
        await event_manager.step_skipped(
            generation_id=self.generation_id,
            step=step_id,
            progress=self._calculate_progress(),
            message=message,
        )

    async def fail_step(self, step_id: str, error: str) -> None:
        """Mark a step as failed and broadcast event."""
        step = self._get_step(step_id)
        if not step:
            return

        now = datetime.utcnow()
        step.status = ProgressStepStatus.FAILED
        step.completed_at = now.isoformat()
        step.error = error

        if self._step_start_time:
            step.duration_ms = int((now - self._step_start_time).total_seconds() * 1000)

        logger.error(f"Generation {self.generation_id}: Step {step_id} failed: {error}")

        await event_manager.step_error(
            generation_id=self.generation_id,
            step=step_id,
            progress=self._calculate_progress(),
            message=step.message,
            error=error,
        )

    async def complete_generation(
        self,
        message: str = "Generation complete",
        ghost_post_url: str | None = None,
    ) -> None:
        """Mark generation as complete and broadcast event."""
        logger.info(f"Generation {self.generation_id}: Complete")

        await event_manager.generation_complete(
            generation_id=self.generation_id,
            message=message,
            ghost_post_url=ghost_post_url,
        )

    async def cancel_generation(self, message: str = "Generation cancelled") -> None:
        """Mark generation as cancelled and broadcast event."""
        self.is_cancelled = True

        # Mark current step as failed if running
        if self.current_step:
            step = self._get_step(self.current_step)
            if step and step.status == ProgressStepStatus.RUNNING:
                step.status = ProgressStepStatus.FAILED
                step.error = "Cancelled"

        logger.info(f"Generation {self.generation_id}: Cancelled")

        await event_manager.generation_cancelled(
            generation_id=self.generation_id,
            message=message,
        )

    def get_progress_log(self) -> list[dict[str, Any]]:
        """Get progress log as list of dicts."""
        return [step.model_dump() for step in self.steps]

    def get_total_duration(self) -> float:
        """Get total duration in seconds."""
        return (datetime.utcnow() - self._start_time).total_seconds()

    def get_total_items(self) -> int:
        """Get total items processed across all steps."""
        return sum(step.items_count or 0 for step in self.steps)
