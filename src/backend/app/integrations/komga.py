"""Komga integration for comics/books library."""

import time
from datetime import datetime, timedelta
from typing import Any

from pydantic import BaseModel

from app.integrations.base import BaseIntegration
from app.core.logging import get_logger

logger = get_logger(__name__)


class BookItem(BaseModel):
    """Book/comic item from Komga."""

    id: str
    name: str
    series_id: str
    series_name: str
    number: float | None = None
    page_count: int = 0
    size_bytes: int = 0
    thumbnail_url: str | None = None
    created: datetime | None = None
    last_modified: datetime | None = None
    metadata: dict[str, Any] = {}


class KomgaIntegration(BaseIntegration[BookItem]):
    """Integration with Komga for comics/books library."""

    SERVICE_NAME = "Komga"

    def _get_default_headers(self) -> dict[str, str]:
        return {
            "Accept": "application/json",
            "X-API-Key": self.api_key,
            "User-Agent": "Ghostarr/1.0",
        }

    async def test_connection(self) -> tuple[bool, str, int | None]:
        """Test connection to Komga."""
        if not self.is_configured:
            return False, "Not configured", None

        try:
            start = time.time()
            response = await self._request("GET", "/api/v1/libraries")
            elapsed_ms = int((time.time() - start) * 1000)

            if isinstance(response, list):
                library_count = len(response)
                return True, f"Connected ({library_count} libraries)", elapsed_ms

            return False, "Invalid response from Komga", elapsed_ms

        except Exception as e:
            logger.error(f"Komga connection test failed: {e}")
            return False, str(e), None

    async def fetch_data(self, days: int = 7, max_items: int = -1, **kwargs: Any) -> list[BookItem]:
        """Fetch recently added books from Komga."""
        if not self.is_configured:
            return []

        items: list[BookItem] = []

        try:
            # Get recently added books
            params: dict[str, Any] = {
                "sort": "createdDate,desc",
                "size": 50 if max_items == -1 else min(max_items, 50),
            }

            response = await self._request("GET", "/api/v1/books", params=params)
            content = response.get("content", [])

            since_date = datetime.now() - timedelta(days=days)

            for book in content:
                created_str = book.get("created")
                if created_str:
                    try:
                        created = datetime.fromisoformat(created_str.replace("Z", "+00:00"))
                        if created.replace(tzinfo=None) < since_date:
                            continue
                    except (ValueError, TypeError):
                        pass

                # Get series info
                series_id = book.get("seriesId", "")
                series_name = book.get("seriesTitle", "")

                book_item = BookItem(
                    id=book.get("id", ""),
                    name=book.get("name", "Unknown"),
                    series_id=series_id,
                    series_name=series_name,
                    number=book.get("number"),
                    page_count=book.get("media", {}).get("pagesCount", 0),
                    size_bytes=book.get("sizeBytes", 0),
                    thumbnail_url=f"{self.url}/api/v1/books/{book.get('id')}/thumbnail",
                    metadata=book.get("metadata", {}),
                )
                items.append(book_item)

                if max_items != -1 and len(items) >= max_items:
                    break

        except Exception as e:
            logger.error(f"Failed to fetch Komga data: {e}")

        return items
