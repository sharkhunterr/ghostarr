"""Grimmory integration (community fork of BookLore) — ebooks, comics, audiobooks.

Grimmory has no API keys: clients log in with a user account
(``POST /api/v1/auth/login``) and get a JWT sent as a bearer token.

A Grimmory library can hold ebooks and audiobooks side by side, so the
operator picks which libraries feed the "books" section and which feed the
"audiobooks" section. A book counts as an audiobook when its primary file or
one of its alternative formats is of type ``AUDIOBOOK``.
"""

import time
from datetime import datetime, timedelta
from typing import Any

from app.core.logging import get_logger
from app.integrations.audiobookshelf import AudiobookItem
from app.integrations.base import BaseIntegration
from app.integrations.komga import BookItem

logger = get_logger(__name__)

AUDIO_TYPE = "AUDIOBOOK"


def _parse_instant(value: Any) -> datetime | None:
    """Spring serializes ``Instant`` as ISO-8601; tolerate epoch seconds too."""
    if value is None or value == "":
        return None
    if isinstance(value, int | float):
        return datetime.fromtimestamp(value)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone().replace(tzinfo=None)
    return parsed


def _file_types(book: dict[str, Any]) -> list[str]:
    files = [book.get("primaryFile") or {}, *(book.get("alternativeFormats") or [])]
    return [(f.get("bookType") or "").upper() for f in files if f]


def _is_audiobook(book: dict[str, Any]) -> bool:
    return AUDIO_TYPE in _file_types(book)


def _has_reading_file(book: dict[str, Any]) -> bool:
    return any(t and t != AUDIO_TYPE for t in _file_types(book))


class GrimmoryIntegration(BaseIntegration[BookItem]):
    """Integration with Grimmory."""

    SERVICE_NAME = "Grimmory"

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
            json={"username": self.username, "password": self.password},
        )
        response.raise_for_status()
        token = response.json().get("accessToken")
        if not token:
            raise ValueError("Grimmory login returned no access token")
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
            logger.error(f"Grimmory connection test failed: {e}")
            return False, str(e), None

    async def get_libraries(self) -> list[dict[str, Any]]:
        """Libraries visible to the configured user: ``[{id, name, type}]``."""
        response = await self._authed("GET", "/api/v1/libraries")
        libraries = response if isinstance(response, list) else []
        return [
            {"id": str(lib.get("id")), "name": lib.get("name") or f"#{lib.get('id')}", "type": None}
            for lib in libraries
            if lib.get("id") is not None
        ]

    async def _recent_books(self, library_id: str, since: datetime) -> list[dict[str, Any]]:
        """Books added since ``since``, newest first.

        Grimmory's per-library listing returns the whole library in one call
        (no server-side date filter), so the window is applied here.
        """
        response = await self._authed("GET", f"/api/v1/libraries/{library_id}/book")
        books = response if isinstance(response, list) else []
        recent = []
        for book in books:
            added = _parse_instant(book.get("addedOn"))
            if added and added >= since and not book.get("isPhysical"):
                recent.append((added, book))
        recent.sort(key=lambda pair: pair[0], reverse=True)
        return [book for _, book in recent]

    def _cover_url(self, book_id: Any, audiobook: bool) -> str | None:
        if book_id is None:
            return None
        kind = "audiobook-cover" if audiobook else "cover"
        return f"{self.url}/api/v1/media/book/{book_id}/{kind}"

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
            if max_items != -1 and len(books) >= max_items:
                break
            try:
                raw = await self._recent_books(str(library_id), since)
            except Exception as e:
                logger.error(f"Grimmory: failed to read library {library_id}: {e}")
                continue
            for book in raw:
                book_id = str(book.get("id"))
                # Audio-only titles belong to the audiobook section.
                if book_id in seen_books or not _has_reading_file(book):
                    continue
                seen_books.add(book_id)
                books.append(self._to_book_item(book))
                if max_items != -1 and len(books) >= max_items:
                    break

        for library_id in audiobook_library_ids:
            if max_items != -1 and len(audiobooks) >= max_items:
                break
            try:
                raw = await self._recent_books(str(library_id), since)
            except Exception as e:
                logger.error(f"Grimmory: failed to read library {library_id}: {e}")
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
        meta = book.get("metadata") or {}
        authors = meta.get("authors") or []
        files = [book.get("primaryFile") or {}, *(book.get("alternativeFormats") or [])]
        size_kb = sum((f.get("fileSizeKb") or 0) for f in files if f)
        published = meta.get("publishedDate")
        return BookItem(
            id=str(book.get("id")),
            name=meta.get("title") or book.get("title") or "Unknown",
            series_id="",
            series_name=meta.get("seriesName") or "",
            number=meta.get("seriesNumber"),
            page_count=meta.get("pageCount") or 0,
            size_bytes=size_kb * 1024,
            thumbnail_url=self._cover_url(book.get("id"), audiobook=False),
            summary=meta.get("description") or None,
            authors=", ".join(authors[:3]) if authors else None,
            release_date=str(published) if published else None,
            created=_parse_instant(book.get("addedOn")),
            last_modified=None,
            metadata={"genres": sorted(meta.get("categories") or []), "library": book.get("libraryName")},
        )

    async def _to_audiobook_item(self, book: dict[str, Any]) -> AudiobookItem:
        meta = book.get("metadata") or {}
        # The library listing omits the description; the detail call has it.
        try:
            detail = await self._authed("GET", f"/api/v1/books/{book.get('id')}", params={"withDescription": "true"})
            meta = (detail or {}).get("metadata") or meta
        except Exception as e:
            logger.debug(f"Grimmory: no detail for book {book.get('id')}: {e}")
        authors = meta.get("authors") or []
        audio_meta = meta.get("audiobookMetadata") or {}
        published = meta.get("publishedDate")
        series_number = meta.get("seriesNumber")
        return AudiobookItem(
            id=str(book.get("id")),
            title=meta.get("title") or book.get("title") or "Unknown",
            author=", ".join(authors[:3]) if authors else None,
            narrator=meta.get("narrator"),
            series=meta.get("seriesName"),
            series_sequence=(
                str(int(series_number)) if isinstance(series_number, float) and series_number.is_integer()
                else str(series_number) if series_number is not None else None
            ),
            description=meta.get("description"),
            cover_url=self._cover_url(book.get("id"), audiobook=True),
            duration=float(audio_meta.get("durationSeconds") or 0),
            published_year=str(published)[:4] if published else None,
            added_at=_parse_instant(book.get("addedOn")),
            genres=sorted(meta.get("categories") or []),
        )

