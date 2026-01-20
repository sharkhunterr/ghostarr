"""Tautulli integration for media server statistics."""

import time
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel

from app.integrations.base import BaseIntegration
from app.core.logging import get_logger

logger = get_logger(__name__)


class MediaItem(BaseModel):
    """Media item from Tautulli."""

    title: str
    year: int | None = None
    media_type: str  # "movie" or "episode"
    rating_key: str
    thumb: str | None = None
    art: str | None = None
    added_at: datetime | None = None
    grandparent_title: str | None = None  # Series name for episodes
    parent_media_index: int | None = None  # Season number
    media_index: int | None = None  # Episode number
    tmdb_id: str | None = None
    imdb_id: str | None = None


class TautulliStatistics(BaseModel):
    """Statistics from Tautulli."""

    total_plays: int = 0
    total_duration: int = 0  # seconds
    movies_plays: int = 0
    series_plays: int = 0
    unique_users: int = 0
    top_movies: list[dict[str, Any]] = []
    top_shows: list[dict[str, Any]] = []


class TautulliIntegration(BaseIntegration[MediaItem]):
    """Integration with Tautulli for Plex/Jellyfin statistics."""

    SERVICE_NAME = "Tautulli"

    def _get_default_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "User-Agent": "Ghostarr/1.0",
        }

    async def test_connection(self) -> tuple[bool, str, int | None]:
        """Test connection to Tautulli."""
        if not self.is_configured:
            return False, "Not configured", None

        try:
            start = time.time()
            response = await self._request(
                "GET",
                "/api/v2",
                params={"apikey": self.api_key, "cmd": "get_server_info"},
            )
            elapsed_ms = int((time.time() - start) * 1000)

            if response.get("response", {}).get("result") == "success":
                server_name = response.get("response", {}).get("data", {}).get("pms_name", "Unknown")
                return True, f"Connected to {server_name}", elapsed_ms

            return False, "Invalid response from Tautulli", elapsed_ms

        except Exception as e:
            logger.error(f"Tautulli connection test failed: {e}")
            return False, str(e), None

    async def fetch_data(self, days: int = 7, max_items: int = -1, **kwargs: Any) -> list[MediaItem]:
        """Fetch recently added media from Tautulli."""
        if not self.is_configured:
            return []

        items: list[MediaItem] = []
        since_date = datetime.now() - timedelta(days=days)
        since_timestamp = int(since_date.timestamp())

        try:
            # Fetch recently added
            response = await self._request(
                "GET",
                "/api/v2",
                params={
                    "apikey": self.api_key,
                    "cmd": "get_recently_added",
                    "count": 100 if max_items == -1 else max_items,
                },
            )

            data = response.get("response", {}).get("data", {})
            recently_added = data.get("recently_added", [])

            for item in recently_added:
                added_at = item.get("added_at", 0)
                if added_at < since_timestamp:
                    continue

                media_item = MediaItem(
                    title=item.get("title", "Unknown"),
                    year=item.get("year"),
                    media_type="episode" if item.get("media_type") == "episode" else "movie",
                    rating_key=str(item.get("rating_key", "")),
                    thumb=item.get("thumb"),
                    art=item.get("art"),
                    added_at=datetime.fromtimestamp(added_at) if added_at else None,
                    grandparent_title=item.get("grandparent_title"),
                    parent_media_index=item.get("parent_media_index"),
                    media_index=item.get("media_index"),
                )
                items.append(media_item)

                if max_items != -1 and len(items) >= max_items:
                    break

        except Exception as e:
            logger.error(f"Failed to fetch Tautulli data: {e}")

        return items

    async def fetch_statistics(self, days: int = 7) -> TautulliStatistics:
        """Fetch viewing statistics from Tautulli."""
        if not self.is_configured:
            return TautulliStatistics()

        stats = TautulliStatistics()

        try:
            # Get home stats
            response = await self._request(
                "GET",
                "/api/v2",
                params={
                    "apikey": self.api_key,
                    "cmd": "get_home_stats",
                    "time_range": days,
                    "stats_type": "duration",
                },
            )

            data = response.get("response", {}).get("data", [])

            for stat in data:
                stat_id = stat.get("stat_id", "")
                rows = stat.get("rows", [])

                if stat_id == "top_movies":
                    stats.top_movies = rows[:5]
                elif stat_id == "top_tv":
                    stats.top_shows = rows[:5]
                elif stat_id == "top_users":
                    stats.unique_users = len(rows)

            # Get library stats for total plays
            lib_response = await self._request(
                "GET",
                "/api/v2",
                params={
                    "apikey": self.api_key,
                    "cmd": "get_plays_by_date",
                    "time_range": days,
                },
            )

            plays_data = lib_response.get("response", {}).get("data", {})
            if plays_data.get("series"):
                for day_data in plays_data.get("series", []):
                    for point in day_data.get("data", []):
                        stats.total_plays += point

        except Exception as e:
            logger.error(f"Failed to fetch Tautulli statistics: {e}")

        return stats
