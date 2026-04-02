"""External service integrations package."""

from app.integrations.audiobookshelf import AudiobookshelfIntegration
from app.integrations.base import BaseIntegration
from app.integrations.ghost import GhostIntegration
from app.integrations.komga import KomgaIntegration
from app.integrations.overseerr import OverseerrIntegration
from app.integrations.radarr import RadarrIntegration
from app.integrations.romm import ROMMIntegration
from app.integrations.sonarr import SonarrIntegration
from app.integrations.tautulli import TautulliIntegration
from app.integrations.tmdb import TMDBIntegration
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
    "RadarrIntegration",
    "SonarrIntegration",
    "OverseerrIntegration",
]


def get_integration(
    service: str,
    url: str,
    api_key: str,
    username: str = "",
    password: str = "",
) -> BaseIntegration:
    """Factory function to get integration instance by service name."""
    integrations = {
        "tautulli": TautulliIntegration,
        "tmdb": TMDBIntegration,
        "ghost": GhostIntegration,
        "romm": ROMMIntegration,
        "komga": KomgaIntegration,
        "audiobookshelf": AudiobookshelfIntegration,
        "tunarr": TunarrIntegration,
        "radarr": RadarrIntegration,
        "sonarr": SonarrIntegration,
        "overseerr": OverseerrIntegration,
    }

    if service not in integrations:
        raise ValueError(f"Unknown service: {service}")

    # ROMM supports username/password authentication
    if service == "romm":
        return ROMMIntegration(url=url, api_key=api_key, username=username, password=password)

    return integrations[service](url=url, api_key=api_key)
