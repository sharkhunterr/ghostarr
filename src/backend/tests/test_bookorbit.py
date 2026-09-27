"""BookOrbit integration against a fake BookOrbit API."""

import json
from datetime import datetime, timedelta

import httpx
import pytest

from app.integrations.bookorbit import BookOrbitIntegration

NOW = datetime.now()


def _iso(days_ago: float) -> str:
    return (NOW - timedelta(days=days_ago)).isoformat() + "Z"


def _book(book_id: int, title: str, formats: list[str], days_ago: float, **extra):
    return {
        "id": book_id,
        "title": title,
        "authors": ["Author A", "Author B"],
        "seriesName": extra.get("seriesName"),
        "seriesIndex": extra.get("seriesIndex"),
        "files": [{"id": i, "format": f, "role": "main", "sizeBytes": 1000} for i, f in enumerate(formats)],
        "addedAt": _iso(days_ago),
        "hasCover": True,
        "pageCount": 300,
        "publishedYear": 2020,
        "genres": ["Fantasy"],
        "narrators": ["Narrator N"],
    }


LIBRARIES = {
    # Mixed library: an epub, an audiobook, a title with both, and an old epub.
    "1": [
        _book(10, "Recent Epub", ["epub"], 1, seriesName="Saga", seriesIndex="2"),
        _book(11, "Recent Audiobook", ["m4b"], 2),
        _book(12, "Both Formats", ["epub", "mp3"], 3),
        _book(13, "Old Epub", ["epub"], 40),
    ],
    "2": [_book(20, "Comic", ["cbz"], 1)],
}


def _handler(requests_seen: list):
    def handle(request: httpx.Request) -> httpx.Response:
        requests_seen.append(request)
        path = request.url.path
        if path == "/api/v1/auth/login":
            body = json.loads(request.content)
            assert body["clientKind"] == "native"
            if body["password"] != "secret":
                return httpx.Response(401, json={"message": "Invalid credentials"})
            return httpx.Response(200, json={"accessToken": "tok", "refreshToken": "r"})
        if request.headers.get("Authorization") != "Bearer tok":
            return httpx.Response(401, json={"message": "Unauthorized"})
        if path == "/api/v1/libraries":
            return httpx.Response(200, json=[
                {"id": 1, "name": "Mixte", "type": "books"},
                {"id": 2, "name": "BD", "type": "books"},
                {"id": 3, "name": "Podcasts", "type": "podcasts"},
            ])
        if path.startswith("/api/v1/libraries/") and path.endswith("/books"):
            lib = path.split("/")[4]
            body = json.loads(request.content)
            assert body["sort"] == [{"field": "addedAt", "dir": "desc"}]
            page, size = body["pagination"]["page"], body["pagination"]["size"]
            items = LIBRARIES[lib][page * size : (page + 1) * size]
            return httpx.Response(200, json={"items": items, "total": len(LIBRARIES[lib])})
        if path.startswith("/api/v1/books/"):
            return httpx.Response(200, json={"description": "A story", "files": [{"durationSeconds": 3600}, {"durationSeconds": 1800}]})
        return httpx.Response(404)

    return handle


def _integration(requests_seen: list, password: str = "secret") -> BookOrbitIntegration:
    integration = BookOrbitIntegration(url="http://bookorbit:3000", username="ghost", password=password)
    integration._client = httpx.AsyncClient(
        base_url=integration.url,
        transport=httpx.MockTransport(_handler(requests_seen)),
        headers=integration._get_default_headers(),
    )
    return integration


async def test_libraries_and_connection():
    seen: list = []
    integration = _integration(seen)
    assert await integration.get_libraries() == [
        {"id": "1", "name": "Mixte", "type": "books"},
        {"id": "2", "name": "BD", "type": "books"},
    ]
    ok, message, _ = await integration.test_connection()
    assert ok and "2 libraries" in message
    # Logged in once, token reused.
    assert sum(r.url.path == "/api/v1/auth/login" for r in seen) == 1


async def test_bad_password_fails_test():
    integration = _integration([], password="wrong")
    ok, _, _ = await integration.test_connection()
    assert not ok


async def test_splits_books_and_audiobooks_per_library():
    integration = _integration([])
    books, audiobooks = await integration.fetch_books_and_audiobooks(
        days=7, max_items=-1, book_library_ids=["1", "2"], audiobook_library_ids=["1"]
    )
    # Audio-only title stays out of books; old epub is outside the window.
    assert [b.name for b in books] == ["Recent Epub", "Both Formats", "Comic"]
    assert [a.title for a in audiobooks] == ["Recent Audiobook", "Both Formats"]

    epub = books[0]
    assert epub.series_name == "Saga" and epub.number == 2.0
    assert epub.authors == "Author A, Author B"
    assert epub.thumbnail_url == "http://bookorbit:3000/api/v1/books/10/cover"

    audio = audiobooks[0]
    assert audio.duration == 5400
    assert audio.description == "A story"
    assert audio.narrator == "Narrator N"


async def test_only_selected_libraries_are_read():
    seen: list = []
    integration = _integration(seen)
    books, audiobooks = await integration.fetch_books_and_audiobooks(
        days=7, max_items=-1, book_library_ids=["2"], audiobook_library_ids=[]
    )
    assert [b.name for b in books] == ["Comic"]
    assert audiobooks == []
    assert not any("/libraries/1/" in r.url.path for r in seen)


async def test_max_items_caps_each_section():
    integration = _integration([])
    books, audiobooks = await integration.fetch_books_and_audiobooks(
        days=7, max_items=1, book_library_ids=["1"], audiobook_library_ids=["1"]
    )
    assert len(books) == 1 and len(audiobooks) == 1


@pytest.mark.parametrize("missing", ["url", "username", "password"])
async def test_not_configured(missing):
    kwargs = {"url": "http://x", "username": "u", "password": "p"}
    kwargs[missing] = ""
    integration = BookOrbitIntegration(**kwargs)
    assert not integration.is_configured
    assert await integration.fetch_books_and_audiobooks(7, -1, ["1"], ["1"]) == ([], [])
