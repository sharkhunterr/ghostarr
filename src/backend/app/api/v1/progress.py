"""SSE progress streaming endpoint."""

import asyncio
from datetime import datetime

from fastapi import APIRouter
from sse_starlette.sse import EventSourceResponse

from app.core.events import event_manager
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

# Heartbeat interval in seconds
HEARTBEAT_INTERVAL = 15


@router.get("/stream/{generation_id}")
async def stream_progress(generation_id: str):
    """Stream progress events for a generation via Server-Sent Events.

    Includes periodic heartbeats to keep the connection alive.
    """

    async def event_generator():
        """Generate SSE events with heartbeat."""
        logger.info(f"SSE client connected for generation {generation_id}")
        last_heartbeat = datetime.utcnow()

        try:
            async for event in event_manager.subscribe(generation_id):
                yield {
                    "event": event.type,
                    "data": event.to_sse().strip(),
                }

                # Check if we need to send a heartbeat
                now = datetime.utcnow()
                if (now - last_heartbeat).total_seconds() >= HEARTBEAT_INTERVAL:
                    yield {
                        "event": "heartbeat",
                        "data": f'{{"timestamp": "{now.isoformat()}"}}',
                    }
                    last_heartbeat = now

        except asyncio.CancelledError:
            logger.info(f"SSE stream cancelled for generation {generation_id}")

        except Exception as e:
            logger.error(f"SSE stream error: {e}")
            yield {
                "event": "error",
                "data": f'{{"error": "{str(e)}"}}',
            }

        finally:
            logger.info(f"SSE client disconnected for generation {generation_id}")

    return EventSourceResponse(
        event_generator(),
        ping=HEARTBEAT_INTERVAL,
        ping_message_factory=lambda: f'{{"type": "ping", "timestamp": "{datetime.utcnow().isoformat()}"}}',
    )


@router.get("/heartbeat")
async def heartbeat():
    """Heartbeat endpoint for connection keep-alive."""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}
