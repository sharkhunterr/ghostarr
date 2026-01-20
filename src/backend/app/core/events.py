"""SSE event manager for real-time progress broadcasting."""

import asyncio
import json
from collections.abc import AsyncGenerator
from datetime import datetime
from typing import Any

from app.core.logging import get_logger
from app.schemas.history import ProgressStep, ProgressStepStatus

logger = get_logger(__name__)


class ProgressEvent:
    """Progress event for SSE broadcasting."""

    def __init__(
        self,
        event_type: str,
        step: str,
        progress: int,
        message: str,
        data: dict[str, Any] | None = None,
    ):
        self.type = event_type
        self.step = step
        self.progress = progress  # 0-100
        self.message = message
        self.data = data or {}
        self.timestamp = datetime.utcnow().isoformat()

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "type": self.type,
            "step": self.step,
            "progress": self.progress,
            "message": self.message,
            "data": self.data,
            "timestamp": self.timestamp,
        }

    def to_sse(self) -> str:
        """Format as SSE event."""
        return f"data: {json.dumps(self.to_dict())}\n\n"


class EventManager:
    """Manager for SSE event broadcasting."""

    def __init__(self):
        self._subscribers: dict[str, asyncio.Queue[ProgressEvent]] = {}
        self._generation_state: dict[str, dict[str, Any]] = {}

    async def subscribe(self, generation_id: str) -> AsyncGenerator[ProgressEvent, None]:
        """Subscribe to events for a generation."""
        queue: asyncio.Queue[ProgressEvent] = asyncio.Queue()
        self._subscribers[generation_id] = queue

        logger.debug(f"New subscriber for generation {generation_id}")

        try:
            while True:
                event = await queue.get()
                yield event

                # Stop if generation completed or cancelled
                if event.type in ("generation_complete", "generation_cancelled", "generation_error"):
                    break
        finally:
            self._subscribers.pop(generation_id, None)
            logger.debug(f"Subscriber removed for generation {generation_id}")

    async def publish(self, generation_id: str, event: ProgressEvent) -> None:
        """Publish an event to subscribers."""
        if generation_id in self._subscribers:
            await self._subscribers[generation_id].put(event)
            logger.debug(f"Published event {event.type} for generation {generation_id}")

    async def step_start(
        self,
        generation_id: str,
        step: str,
        progress: int,
        message: str,
    ) -> None:
        """Broadcast step start event."""
        event = ProgressEvent(
            event_type="step_start",
            step=step,
            progress=progress,
            message=message,
        )
        await self.publish(generation_id, event)

    async def step_complete(
        self,
        generation_id: str,
        step: str,
        progress: int,
        message: str,
        items_count: int | None = None,
    ) -> None:
        """Broadcast step complete event."""
        event = ProgressEvent(
            event_type="step_complete",
            step=step,
            progress=progress,
            message=message,
            data={"items_count": items_count} if items_count is not None else {},
        )
        await self.publish(generation_id, event)

    async def step_error(
        self,
        generation_id: str,
        step: str,
        progress: int,
        message: str,
        error: str,
    ) -> None:
        """Broadcast step error event."""
        event = ProgressEvent(
            event_type="step_error",
            step=step,
            progress=progress,
            message=message,
            data={"error": error},
        )
        await self.publish(generation_id, event)

    async def generation_complete(
        self,
        generation_id: str,
        message: str,
        ghost_post_url: str | None = None,
    ) -> None:
        """Broadcast generation complete event."""
        event = ProgressEvent(
            event_type="generation_complete",
            step="complete",
            progress=100,
            message=message,
            data={"ghost_post_url": ghost_post_url} if ghost_post_url else {},
        )
        await self.publish(generation_id, event)

    async def generation_cancelled(self, generation_id: str, message: str) -> None:
        """Broadcast generation cancelled event."""
        event = ProgressEvent(
            event_type="generation_cancelled",
            step="cancelled",
            progress=-1,
            message=message,
        )
        await self.publish(generation_id, event)

    def has_subscribers(self, generation_id: str) -> bool:
        """Check if generation has active subscribers."""
        return generation_id in self._subscribers


# Global event manager instance
event_manager = EventManager()
