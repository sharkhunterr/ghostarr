"""BookOrbit integration — ebooks, comics and audiobooks from one server.

BookOrbit has no API keys: clients log in with a user account and get a
short-lived JWT (15 min by default). We log in with ``clientKind=native``
so the token comes back in the JSON body instead of a cookie, and log in
again whenever the token is missing.

A BookOrbit library can hold ebooks and audiobooks side by side, so the
operator picks which libraries feed the "books" section and which feed the
"audiobooks" section. Within a library, a book counts as an audiobook when
it has at least one audio file.
"""

import time
from datetime import datetime, timedelta
from typing import Any

from app.core.logging import get_logger
from app.integrations.audiobookshelf import AudiobookItem
from app.integrations.base import BaseIntegration
from app.integrations.komga import BookItem

logger = get_logger(__name__)

AUDIO_FORMATS = {"m4b", "mp3", "m4a", "opus", "ogg", "flac"}
PAGE_SIZE = 100


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except (ValueError, TypeError):
        return None


def _is_audiobook(book: dict[str, Any]) -> bool:
    return any((f.get("format") or "").lower() in AUDIO_FORMATS for f in book.get("files") or [])


class BookOrbitIntegration(BaseIntegration[BookItem]):
    """Integration with BookOrbit."""

    SERVICE_NAME = "BookOrbit"

    def __init__(self, url: str, api_key: str = "", username: str = "", password: str = ""):
        super().__init__(url, api_key)
        self.username = username or ""
        self.password = password or ""
        self._token: str | None = None

    @property
    def is_configured(self) -> bool:
        return bool(self.url and self.username and self.password)

    def _get_default_headers(self) -> dict[str, str]:
        headers = {"Accept": "application/json", "User-Agent": "Ghostarr/1.0"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"
        return headers

    async def _login(self) -> None:
        if self._token:
            return
        client = await self._get_client()
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "username": self.username,
                "password": self.password,
                "clientKind": "native",
                "deviceLabel": "Ghostarr",
            },
        )
        response.raise_for_status()
        token = response.json().get("accessToken")
        if not token:
            raise ValueError("BookOrbit login returned no access token")
        self._token = token
        client.headers["Authorization"] = f"Bearer {token}"

    async def _authed(self, method: str, path: str, **kwargs: Any) -> Any:
        await self._login()
        return await self._request(method, path, **kwargs)

    async def test_connection(self) -> tuple[bool, str, int | None]:
        if not self.is_configured:
            return False, "Not configured (URL, username and password required)", None
        try:
            start = time.time()
            libraries = await self.get_libraries()
            elapsed_ms = int((time.time() - start) * 1000)
            return True, f"Connected ({len(libraries)} libraries)", elapsed_ms
        except Exception as e:
            logger.error(f"BookOrbit connection test failed: {e}")
            return False, str(e), None

    async def get_libraries(self) -> list[dict[str, Any]]:
        """Book libraries visible to the configured user: ``[{id, name, type}]``.

        Podcast libraries are left out — BookOrbit rejects book queries on them.
        """
        response = await self._authed("GET", "/api/v1/libraries")
        libraries = response if isinstance(response, list) else []
        return [
            {"id": str(lib.get("id")), "name": lib.get("name") or f"#{lib.get('id')}", "type": lib.get("type")}
            for lib in libraries
            if lib.get("id") is not None and (lib.get("type") or "books") == "books"
        ]

    async def _recent_books(self, library_id: str, since: datetime, limit: int) -> list[dict[str, Any]]:
        """Books added since ``since``, newest first (stops paging once past it)."""
        results: list[dict[str, Any]] = []
        page = 0
        while True:
            response = await self._authed(
                "POST",
                f"/api/v1/libraries/{library_id}/books",
                json={
                    "sort": [{"field": "addedAt", "dir": "desc"}],
                    "pagination": {"page": page, "size": PAGE_SIZE},
                },
            )
            items = response.get("items", []) if isinstance(response, dict) else []
            for book in items:
                added = _parse_iso(book.get("addedAt"))
                if added and added < since:
                    return results
                results.append(book)
                if limit != -1 and len(results) >= limit:
                    return results
            if len(items) < PAGE_SIZE:
                return results
            page += 1

    def _cover_url(self, book: dict[str, Any]) -> str | None:
        if not book.get("hasCover") or book.get("id") is None:
            return None
        return f"{self.url}/api/v1/books/{book['id']}/cover"

    async def fetch_data(self, days: int = 7, max_items: int = -1, **kwargs: Any) -> list[BookItem]:
        books, _ = await self.fetch_books_and_audiobooks(
            days=days,
            max_items=max_items,
            book_library_ids=kwargs.get("book_library_ids") or [],
            audiobook_library_ids=[],
        )
        return books

    async def fetch_books_and_audiobooks(
        self,
        days: int,
        max_items: int,
        book_library_ids: list[str],
        audiobook_library_ids: list[str],
    ) -> tuple[list[BookItem], list[AudiobookItem]]:
        """Recently added ebooks/comics and audiobooks from the chosen libraries."""
        if not self.is_configured:
            return [], []

        since = datetime.now() - timedelta(days=days)
        books: list[BookItem] = []
        audiobooks: list[AudiobookItem] = []
        seen_books: set[str] = set()
        seen_audio: set[str] = set()

        for library_id in book_library_ids:
            try:
                raw = await self._recent_books(str(library_id), since, -1)
            except Exception as e:
                logger.error(f"BookOrbit: failed to read library {library_id}: {e}")
                continue
            for book in raw:
                book_id = str(book.get("id"))
                # Audio-only titles belong to the audiobook section.
                if book_id in seen_books or (_is_audiobook(book) and not _has_reading_file(book)):
                    continue
                seen_books.add(book_id)
                books.append(self._to_book_item(book))
                if max_items != -1 and len(books) >= max_items:
                    break

        for library_id in audiobook_library_ids:
            try:
                raw = await self._recent_books(str(library_id), since, -1)
            except Exception as e:
                logger.error(f"BookOrbit: failed to read library {library_id}: {e}")
                continue
            for book in raw:
                book_id = str(book.get("id"))
                if book_id in seen_audio or not _is_audiobook(book):
                    continue
                seen_audio.add(book_id)
                audiobooks.append(await self._to_audiobook_item(book))
                if max_items != -1 and len(audiobooks) >= max_items:
                    break

        return books, audiobooks

    def _to_book_item(self, book: dict[str, Any]) -> BookItem:
        authors = book.get("authors") or []
        number: float | None = None
        try:
            number = float(book["seriesIndex"]) if book.get("seriesIndex") else None
        except (ValueError, TypeError):
            number = None
        size = sum((f.get("sizeBytes") or 0) for f in book.get("files") or [])
        return BookItem(
            id=str(book.get("id")),
            name=book.get("title") or "Unknown",
            series_id=str(book.get("seriesId") or ""),
            series_name=book.get("seriesName") or "",
            number=number,
            page_count=book.get("pageCount") or 0,
            size_bytes=size,
            thumbnail_url=self._cover_url(book),
            summary=None,
            authors=", ".join(authors[:3]) if authors else None,
            release_date=book.get("publishedDate") or (str(book["publishedYear"]) if book.get("publishedYear") else None),
            created=_parse_iso(book.get("addedAt")),
            last_modified=_parse_iso(book.get("updatedAt")),
            metadata={"genres": book.get("genres") or [], "publisher": book.get("publisher")},
        )

    async def _to_audiobook_item(self, book: dict[str, Any]) -> AudiobookItem:
        # The list card has no duration or description; the detail endpoint does.
        duration = 0.0
        description = None
        try:
            detail = await self._authed("GET", f"/api/v1/books/{book.get('id')}")
            duration = float(sum((f.get("durationSeconds") or 0) for f in detail.get("files") or []))
            description = detail.get("description")
        except Exception as e:
            logger.debug(f"BookOrbit: no detail for book {book.get('id')}: {e}")
        authors = book.get("authors") or []
        narrators = book.get("narrators") or []
        return AudiobookItem(
            id=str(book.get("id")),
            title=book.get("title") or "Unknown",
            author=", ".join(authors[:3]) if authors else None,
            narrator=", ".join(narrators[:3]) if narrators else None,
            series=book.get("seriesName"),
            series_sequence=book.get("seriesIndex"),
            description=description,
            cover_url=self._cover_url(book),
            duration=duration,
            published_year=str(book["publishedYear"]) if book.get("publishedYear") else None,
            added_at=_parse_iso(book.get("addedAt")),
            genres=book.get("genres") or [],
        )


def _has_reading_file(book: dict[str, Any]) -> bool:
    return any((f.get("format") or "").lower() not in AUDIO_FORMATS for f in book.get("files") or [])
