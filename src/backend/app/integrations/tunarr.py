"""Tunarr integration for TV programming."""

import time
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel

from app.core.logging import get_logger
from app.integrations.base import BaseIntegration

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

    @property
    def is_configured(self) -> bool:
        """Check if integration has required configuration.

        Tunarr can work without authentication, so only URL is required.
        """
        return bool(self.url)

    def _get_default_headers(self) -> dict[str, str]:
        headers = {
            "Accept": "application/json",
            "User-Agent": "Ghostarr/1.0",
        }
        # Only add API key header if provided
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        return headers

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
                # Handle icon field - can be a string or a dict with 'path' key
                icon = ch.get("icon")
                if isinstance(icon, dict):
                    icon_url = icon.get("path")
                elif isinstance(icon, str):
                    icon_url = icon
                else:
                    icon_url = None

                channels.append(
                    TunarrChannel(
                        id=ch.get("id", ""),
                        number=ch.get("number", 0),
                        name=ch.get("name", "Unknown"),
                        icon_url=icon_url,
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

            # First, try to get the guide/schedule data
            # Tunarr uses Unix timestamps in milliseconds for the guide
            int(start_time.timestamp() * 1000)
            int(end_time.timestamp() * 1000)

            try:
                # Try the guide endpoint with channel filter
                logger.info(f"Fetching guide for channels from {start_time} to {end_time}")
                guide_response = await self._request(
                    "GET",
                    "/api/guide/debug",
                )
                logger.info(f"Guide debug response: type={type(guide_response).__name__}, keys={guide_response.keys() if isinstance(guide_response, dict) else 'N/A'}")
                logger.info(f"Guide debug content: {str(guide_response)[:1000]}")
            except Exception as e:
                logger.warning(f"Guide debug failed: {e}")

            for channel_id in channels:
                try:
                    # Use programming endpoint and extract schedule from there
                    logger.info(f"Fetching programming for channel {channel_id}")
                    response = await self._request(
                        "GET",
                        f"/api/channels/{channel_id}/programming",
                    )

                    logger.info(f"Tunarr programming response: type={type(response).__name__}")

                    # The programming endpoint returns channel info with programs dict
                    programs_data = response.get("programs", {}) if isinstance(response, dict) else {}

                    # Convert dict to list
                    if isinstance(programs_data, dict):
                        programs = list(programs_data.values())
                    else:
                        programs = programs_data if isinstance(programs_data, list) else []

                    logger.info(f"Found {len(programs)} programs for channel {channel_id}")

                    if programs:
                        logger.info(f"First program keys: {list(programs[0].keys())}")

                    # Calculate total cycle duration (sum of all program durations)
                    cycle_duration_ms = sum(p.get("duration", 0) for p in programs)
                    if cycle_duration_ms == 0:
                        continue

                    logger.info(f"Channel {channel_id} cycle duration: {cycle_duration_ms / 1000 / 60 / 60:.1f} hours")

                    # Loop through the schedule, repeating programs until we fill the time range
                    current_time = start_time
                    iteration = 0
                    max_iterations = 100  # Safety limit

                    while current_time < end_time and iteration < max_iterations:
                        iteration += 1

                        for prog in programs:
                            # Get duration in milliseconds
                            duration_ms = prog.get("duration", 0)
                            if not duration_ms:
                                continue

                            # Calculate start and end times based on current position
                            prog_start = current_time
                            duration = int(duration_ms / 1000 / 60)  # Convert ms to minutes
                            prog_end = prog_start + timedelta(milliseconds=duration_ms)

                            # Move current time forward
                            current_time = prog_end

                            # Skip programs that end before our start time
                            if prog_end < start_time:
                                continue

                            # Stop if we've passed the end time
                            if prog_start > end_time:
                                break

                            # Handle icon field - can be a string or a dict with 'path' key
                            icon = prog.get("icon") or prog.get("thumbnail")
                            if isinstance(icon, dict):
                                thumbnail_url = icon.get("path")
                            elif isinstance(icon, str):
                                thumbnail_url = icon
                            else:
                                thumbnail_url = None

                            program = ProgramItem(
                                id=f"{prog.get('id') or prog.get('uniqueId', 'prog')}_{iteration}_{prog_start.timestamp()}",
                                title=prog.get("title") or prog.get("name", "Unknown"),
                                start_time=prog_start,
                                end_time=prog_end,
                                duration=duration,
                                channel_id=channel_id,
                                channel_name=channel_map.get(channel_id, "Unknown"),
                                description=prog.get("summary") or prog.get("description"),
                                thumbnail_url=thumbnail_url,
                                type=prog.get("subtype") or prog.get("type", "program"),
                            )
                            items.append(program)

                            if max_items != -1 and len(items) >= max_items:
                                return items

                        # Check if we've passed the end time after completing a cycle
                        if current_time >= end_time:
                            break

                except Exception as e:
                    logger.warning(f"Failed to fetch schedule for channel {channel_id}: {type(e).__name__}: {e}")

        except Exception as e:
            logger.error(f"Failed to fetch Tunarr data: {e}")

        return sorted(items, key=lambda p: (p.start_time, p.channel_name))
