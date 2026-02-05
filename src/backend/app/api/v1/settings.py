"""Settings API endpoints."""

from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings as app_settings
from app.core.logging import get_logger
from app.database import get_db
from app.integrations import get_integration
from app.models.label import Label
from app.models.schedule import Schedule
from app.models.setting import Setting
from app.models.template import Template
from app.models.user_preference import SUPPORTED_LANGUAGES, Theme, UserPreference
from app.schemas.settings import (
    AllServicesStatus,
    BackupOptions,
    DeletionLoggingSettings,
    PreferencesResponse,
    PreferencesUpdate,
    RestoreResult,
    RetentionSettings,
    ServiceConfig,
    ServiceConfigResponse,
    ServiceTestResult,
)
from app.services.crypto_service import crypto_service

logger = get_logger(__name__)
router = APIRouter()

SERVICES = ["tautulli", "tmdb", "ghost", "romm", "komga", "audiobookshelf", "tunarr"]

# Services that don't require URL (have default API endpoint)
SERVICES_WITHOUT_URL = ["tmdb"]

# Services that support username/password authentication
SERVICES_WITH_BASIC_AUTH = ["romm"]

# Services that can work without authentication (API key is optional)
SERVICES_WITHOUT_AUTH = ["tunarr"]


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
            elif service in SERVICES_WITHOUT_AUTH:
                # For services that can work without auth, only URL is required
                is_configured = bool(config.get("url"))
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


# Export Services (with decrypted credentials)
# NOTE: This route must be defined BEFORE /services/{service} to avoid path conflict
@router.get("/services/export")
async def export_services(db: AsyncSession = Depends(get_db)):
    """Export all service configurations with decrypted credentials.

    WARNING: This endpoint returns sensitive data (API keys, passwords).
    Only use for configuration export/backup purposes.
    """
    result = {}

    for service in SERVICES:
        config = await _get_service_config(db, service)
        if config:
            # Decrypt API key
            api_key_encrypted = config.get("api_key_encrypted", "")
            api_key = crypto_service.decrypt(api_key_encrypted) if api_key_encrypted else None

            service_export = {
                "url": config.get("url", ""),
                "api_key": api_key,
            }

            # Handle username/password for services with basic auth
            if service in SERVICES_WITH_BASIC_AUTH:
                password_encrypted = config.get("password_encrypted", "")
                password = crypto_service.decrypt(password_encrypted) if password_encrypted else None
                service_export["username"] = config.get("username", "")
                service_export["password"] = password

            result[service] = service_export

    return result


