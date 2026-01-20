"""External service integrations package."""

from app.integrations.base import BaseIntegration
from app.integrations.tautulli import TautulliIntegration
from app.integrations.tmdb import TMDBIntegration
from app.integrations.ghost import GhostIntegration
from app.integrations.romm import ROMMIntegration
from app.integrations.komga import KomgaIntegration
from app.integrations.audiobookshelf import AudiobookshelfIntegration
from app.integrations.tunarr import TunarrIntegration

__all__ = [
    "BaseIntegration",
    "TautulliIntegration",
    "TMDBIntegration",
    "GhostIntegration",
    "ROMMIntegration",
    "KomgaIntegration",
    "AudiobookshelfIntegration",
    "TunarrIntegration",
]


def get_integration(service: str, url: str, api_key: str) -> BaseIntegration:
    """Factory function to get integration instance by service name."""
    integrations = {
        "tautulli": TautulliIntegration,
        "tmdb": TMDBIntegration,
        "ghost": GhostIntegration,
        "romm": ROMMIntegration,
        "komga": KomgaIntegration,
        "audiobookshelf": AudiobookshelfIntegration,
        "tunarr": TunarrIntegration,
    }

    if service not in integrations:
        raise ValueError(f"Unknown service: {service}")

    return integrations[service](url=url, api_key=api_key)
