"""SSE event manager for real-time progress broadcasting."""

import asyncio
import json
from collections.abc import AsyncGenerator
from datetime import datetime
from typing import Any

from app.core.logging import get_logger

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
        # Multiple subscribers per generation (list of queues)
        self._subscribers: dict[str, list[asyncio.Queue[ProgressEvent]]] = {}
        # Store recent events for replay to new subscribers
        self._event_history: dict[str, list[ProgressEvent]] = {}
        # Track completed generations
        self._completed: set[str] = set()

    async def subscribe(self, generation_id: str) -> AsyncGenerator[ProgressEvent, None]:
        """Subscribe to events for a generation."""
        queue: asyncio.Queue[ProgressEvent] = asyncio.Queue()

        # Initialize subscriber list if needed
        if generation_id not in self._subscribers:
            self._subscribers[generation_id] = []

        self._subscribers[generation_id].append(queue)
        logger.debug(f"New subscriber for generation {generation_id} (total: {len(self._subscribers[generation_id])})")

        try:
            # Replay past events to new subscriber
            if generation_id in self._event_history:
                for past_event in self._event_history[generation_id]:
                    yield past_event
                    # If generation already completed, stop after sending all events
                    if past_event.type in ("generation_complete", "generation_cancelled", "generation_error"):
                        return

            # If already completed but no history, check and return
            if generation_id in self._completed:
                return

            # Listen for new events
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)
                    yield event

                    # Stop if generation completed or cancelled
                    if event.type in ("generation_complete", "generation_cancelled", "generation_error"):
                        break
                except TimeoutError:
                    # Check if generation is still active
                    if generation_id in self._completed:
                        break
                    # Continue waiting
                    continue

        finally:
            # Remove this subscriber from the list
            if generation_id in self._subscribers:
                try:
                    self._subscribers[generation_id].remove(queue)
                    if not self._subscribers[generation_id]:
                        del self._subscribers[generation_id]
                except ValueError:
                    pass
            logger.debug(f"Subscriber removed for generation {generation_id}")

    async def publish(self, generation_id: str, event: ProgressEvent) -> None:
        """Publish an event to all subscribers."""
        # Store in history for late subscribers
        if generation_id not in self._event_history:
            self._event_history[generation_id] = []
        self._event_history[generation_id].append(event)

        # Mark as completed if final event
        if event.type in ("generation_complete", "generation_cancelled", "generation_error"):
            self._completed.add(generation_id)
            # Clean up old history after some time (keep for 5 minutes)
            asyncio.create_task(self._cleanup_history(generation_id, delay=300))

        # Send to all active subscribers
        if generation_id in self._subscribers:
            for queue in self._subscribers[generation_id]:
                await queue.put(event)
            logger.debug(f"Published event {event.type} to {len(self._subscribers[generation_id])} subscribers for {generation_id}")
        else:
            logger.debug(f"Published event {event.type} for {generation_id} (no active subscribers, stored in history)")

    async def _cleanup_history(self, generation_id: str, delay: int) -> None:
        """Clean up event history after delay."""
        await asyncio.sleep(delay)
        self._event_history.pop(generation_id, None)
        self._completed.discard(generation_id)
        logger.debug(f"Cleaned up history for generation {generation_id}")

    async def generation_started(
        self,
        generation_id: str,
        steps: list[dict[str, str]],
    ) -> None:
        """Broadcast generation started event with enabled steps."""
        event = ProgressEvent(
            event_type="generation_started",
            step="",
            progress=0,
            message="Generation started",
            data={"steps": steps},
        )
        await self.publish(generation_id, event)

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

    async def step_skipped(
        self,
        generation_id: str,
        step: str,
        progress: int,
        message: str,
    ) -> None:
        """Broadcast step skipped event."""
        event = ProgressEvent(
            event_type="step_skipped",
            step=step,
            progress=progress,
            message=message,
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
