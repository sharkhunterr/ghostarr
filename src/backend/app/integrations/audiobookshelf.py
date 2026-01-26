"""Audiobookshelf integration for audiobook library."""

import time
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel

from app.core.logging import get_logger
from app.integrations.base import BaseIntegration

logger = get_logger(__name__)


class AudiobookItem(BaseModel):
    """Audiobook item from Audiobookshelf."""

    id: str
    title: str
    author: str | None = None
    narrator: str | None = None
    series: str | None = None
    series_sequence: str | None = None
    description: str | None = None
    cover_url: str | None = None
    duration: float = 0  # seconds
    added_at: datetime | None = None
    genres: list[str] = []


class AudiobookshelfIntegration(BaseIntegration[AudiobookItem]):
    """Integration with Audiobookshelf for audiobooks."""

    SERVICE_NAME = "Audiobookshelf"

    def _get_default_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "User-Agent": "Ghostarr/1.0",
        }

    async def test_connection(self) -> tuple[bool, str, int | None]:
        """Test connection to Audiobookshelf."""
        if not self.is_configured:
            return False, "Not configured", None

        try:
            start = time.time()
            response = await self._request("GET", "/api/libraries")
            elapsed_ms = int((time.time() - start) * 1000)

            libraries = response.get("libraries", [])
            if isinstance(libraries, list):
                return True, f"Connected ({len(libraries)} libraries)", elapsed_ms

            return False, "Invalid response from Audiobookshelf", elapsed_ms

        except Exception as e:
            logger.error(f"Audiobookshelf connection test failed: {e}")
            return False, str(e), None

    async def fetch_data(self, days: int = 7, max_items: int = -1, **kwargs: Any) -> list[AudiobookItem]:
        """Fetch recently added audiobooks from Audiobookshelf."""
        if not self.is_configured:
            return []

        items: list[AudiobookItem] = []
        since_date = datetime.now() - timedelta(days=days)
        since_timestamp = int(since_date.timestamp() * 1000)  # ms

        try:
            # Get libraries first
            libs_response = await self._request("GET", "/api/libraries")
            libraries = libs_response.get("libraries", [])

            for library in libraries:
                library_id = library.get("id")
                if not library_id:
                    continue

                # Get recent items from library
                params: dict[str, Any] = {
                    "sort": "addedAt",
                    "desc": 1,
                    "limit": 50 if max_items == -1 else min(max_items, 50),
                }

                response = await self._request(
                    "GET",
                    f"/api/libraries/{library_id}/items",
                    params=params,
                )

                results = response.get("results", [])

                for item in results:
                    added_at = item.get("addedAt", 0)
                    if added_at < since_timestamp:
                        continue

                    media = item.get("media", {})
                    metadata = media.get("metadata", {})

                    audiobook = AudiobookItem(
                        id=item.get("id", ""),
                        title=metadata.get("title", "Unknown"),
                        author=metadata.get("authorName"),
                        narrator=metadata.get("narratorName"),
                        series=metadata.get("seriesName"),
                        series_sequence=metadata.get("series", {}).get("sequence") if metadata.get("series") else None,
                        description=metadata.get("description"),
                        cover_url=f"{self.url}/api/items/{item.get('id')}/cover" if item.get("id") else None,
                        duration=media.get("duration", 0),
                        added_at=datetime.fromtimestamp(added_at / 1000) if added_at else None,
                        genres=metadata.get("genres", []),
                    )
                    items.append(audiobook)

                    if max_items != -1 and len(items) >= max_items:
                        return items

        except Exception as e:
            logger.error(f"Failed to fetch Audiobookshelf data: {e}")

        return items
