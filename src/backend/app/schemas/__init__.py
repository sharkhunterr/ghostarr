"""Pydantic schemas package."""

from app.schemas.common import ErrorResponse, PaginatedResponse, PaginationParams
from app.schemas.generation import (
    ContentSourceConfig,
    GenerationConfig,
    MaintenanceConfig,
    MaintenanceType,
    PublicationMode,
    StatisticsConfig,
    TautulliConfig,
    TunarrConfig,
)
from app.schemas.history import (
    HistoryCreate,
    HistoryFilter,
    HistoryResponse,
    ProgressStep,
    ProgressStepStatus,
)
from app.schemas.label import (
    LabelCreate,
    LabelResponse,
    LabelUpdate,
    TemplateLabelAssignment,
)
from app.schemas.schedule import (
    ScheduleCreate,
    ScheduleResponse,
    ScheduleUpdate,
)
from app.schemas.settings import (
    PreferencesResponse,
    PreferencesUpdate,
    ServiceConfig,
    ServiceTestResult,
)
from app.schemas.template import (
    TemplateCreate,
    TemplateResponse,
    TemplateUpdate,
)

__all__ = [
    # Common
    "ErrorResponse",
    "PaginatedResponse",
    "PaginationParams",
    # Generation
    "GenerationConfig",
    "ContentSourceConfig",
    "TautulliConfig",
    "TunarrConfig",
    "StatisticsConfig",
    "MaintenanceConfig",
    "PublicationMode",
    "MaintenanceType",
    # History
    "HistoryCreate",
    "HistoryResponse",
    "HistoryFilter",
    "ProgressStep",
    "ProgressStepStatus",
    # Schedule
    "ScheduleCreate",
    "ScheduleUpdate",
    "ScheduleResponse",
    # Settings
    "ServiceConfig",
    "ServiceTestResult",
    "PreferencesUpdate",
    "PreferencesResponse",
    # Template
    "TemplateCreate",
    "TemplateUpdate",
    "TemplateResponse",
    # Label
    "LabelCreate",
    "LabelUpdate",
    "LabelResponse",
    "TemplateLabelAssignment",
]
