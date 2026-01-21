"""Settings API endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.setting import Setting
from app.models.user_preference import UserPreference, Theme, SUPPORTED_LANGUAGES
from app.schemas.settings import (
    ServiceConfig,
    ServiceConfigResponse,
    ServiceTestResult,
    AllServicesStatus,
    PreferencesUpdate,
    PreferencesResponse,
    RetentionSettings,
)
from app.services.crypto_service import crypto_service
from app.integrations import get_integration
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter()

SERVICES = ["tautulli", "tmdb", "ghost", "romm", "komga", "audiobookshelf", "tunarr"]

# Services that don't require URL (have default API endpoint)
SERVICES_WITHOUT_URL = ["tmdb"]

# Services that support username/password authentication
SERVICES_WITH_BASIC_AUTH = ["romm"]


def _mask_api_key(api_key: str | None) -> str | None:
    """Mask API key showing only last 4 characters."""
    if not api_key:
        return None
    if len(api_key) < 8:
        return "****"
    return f"{'*' * (len(api_key) - 4)}{api_key[-4:]}"


async def _get_service_config(db: AsyncSession, service: str) -> dict | None:
    """Get service configuration from database."""
    setting = await db.get(Setting, f"services.{service}")
    if setting:
        return setting.value
    return None


async def _save_service_config(db: AsyncSession, service: str, config: dict) -> None:
    """Save service configuration to database."""
    key = f"services.{service}"
    setting = await db.get(Setting, key)

    if setting:
        setting.value = config
    else:
        setting = Setting(key=key, value=config)
        db.add(setting)

    await db.commit()


@router.get("/services", response_model=dict[str, ServiceConfigResponse])
async def get_all_services(db: AsyncSession = Depends(get_db)):
    """Get configuration status for all services."""
    result = {}

    for service in SERVICES:
        config = await _get_service_config(db, service)
        if config:
            # Decrypt API key for masking
            api_key_encrypted = config.get("api_key_encrypted", "")
            api_key = crypto_service.decrypt(api_key_encrypted) if api_key_encrypted else None

            # Decrypt password for masking (for services with basic auth)
            password_encrypted = config.get("password_encrypted", "")
            password = crypto_service.decrypt(password_encrypted) if password_encrypted else None
            username = config.get("username", "")

            # For services without URL requirement, only check API key
            if service in SERVICES_WITHOUT_URL:
                is_configured = bool(api_key_encrypted)
            elif service in SERVICES_WITH_BASIC_AUTH:
                # For services with basic auth, either username/password or api_key is valid
                has_basic_auth = bool(username and password_encrypted)
                has_api_key = bool(api_key_encrypted)
                is_configured = bool(config.get("url") and (has_basic_auth or has_api_key))
            else:
                is_configured = bool(config.get("url") and api_key_encrypted)

            result[service] = ServiceConfigResponse(
                url=config.get("url"),
                api_key_masked=_mask_api_key(api_key),
                username=username if service in SERVICES_WITH_BASIC_AUTH else None,
                password_masked=_mask_api_key(password) if service in SERVICES_WITH_BASIC_AUTH else None,
                is_configured=is_configured,
            )
        else:
            result[service] = ServiceConfigResponse(is_configured=False)

    return result


@router.get("/services/{service}", response_model=ServiceConfigResponse)
async def get_service_config(service: str, db: AsyncSession = Depends(get_db)):
    """Get configuration for a specific service."""
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail=f"Unknown service: {service}")

    config = await _get_service_config(db, service)
    if not config:
        return ServiceConfigResponse(is_configured=False)

    api_key_encrypted = config.get("api_key_encrypted", "")
    api_key = crypto_service.decrypt(api_key_encrypted) if api_key_encrypted else None

    # Decrypt password for masking (for services with basic auth)
    password_encrypted = config.get("password_encrypted", "")
    password = crypto_service.decrypt(password_encrypted) if password_encrypted else None
    username = config.get("username", "")

    # For services without URL requirement, only check API key
    if service in SERVICES_WITHOUT_URL:
        is_configured = bool(api_key_encrypted)
    elif service in SERVICES_WITH_BASIC_AUTH:
        # For services with basic auth, either username/password or api_key is valid
        has_basic_auth = bool(username and password_encrypted)
        has_api_key = bool(api_key_encrypted)
        is_configured = bool(config.get("url") and (has_basic_auth or has_api_key))
    else:
        is_configured = bool(config.get("url") and api_key_encrypted)

    return ServiceConfigResponse(
        url=config.get("url"),
        api_key_masked=_mask_api_key(api_key),
        username=username if service in SERVICES_WITH_BASIC_AUTH else None,
        password_masked=_mask_api_key(password) if service in SERVICES_WITH_BASIC_AUTH else None,
        is_configured=is_configured,
    )


@router.put("/services/{service}", response_model=ServiceConfigResponse)
async def update_service_config(
    service: str,
    config: ServiceConfig,
    db: AsyncSession = Depends(get_db),
):
    """Update configuration for a specific service."""
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail=f"Unknown service: {service}")

    # Get existing config to preserve values not being updated
    existing = await _get_service_config(db, service) or {}

    new_config = {}

    # Update URL if provided
    if config.url is not None:
        new_config["url"] = config.url.rstrip("/") if config.url else ""
    else:
        new_config["url"] = existing.get("url", "")

    # Update API key if provided (encrypt it)
    if config.api_key is not None:
        new_config["api_key_encrypted"] = crypto_service.encrypt(config.api_key) if config.api_key else ""
    else:
        new_config["api_key_encrypted"] = existing.get("api_key_encrypted", "")

    # Handle username/password for services with basic auth
    if service in SERVICES_WITH_BASIC_AUTH:
        if config.username is not None:
            new_config["username"] = config.username
        else:
            new_config["username"] = existing.get("username", "")

        if config.password is not None:
            new_config["password_encrypted"] = crypto_service.encrypt(config.password) if config.password else ""
        else:
            new_config["password_encrypted"] = existing.get("password_encrypted", "")

    await _save_service_config(db, service, new_config)

    # Return updated config
    api_key = crypto_service.decrypt(new_config["api_key_encrypted"]) if new_config["api_key_encrypted"] else None
    password = None
    username = None

    if service in SERVICES_WITH_BASIC_AUTH:
        password = crypto_service.decrypt(new_config.get("password_encrypted", "")) if new_config.get("password_encrypted") else None
        username = new_config.get("username", "")

    # For services without URL requirement, only check API key
    if service in SERVICES_WITHOUT_URL:
        is_configured = bool(new_config["api_key_encrypted"])
    elif service in SERVICES_WITH_BASIC_AUTH:
        # For services with basic auth, either username/password or api_key is valid
        has_basic_auth = bool(username and new_config.get("password_encrypted"))
        has_api_key = bool(new_config["api_key_encrypted"])
        is_configured = bool(new_config["url"] and (has_basic_auth or has_api_key))
    else:
        is_configured = bool(new_config["url"] and new_config["api_key_encrypted"])

    return ServiceConfigResponse(
        url=new_config["url"],
        api_key_masked=_mask_api_key(api_key),
        username=username if service in SERVICES_WITH_BASIC_AUTH else None,
        password_masked=_mask_api_key(password) if service in SERVICES_WITH_BASIC_AUTH else None,
        is_configured=is_configured,
    )


@router.post("/services/{service}/test", response_model=ServiceTestResult)
async def test_service_connection(service: str, db: AsyncSession = Depends(get_db)):
    """Test connection to a specific service."""
    if service not in SERVICES:
        raise HTTPException(status_code=404, detail=f"Unknown service: {service}")

    config = await _get_service_config(db, service)
    if not config:
        return ServiceTestResult(
            service=service,
            success=False,
            message="Service not configured",
        )

    url = config.get("url", "")
    api_key_encrypted = config.get("api_key_encrypted", "")
    api_key = crypto_service.decrypt(api_key_encrypted) if api_key_encrypted else ""

    # Get username/password for services with basic auth
    username = ""
    password = ""
    if service in SERVICES_WITH_BASIC_AUTH:
        username = config.get("username", "")
        password_encrypted = config.get("password_encrypted", "")
        password = crypto_service.decrypt(password_encrypted) if password_encrypted else ""

    # For services without URL requirement, only check API key
    if service in SERVICES_WITHOUT_URL:
        if not api_key:
            return ServiceTestResult(
                service=service,
                success=False,
                message="Missing API key",
            )
    elif service in SERVICES_WITH_BASIC_AUTH:
        # For services with basic auth, either username/password or api_key is valid
        has_basic_auth = bool(username and password)
        has_api_key = bool(api_key)
        if not url or not (has_basic_auth or has_api_key):
            return ServiceTestResult(
                service=service,
                success=False,
                message="Missing URL or credentials (username/password or API key)",
            )
    elif not url or not api_key:
        return ServiceTestResult(
            service=service,
            success=False,
            message="Missing URL or API key",
        )

    try:
        integration = get_integration(service, url, api_key, username=username, password=password)
        success, message, response_time = await integration.test_connection()
        await integration.close()

        return ServiceTestResult(
            service=service,
            success=success,
            message=message,
            response_time_ms=response_time,
        )

    except Exception as e:
        logger.error(f"Error testing {service} connection: {e}")
        return ServiceTestResult(
            service=service,
            success=False,
            message=str(e),
        )


@router.post("/services/test-all", response_model=AllServicesStatus)
async def test_all_services(db: AsyncSession = Depends(get_db)):
    """Test connections to all configured services."""
    results = {}

    for service in SERVICES:
        result = await test_service_connection(service, db)
        results[service] = result

    return AllServicesStatus(**results)


# User Preferences
@router.get("/preferences", response_model=PreferencesResponse)
async def get_preferences(db: AsyncSession = Depends(get_db)):
    """Get user preferences."""
    from sqlalchemy import select

    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == "default")
    )
    prefs = result.scalar_one_or_none()

    if not prefs:
        # Return defaults
        return PreferencesResponse(
            theme=Theme.SYSTEM,
            language="fr",
            timezone="Europe/Paris",
        )

    return PreferencesResponse(
        theme=prefs.theme,
        language=prefs.language,
        timezone=prefs.timezone,
    )


@router.put("/preferences", response_model=PreferencesResponse)
async def update_preferences(
    update: PreferencesUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update user preferences."""
    from sqlalchemy import select

    # Validate language
    if update.language and update.language not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported language. Supported: {', '.join(SUPPORTED_LANGUAGES)}",
        )

    # Validate timezone
    if update.timezone:
        import pytz

        try:
            pytz.timezone(update.timezone)
        except pytz.exceptions.UnknownTimeZoneError:
            raise HTTPException(status_code=400, detail=f"Invalid timezone: {update.timezone}")

    result = await db.execute(
        select(UserPreference).where(UserPreference.user_id == "default")
    )
    prefs = result.scalar_one_or_none()

    if not prefs:
        prefs = UserPreference(user_id="default")
        db.add(prefs)

    if update.theme is not None:
        prefs.theme = update.theme
    if update.language is not None:
        prefs.language = update.language
    if update.timezone is not None:
        prefs.timezone = update.timezone

    await db.commit()
    await db.refresh(prefs)

    return PreferencesResponse(
        theme=prefs.theme,
        language=prefs.language,
        timezone=prefs.timezone,
    )


# Retention Settings
@router.get("/retention", response_model=RetentionSettings)
async def get_retention_settings(db: AsyncSession = Depends(get_db)):
    """Get data retention settings."""
    history_setting = await db.get(Setting, "retention.history_days")
    logs_setting = await db.get(Setting, "retention.logs_days")

    return RetentionSettings(
        history_days=history_setting.value if history_setting else 90,
        logs_days=logs_setting.value if logs_setting else 30,
    )


@router.put("/retention", response_model=RetentionSettings)
async def update_retention_settings(
    settings: RetentionSettings,
    db: AsyncSession = Depends(get_db),
):
    """Update data retention settings."""
    # History days
    history_setting = await db.get(Setting, "retention.history_days")
    if history_setting:
        history_setting.value = settings.history_days
    else:
        db.add(Setting(key="retention.history_days", value=settings.history_days))

    # Logs days
    logs_setting = await db.get(Setting, "retention.logs_days")
    if logs_setting:
        logs_setting.value = settings.logs_days
    else:
        db.add(Setting(key="retention.logs_days", value=settings.logs_days))

    await db.commit()

    return settings