# Import Services
# NOTE: This route must be defined BEFORE /services/{service} to avoid path conflict
@router.put("/services/import")
async def import_services(
    services: dict,
    db: AsyncSession = Depends(get_db),
):
    """Import service configurations.

    Accepts a dictionary of service configurations with decrypted credentials.
    """
    imported = []

    for service, config in services.items():
        if service not in SERVICES:
            continue

        new_config = {}

        # URL
        if config.get("url"):
            new_config["url"] = config["url"].rstrip("/")

        # API key (encrypt it)
        if config.get("api_key"):
            new_config["api_key_encrypted"] = crypto_service.encrypt(config["api_key"])

        # Username/password for services with basic auth
        if service in SERVICES_WITH_BASIC_AUTH:
            if config.get("username"):
                new_config["username"] = config["username"]
            if config.get("password"):
                new_config["password_encrypted"] = crypto_service.encrypt(config["password"])

        if new_config:
            await _save_service_config(db, service, new_config)
            imported.append(service)

    return {"imported": imported, "count": len(imported)}


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
    elif service in SERVICES_WITHOUT_AUTH:
        # For services that can work without auth, only URL is required
        is_configured = bool(config.get("url"))
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
    elif service in SERVICES_WITHOUT_AUTH:
        # For services that can work without auth, only URL is required
        is_configured = bool(new_config["url"])
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
    elif service in SERVICES_WITHOUT_AUTH:
        # For services that can work without auth, only URL is required
        if not url:
            return ServiceTestResult(
                service=service,
                success=False,
                message="Missing URL",
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


# Deletion Logging Settings
@router.get("/deletion-logging", response_model=DeletionLoggingSettings)
async def get_deletion_logging_settings(db: AsyncSession = Depends(get_db)):
    """Get deletion logging settings."""
    setting = await db.get(Setting, "deletion.log_deletions")

    return DeletionLoggingSettings(
        log_deletions=setting.value if setting else True,
    )


@router.put("/deletion-logging", response_model=DeletionLoggingSettings)
async def update_deletion_logging_settings(
    settings: DeletionLoggingSettings,
    db: AsyncSession = Depends(get_db),
):
    """Update deletion logging settings."""
    setting = await db.get(Setting, "deletion.log_deletions")
    if setting:
        setting.value = settings.log_deletions
    else:
        db.add(Setting(key="deletion.log_deletions", value=settings.log_deletions))

    await db.commit()

    return settings


# Full Backup/Restore
@router.post("/backup")
async def create_backup(
    options: BackupOptions,
    db: AsyncSession = Depends(get_db),
):
    """Create a full backup of Ghostarr configuration.

    WARNING: This endpoint returns sensitive data (API keys, passwords).
    Only use for backup purposes.
    """
    backup_data = {
        "version": "3.0",
        "exportedAt": datetime.utcnow().isoformat(),
        "type": "full_backup",
    }

    # Services
    if options.include_services:
        services_export = {}
        for service in SERVICES:
            config = await _get_service_config(db, service)
            if config:
                api_key_encrypted = config.get("api_key_encrypted", "")
                api_key = crypto_service.decrypt(api_key_encrypted) if api_key_encrypted else None

                service_export = {
                    "url": config.get("url", ""),
                    "api_key": api_key,
                }

                if service in SERVICES_WITH_BASIC_AUTH:
                    password_encrypted = config.get("password_encrypted", "")
                    password = crypto_service.decrypt(password_encrypted) if password_encrypted else None
                    service_export["username"] = config.get("username", "")
                    service_export["password"] = password

                services_export[service] = service_export
        backup_data["services"] = services_export

    # Preferences
    if options.include_preferences:
        result = await db.execute(
            select(UserPreference).where(UserPreference.user_id == "default")
        )
        prefs = result.scalar_one_or_none()
        if prefs:
            backup_data["preferences"] = {
                "theme": prefs.theme.value,
                "language": prefs.language,
                "timezone": prefs.timezone,
            }

    # Retention
    if options.include_retention:
        history_setting = await db.get(Setting, "retention.history_days")
        logs_setting = await db.get(Setting, "retention.logs_days")
        backup_data["retention"] = {
            "history_days": history_setting.value if history_setting else 90,
            "logs_days": logs_setting.value if logs_setting else 30,
        }

    # Deletion logging
    if options.include_deletion_logging:
        setting = await db.get(Setting, "deletion.log_deletions")
        backup_data["deletionLogging"] = {
            "log_deletions": setting.value if setting else True,
        }

    # Labels
    if options.include_labels:
        result = await db.execute(select(Label))
        labels = result.scalars().all()
        backup_data["labels"] = [
            {"name": label.name, "color": label.color}
            for label in labels
        ]

    # Templates (with HTML content)
    if options.include_templates:
        result = await db.execute(
            select(Template).options(selectinload(Template.labels))
        )
        templates = result.scalars().all()
        templates_export = []

        templates_dir = Path(app_settings.templates_dir)
        for template in templates:
            # Read HTML content
            file_path = templates_dir / template.file_path
            html_content = ""
            if file_path.exists():
                html_content = file_path.read_text(encoding="utf-8")

            templates_export.append({
                "name": template.name,
                "description": template.description,
                "html": html_content,
                "labels": [label.name for label in template.labels],
                "preset_config": template.preset_config or {},
                "is_default": template.is_default,
            })
        backup_data["templates"] = templates_export

    # Schedules
    if options.include_schedules:
        result = await db.execute(select(Schedule))
        schedules = result.scalars().all()

        # Build template ID to name mapping
        template_names = {}
        if options.include_templates:
            result = await db.execute(select(Template))
            for t in result.scalars().all():
                template_names[t.id] = t.name

        schedules_export = []
        for schedule in schedules:
            schedule_data = {
                "name": schedule.name,
                "schedule_type": schedule.schedule_type.value,
                "cron_expression": schedule.cron_expression,
                "timezone": schedule.timezone,
                "is_active": schedule.is_active,
                "generation_config": schedule.generation_config,
                "deletion_config": schedule.deletion_config,
            }
            # Store template name instead of ID for portability
            if schedule.template_id and schedule.template_id in template_names:
                schedule_data["template_name"] = template_names[schedule.template_id]
            schedules_export.append(schedule_data)
        backup_data["schedules"] = schedules_export

    return backup_data


@router.post("/restore", response_model=RestoreResult)
async def restore_backup(
    backup_data: dict,
    db: AsyncSession = Depends(get_db),
):
    """Restore configuration from a backup.

    This will restore selected components from the backup file.
    Existing items with the same name will be skipped.
    """
    import uuid

    result = RestoreResult()

    try:
        # Check backup version
        version = backup_data.get("version", "1.0")
        if not version.startswith(("2.", "3.")):
            logger.warning(f"Restoring from older backup version: {version}")

        # Restore services
        if "services" in backup_data:
            services = backup_data["services"]
            for service, config in services.items():
                if service not in SERVICES:
                    continue

                new_config = {}
                if config.get("url"):
                    new_config["url"] = config["url"].rstrip("/")
                if config.get("api_key"):
                    new_config["api_key_encrypted"] = crypto_service.encrypt(config["api_key"])
                if service in SERVICES_WITH_BASIC_AUTH:
                    if config.get("username"):
                        new_config["username"] = config["username"]
                    if config.get("password"):
                        new_config["password_encrypted"] = crypto_service.encrypt(config["password"])

                if new_config:
                    await _save_service_config(db, service, new_config)
                    result.services_restored += 1

        # Restore preferences
        if "preferences" in backup_data:
            prefs_data = backup_data["preferences"]
            pref_result = await db.execute(
                select(UserPreference).where(UserPreference.user_id == "default")
            )
            prefs = pref_result.scalar_one_or_none()

            if not prefs:
                prefs = UserPreference(user_id="default")
                db.add(prefs)

            if "theme" in prefs_data:
                prefs.theme = Theme(prefs_data["theme"])
            if "language" in prefs_data:
                prefs.language = prefs_data["language"]
            if "timezone" in prefs_data:
                prefs.timezone = prefs_data["timezone"]

            result.preferences_restored = True

        # Restore retention settings
        if "retention" in backup_data:
            retention_data = backup_data["retention"]

            if "history_days" in retention_data:
                history_setting = await db.get(Setting, "retention.history_days")
                if history_setting:
                    history_setting.value = retention_data["history_days"]
                else:
                    db.add(Setting(key="retention.history_days", value=retention_data["history_days"]))

            if "logs_days" in retention_data:
                logs_setting = await db.get(Setting, "retention.logs_days")
                if logs_setting:
                    logs_setting.value = retention_data["logs_days"]
                else:
                    db.add(Setting(key="retention.logs_days", value=retention_data["logs_days"]))

            result.retention_restored = True

        # Restore deletion logging settings
        if "deletionLogging" in backup_data:
            deletion_data = backup_data["deletionLogging"]

            if "log_deletions" in deletion_data:
                setting = await db.get(Setting, "deletion.log_deletions")
                if setting:
                    setting.value = deletion_data["log_deletions"]
                else:
                    db.add(Setting(key="deletion.log_deletions", value=deletion_data["log_deletions"]))

            result.deletion_logging_restored = True

        # Restore labels
        if "labels" in backup_data:
            for label_data in backup_data["labels"]:
                # Check if label exists
                existing = await db.execute(
                    select(Label).where(Label.name == label_data["name"])
                )
                if existing.scalar_one_or_none():
                    result.labels_skipped += 1
                    continue

                label = Label(
                    name=label_data["name"],
                    color=label_data.get("color", "#6366f1"),
                )
                db.add(label)
                result.labels_restored += 1

        await db.commit()

        # Restore templates (after labels are committed)
        template_name_to_id = {}
        if "templates" in backup_data:
            from app.services.template_service import template_service

            templates_dir = Path(app_settings.templates_dir)
            templates_dir.mkdir(parents=True, exist_ok=True)

            for template_data in backup_data["templates"]:
                # Check if template exists
                existing = await db.execute(
                    select(Template).where(Template.name == template_data["name"])
                )
                if existing.scalar_one_or_none():
                    result.templates_skipped += 1
                    continue

                # Save HTML file
                unique_filename = f"{uuid.uuid4().hex}.html"
                file_path = templates_dir / unique_filename
                file_path.write_text(template_data.get("html", ""), encoding="utf-8")

                # Validate template
                is_valid, error = template_service.validate_template(unique_filename)
                if not is_valid:
                    file_path.unlink()
                    result.errors.append(f"Template '{template_data['name']}': {error}")
                    continue

                # Create template
                template = Template(
                    name=template_data["name"],
                    description=template_data.get("description"),
                    tags=[],
                    file_path=unique_filename,
                    is_default=template_data.get("is_default", False),
                    preset_config=template_data.get("preset_config", {}),
                )
                db.add(template)

                # Associate labels
                for label_name in template_data.get("labels", []):
                    label_result = await db.execute(
                        select(Label).where(Label.name == label_name)
                    )
                    label = label_result.scalar_one_or_none()
                    if label:
                        template.labels.append(label)

                await db.flush()
                template_name_to_id[template_data["name"]] = template.id
                result.templates_restored += 1

        await db.commit()

        # Restore schedules (after templates are committed)
        if "schedules" in backup_data:
            for schedule_data in backup_data["schedules"]:
                # Check if schedule exists
                existing = await db.execute(
                    select(Schedule).where(Schedule.name == schedule_data["name"])
                )
                if existing.scalar_one_or_none():
                    result.schedules_skipped += 1
                    continue

                # Find template ID by name
                template_id = None
                template_name = schedule_data.get("template_name")
                if template_name:
                    # Check in newly created templates
                    if template_name in template_name_to_id:
                        template_id = template_name_to_id[template_name]
                    else:
                        # Check existing templates
                        template_result = await db.execute(
                            select(Template).where(Template.name == template_name)
                        )
                        template = template_result.scalar_one_or_none()
                        if template:
                            template_id = template.id

                # Skip generation schedules without template
                from app.models.schedule import ScheduleType
                schedule_type = ScheduleType(schedule_data.get("schedule_type", "generation"))
                if schedule_type == ScheduleType.GENERATION and not template_id:
                    result.errors.append(f"Schedule '{schedule_data['name']}': Template '{template_name}' not found")
                    result.schedules_skipped += 1
                    continue

                schedule = Schedule(
                    name=schedule_data["name"],
                    schedule_type=schedule_type,
                    cron_expression=schedule_data["cron_expression"],
                    timezone=schedule_data.get("timezone", "Europe/Paris"),
                    is_active=schedule_data.get("is_active", True),
                    template_id=template_id,
                    generation_config=schedule_data.get("generation_config"),
                    deletion_config=schedule_data.get("deletion_config"),
                )
                db.add(schedule)
                result.schedules_restored += 1

        await db.commit()

    except Exception as e:
        logger.error(f"Error restoring backup: {e}")
        result.errors.append(str(e))

    return result
