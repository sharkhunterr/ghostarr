"""Grimmory integration against a fake Grimmory API."""

import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from app.integrations.grimmory import GrimmoryIntegration

NOW = datetime.now(UTC)


def _iso(days_ago: float) -> str:
    return (NOW - timedelta(days=days_ago)).isoformat().replace("+00:00", "Z")


def _book(book_id: int, title: str, types: list[str], days_ago: float, **extra):
    files = [{"id": i, "bookType": t, "fileSizeKb": 2} for i, t in enumerate(types)]
    return {
        "id": book_id,
        "libraryId": 1,
        "libraryName": "Mixte",
        "title": title,
        "addedOn": _iso(days_ago),
        "primaryFile": files[0] if files else None,
        "alternativeFormats": files[1:],
        "isPhysical": extra.get("isPhysical", False),
        "metadata": {
            "title": title,
            "authors": ["Author A", "Author B"],
            "seriesName": extra.get("seriesName"),
            "seriesNumber": extra.get("seriesNumber"),
            "pageCount": 250,
            "publishedDate": "2021-05-04",
            "categories": ["Fantasy"],
            "narrator": "Narrator N",
        },
    }


LIBRARIES = {
    # Deliberately unsorted: the listing endpoint has no ordering guarantee.
    "1": [
        _book(13, "Old Epub", ["EPUB"], 40),
        _book(11, "Recent Audiobook", ["AUDIOBOOK"], 2, seriesName="Saga", seriesNumber=3.0),
        _book(10, "Recent Epub", ["EPUB"], 1, seriesName="Saga", seriesNumber=2.0),
        _book(12, "Both Formats", ["EPUB", "AUDIOBOOK"], 3),
        _book(14, "Physical", [], 1, isPhysical=True),
    ],
    "2": [_book(20, "Comic", ["CBX"], 1)],
}


def _handler(requests_seen: list):
    def handle(request: httpx.Request) -> httpx.Response:
        requests_seen.append(request)
        path = request.url.path
        if path == "/api/v1/auth/login":
            body = json.loads(request.content)
            if body["password"] != "secret":
                return httpx.Response(401, json={"message": "Bad credentials"})
            return httpx.Response(200, json={"accessToken": "tok", "refreshToken": "r", "expires": 1})
        if request.headers.get("Authorization") != "Bearer tok":
            return httpx.Response(401)
        if path == "/api/v1/libraries":
            return httpx.Response(200, json=[{"id": 1, "name": "Mixte"}, {"id": 2, "name": "BD"}])
        if path.startswith("/api/v1/libraries/") and path.endswith("/book"):
            return httpx.Response(200, json=LIBRARIES[path.split("/")[4]])
        if path.startswith("/api/v1/books/"):
            assert request.url.params.get("withDescription") == "true"
            book_id = int(path.rsplit("/", 1)[1])
            book = next(b for lib in LIBRARIES.values() for b in lib if b["id"] == book_id)
            meta = {**book["metadata"], "description": "A story", "audiobookMetadata": {"durationSeconds": 5400}}
            return httpx.Response(200, json={**book, "metadata": meta})
        return httpx.Response(404)

    return handle


def _integration(requests_seen: list, password: str = "secret") -> GrimmoryIntegration:
    integration = GrimmoryIntegration(url="http://grimmory:6060", username="ghost", password=password)
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
        {"id": "1", "name": "Mixte", "type": None},
        {"id": "2", "name": "BD", "type": None},
    ]
    ok, message, _ = await integration.test_connection()
    assert ok and "2 libraries" in message
    assert sum(r.url.path == "/api/v1/auth/login" for r in seen) == 1


async def test_bad_password_fails_test():
    ok, _, _ = await _integration([], password="wrong").test_connection()
    assert not ok


async def test_splits_books_and_audiobooks_newest_first():
    integration = _integration([])
    books, audiobooks = await integration.fetch_books_and_audiobooks(
        days=7, max_items=-1, book_library_ids=["1", "2"], audiobook_library_ids=["1"]
    )
    # Old, physical and audio-only titles stay out of books; newest first.
    assert [b.name for b in books] == ["Recent Epub", "Both Formats", "Comic"]
    assert [a.title for a in audiobooks] == ["Recent Audiobook", "Both Formats"]

    epub = books[0]
    assert epub.series_name == "Saga" and epub.number == 2.0
    assert epub.authors == "Author A, Author B"
    assert epub.release_date == "2021-05-04"
    assert epub.thumbnail_url == "http://grimmory:6060/api/v1/media/book/10/cover"

    audio = audiobooks[0]
    assert audio.duration == 5400
    assert audio.description == "A story"
    assert audio.narrator == "Narrator N"
    assert audio.series_sequence == "3"
    assert audio.published_year == "2021"
    assert audio.cover_url == "http://grimmory:6060/api/v1/media/book/11/audiobook-cover"


async def test_only_selected_libraries_are_read():
    seen: list = []
    books, audiobooks = await _integration(seen).fetch_books_and_audiobooks(
        days=7, max_items=-1, book_library_ids=["2"], audiobook_library_ids=[]
    )
    assert [b.name for b in books] == ["Comic"] and audiobooks == []
    assert not any("/libraries/1/" in r.url.path for r in seen)


async def test_max_items_caps_each_section():
    books, audiobooks = await _integration([]).fetch_books_and_audiobooks(
        days=7, max_items=1, book_library_ids=["1"], audiobook_library_ids=["1"]
    )
    assert len(books) == 1 and len(audiobooks) == 1


@pytest.mark.parametrize("missing", ["url", "username", "password"])
async def test_not_configured(missing):
    kwargs = {"url": "http://x", "username": "u", "password": "p"}
    kwargs[missing] = ""
    integration = GrimmoryIntegration(**kwargs)
    assert not integration.is_configured
    assert await integration.fetch_books_and_audiobooks(7, -1, ["1"], ["1"]) == ([], [])
