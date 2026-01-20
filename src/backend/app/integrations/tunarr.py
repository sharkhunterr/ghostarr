"""Tunarr integration for TV programming."""

import time
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel

from app.integrations.base import BaseIntegration
from app.core.logging import get_logger

logger = get_logger(__name__)


class TunarrChannel(BaseModel):
    """Channel from Tunarr."""

    id: str
    number: int
    name: str
    icon_url: str | None = None
    group: str | None = None


class ProgramItem(BaseModel):
    """Program item from Tunarr schedule."""

    id: str
    title: str
    start_time: datetime
    end_time: datetime
    duration: int  # minutes
    channel_id: str
    channel_name: str
    description: str | None = None
    thumbnail_url: str | None = None
    type: str = "program"  # program, movie, episode


class TunarrIntegration(BaseIntegration[ProgramItem]):
    """Integration with Tunarr for TV programming."""

    SERVICE_NAME = "Tunarr"

    def _get_default_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "X-API-Key": self.api_key,
            "User-Agent": "Ghostarr/1.0",
        }

    async def test_connection(self) -> tuple[bool, str, int | None]:
        """Test connection to Tunarr."""
        if not self.is_configured:
            return False, "Not configured", None

        try:
            start = time.time()
            response = await self._request("GET", "/api/channels")
            elapsed_ms = int((time.time() - start) * 1000)

            if isinstance(response, list):
                channel_count = len(response)
                return True, f"Connected ({channel_count} channels)", elapsed_ms

            return False, "Invalid response from Tunarr", elapsed_ms

        except Exception as e:
            logger.error(f"Tunarr connection test failed: {e}")
            return False, str(e), None

    async def get_channels(self) -> list[TunarrChannel]:
        """Get available channels from Tunarr."""
        if not self.is_configured:
            return []

        try:
            response = await self._request("GET", "/api/channels")

            channels = []
            for ch in response:
                channels.append(
                    TunarrChannel(
                        id=ch.get("id", ""),
                        number=ch.get("number", 0),
                        name=ch.get("name", "Unknown"),
                        icon_url=ch.get("icon"),
                        group=ch.get("groupTitle"),
                    )
                )

            return sorted(channels, key=lambda c: c.number)

        except Exception as e:
            logger.error(f"Failed to fetch Tunarr channels: {e}")
            return []

    async def fetch_data(
        self,
        days: int = 7,
        max_items: int = -1,
        channels: list[str] | None = None,
        **kwargs: Any,
    ) -> list[ProgramItem]:
        """Fetch programming schedule from Tunarr."""
        if not self.is_configured:
            return []

        items: list[ProgramItem] = []
        start_time = datetime.now()
        end_time = start_time + timedelta(days=days)

        try:
            # Get all channels if none specified
            if not channels:
                all_channels = await self.get_channels()
                channels = [ch.id for ch in all_channels]

            channel_map: dict[str, str] = {}
            all_channels = await self.get_channels()
            for ch in all_channels:
                channel_map[ch.id] = ch.name

            for channel_id in channels:
                # Get schedule for channel
                params = {
                    "from": start_time.isoformat(),
                    "to": end_time.isoformat(),
                }

                try:
                    response = await self._request(
                        "GET",
                        f"/api/channels/{channel_id}/programs",
                        params=params,
                    )

                    programs = response if isinstance(response, list) else response.get("programs", [])

                    for prog in programs:
                        start_str = prog.get("start")
                        stop_str = prog.get("stop")

                        if not start_str or not stop_str:
                            continue

                        try:
                            prog_start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
                            prog_end = datetime.fromisoformat(stop_str.replace("Z", "+00:00"))
                        except (ValueError, TypeError):
                            continue

                        duration = int((prog_end - prog_start).total_seconds() / 60)

                        program = ProgramItem(
                            id=prog.get("id", f"{channel_id}_{start_str}"),
                            title=prog.get("title", "Unknown"),
                            start_time=prog_start,
                            end_time=prog_end,
                            duration=duration,
                            channel_id=channel_id,
                            channel_name=channel_map.get(channel_id, "Unknown"),
                            description=prog.get("description"),
                            thumbnail_url=prog.get("icon"),
                            type=prog.get("type", "program"),
                        )
                        items.append(program)

                        if max_items != -1 and len(items) >= max_items:
                            return items

                except Exception as e:
                    logger.warning(f"Failed to fetch schedule for channel {channel_id}: {e}")

        except Exception as e:
            logger.error(f"Failed to fetch Tunarr data: {e}")

        return sorted(items, key=lambda p: (p.start_time, p.channel_name))
