# Data Model: Ghostarr Newsletter Generator

**Feature**: 001-ghostarr-newsletter
**Date**: 2026-01-20
**Database**: SQLite with SQLAlchemy ORM

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│    Template     │       │    Schedule     │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────│ template_id(FK) │
│ name            │       │ id (PK)         │
│ description     │       │ name            │
│ tags            │       │ is_active       │
│ file_path       │       │ cron_expression │
│ preset_config   │       │ timezone        │
│ is_default      │       │ generation_conf │
│ created_at      │       │ last_run_at     │
│ updated_at      │       │ last_run_status │
└─────────────────┘       │ next_run_at     │
        │                 │ created_at      │
        │                 │ updated_at      │
        │                 └─────────────────┘
        │                         │
        ▼                         ▼
┌─────────────────────────────────────────┐
│                History                   │
├─────────────────────────────────────────┤
│ id (PK)                                 │
│ type (manual/automatic)                 │
│ schedule_id (FK, nullable)              │
│ template_id (FK)                        │
│ status (pending/running/success/...)    │
│ ghost_post_id                           │
│ ghost_post_url                          │
│ generation_config                       │
│ progress_log                            │
│ error_message                           │
│ items_count                             │
│ duration_seconds                        │
│ started_at                              │
│ completed_at                            │
│ created_at                              │
└─────────────────────────────────────────┘

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│      Log        │  │     Setting     │  │ UserPreference  │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ id (PK)         │  │ key (PK)        │  │ id (PK)         │
│ level           │  │ value           │  │ user_id         │
│ source          │  │ updated_at      │  │ theme           │
│ service         │  └─────────────────┘  │ language        │
│ message         │                       │ timezone        │
│ context         │                       │ created_at      │
│ correlation_id  │                       │ updated_at      │
│ created_at      │                       └─────────────────┘
└─────────────────┘
```

## Entity Definitions

### Template

Represents an HTML newsletter template with metadata and preset configuration.

```python
# backend/app/models/template.py
from sqlalchemy import Column, String, Text, Boolean, DateTime, JSON
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.orm import relationship
from uuid import uuid4
from datetime import datetime

class Template(Base):
    __tablename__ = "templates"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    tags = Column(SQLiteJSON, default=list)  # ["weekly", "media", "stats"]
    file_path = Column(String(512), nullable=False)  # Relative to /config/templates/
    preset_config = Column(SQLiteJSON, default=dict)  # Default generation params
    is_default = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    schedules = relationship("Schedule", back_populates="template")
    history_entries = relationship("History", back_populates="template")
```

**Validation Rules**:
- `name`: 1-255 characters, unique, alphanumeric with spaces/hyphens
- `file_path`: Must exist on filesystem, must be .html or .zip
- `tags`: Array of strings, max 10 tags, each max 50 characters
- `preset_config`: Valid JSON matching GenerationConfig schema
- Only one template can have `is_default=True`

### Schedule

Represents an automated generation configuration with CRON scheduling.

```python
# backend/app/models/schedule.py
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from uuid import uuid4
from datetime import datetime
import enum

class RunStatus(enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name = Column(String(255), nullable=False, index=True)
    is_active = Column(Boolean, default=True, index=True)
    cron_expression = Column(String(100), nullable=False)  # "0 8 * * 1"
    timezone = Column(String(50), default="Europe/Paris")
    template_id = Column(String(36), ForeignKey("templates.id"), nullable=False)
    generation_config = Column(JSON, nullable=False)  # Full config snapshot
    last_run_at = Column(DateTime, nullable=True)
    last_run_status = Column(Enum(RunStatus), nullable=True)
    next_run_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    template = relationship("Template", back_populates="schedules")
    history_entries = relationship("History", back_populates="schedule")
```

**Validation Rules**:
- `name`: 1-255 characters
- `cron_expression`: Valid 5-field CRON (validated via croniter)
- `timezone`: Valid IANA timezone (validated via pytz)
- `template_id`: Must reference existing template
- `generation_config`: Valid JSON matching GenerationConfig schema

**State Transitions**:
- `is_active`: true ↔ false (toggle via API)
- `last_run_status`: null → pending → success/failed/skipped

### History

Represents a single generation attempt with full audit trail.

```python
# backend/app/models/history.py
from sqlalchemy import Column, String, Text, Integer, Float, DateTime, ForeignKey, Enum, JSON
from sqlalchemy.orm import relationship
from uuid import uuid4
from datetime import datetime
import enum

class GenerationType(enum.Enum):
    MANUAL = "manual"
    AUTOMATIC = "automatic"

class GenerationStatus(enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"

class History(Base):
    __tablename__ = "history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    type = Column(Enum(GenerationType), nullable=False, index=True)
    schedule_id = Column(String(36), ForeignKey("schedules.id"), nullable=True)
    template_id = Column(String(36), ForeignKey("templates.id"), nullable=False)
    status = Column(Enum(GenerationStatus), default=GenerationStatus.PENDING, index=True)
    ghost_post_id = Column(String(100), nullable=True)
    ghost_post_url = Column(String(512), nullable=True)
    generation_config = Column(JSON, nullable=False)
    progress_log = Column(JSON, default=list)  # Array of step logs
    error_message = Column(Text, nullable=True)
    items_count = Column(Integer, default=0)
    duration_seconds = Column(Float, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    # Relationships
    schedule = relationship("Schedule", back_populates="history_entries")
    template = relationship("Template", back_populates="history_entries")
```

**State Transitions**:
```
PENDING → RUNNING → SUCCESS
                 → FAILED
                 → CANCELLED
```

**Progress Log Format**:
```json
[
  {
    "step": "fetch_tautulli",
    "status": "success",
    "started_at": "2026-01-20T08:00:01Z",
    "completed_at": "2026-01-20T08:00:03Z",
    "duration_ms": 2000,
    "items_count": 15,
    "message": "Fetched 15 items from Tautulli"
  },
  {
    "step": "enrich_tmdb",
    "status": "running",
    "started_at": "2026-01-20T08:00:03Z",
    "message": "Enriching 15 items with TMDB metadata..."
  }
]
```

### Log

Represents a system log entry for diagnostics.

```python
# backend/app/models/log.py
from sqlalchemy import Column, String, Text, DateTime, Enum, JSON
from uuid import uuid4
from datetime import datetime
import enum

class LogLevel(enum.Enum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"

class LogSource(enum.Enum):
    BACKEND = "backend"
    FRONTEND = "frontend"
    INTEGRATION = "integration"

class Log(Base):
    __tablename__ = "logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    level = Column(Enum(LogLevel), nullable=False, index=True)
    source = Column(Enum(LogSource), nullable=False, index=True)
    service = Column(String(50), nullable=True, index=True)  # "tautulli", "ghost", etc.
    message = Column(Text, nullable=False)
    context = Column(JSON, nullable=True)  # Additional structured data
    correlation_id = Column(String(36), nullable=True, index=True)  # Request tracing
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
```

**Retention**: Auto-purge logs older than configured retention period (default 30 days).

### Setting

Key-value store for application configuration.

```python
# backend/app/models/setting.py
from sqlalchemy import Column, String, DateTime, JSON
from datetime import datetime

class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**Reserved Keys**:
- `services.tautulli`: `{url, api_key_encrypted}`
- `services.tmdb`: `{api_key_encrypted}`
- `services.ghost`: `{url, admin_api_key_encrypted}`
- `services.romm`: `{url, api_key_encrypted}`
- `services.komga`: `{url, api_key_encrypted}`
- `services.audiobookshelf`: `{url, api_key_encrypted}`
- `services.tunarr`: `{url, api_key_encrypted}`
- `retention.history_days`: `90`
- `retention.logs_days`: `30`
- `notifications.admin_email`: `null | "email@example.com"`

### UserPreference

User-specific settings for UI customization.

```python
# backend/app/models/user_preference.py
from sqlalchemy import Column, String, DateTime, Enum
from uuid import uuid4
from datetime import datetime
import enum

class Theme(enum.Enum):
    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"

class UserPreference(Base):
    __tablename__ = "user_preferences"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(100), default="default", unique=True, index=True)
    theme = Column(Enum(Theme), default=Theme.SYSTEM)
    language = Column(String(5), default="fr")  # ISO 639-1
    timezone = Column(String(50), default="Europe/Paris")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

**Supported Languages**: `fr`, `en`, `de`, `it`, `es`

## Pydantic Schemas

### GenerationConfig (Shared)

```python
# backend/app/schemas/generation.py
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class PublicationMode(str, Enum):
    DRAFT = "draft"
    PUBLISH = "publish"
    EMAIL = "email"
    EMAIL_PUBLISH = "email+publish"

class MaintenanceType(str, Enum):
    SCHEDULED = "scheduled"
    OUTAGE = "outage"
    NETWORK = "network"
    UPDATE = "update"
    IMPROVEMENT = "improvement"
    SECURITY = "security"

class ContentSourceConfig(BaseModel):
    enabled: bool = False
    days: int = Field(default=7, ge=1, le=90)
    max_items: int = Field(default=-1, ge=-1)  # -1 = unlimited

class TautulliConfig(ContentSourceConfig):
    featured_item: bool = False

class TunarrConfig(ContentSourceConfig):
    days: int = Field(default=7, ge=1, le=7)
    channels: list[str] = []
    display_format: str = "grid"  # "grid" | "list"

class StatisticsConfig(BaseModel):
    enabled: bool = False
    days: int = Field(default=7, ge=1, le=90)
    include_comparison: bool = False

class MaintenanceConfig(BaseModel):
    enabled: bool = False
    description: str = ""
    type: MaintenanceType = MaintenanceType.SCHEDULED
    duration_value: int = 1
    duration_unit: str = "hours"  # "hours" | "days" | "weeks"
    start_datetime: Optional[datetime] = None

class GenerationConfig(BaseModel):
    template_id: str
    title: str = "Newsletter {{date.week}}"
    publication_mode: PublicationMode = PublicationMode.DRAFT
    ghost_newsletter_id: Optional[str] = None

    # Content sources
    tautulli: TautulliConfig = TautulliConfig()
    romm: ContentSourceConfig = ContentSourceConfig()
    komga: ContentSourceConfig = ContentSourceConfig()
    audiobookshelf: ContentSourceConfig = ContentSourceConfig()
    tunarr: TunarrConfig = TunarrConfig()

    # Statistics
    statistics: StatisticsConfig = StatisticsConfig()

    # Maintenance
    maintenance: MaintenanceConfig = MaintenanceConfig()

    # Global options
    max_total_items: int = Field(default=-1, ge=-1)
    skip_if_empty: bool = False
```

## TypeScript Types

```typescript
// frontend/src/types/entities.ts

export type UUID = string;

export interface Template {
  id: UUID;
  name: string;
  description: string | null;
  tags: string[];
  file_path: string;
  preset_config: GenerationConfig;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Schedule {
  id: UUID;
  name: string;
  is_active: boolean;
  cron_expression: string;
  timezone: string;
  template_id: UUID;
  template?: Template;
  generation_config: GenerationConfig;
  last_run_at: string | null;
  last_run_status: "pending" | "success" | "failed" | "skipped" | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface History {
  id: UUID;
  type: "manual" | "automatic";
  schedule_id: UUID | null;
  schedule?: Schedule;
  template_id: UUID;
  template?: Template;
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  ghost_post_id: string | null;
  ghost_post_url: string | null;
  generation_config: GenerationConfig;
  progress_log: ProgressStep[];
  error_message: string | null;
  items_count: number;
  duration_seconds: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface ProgressStep {
  step: string;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
  items_count?: number;
  message: string;
  error?: string;
}

export interface Log {
  id: UUID;
  level: "debug" | "info" | "warning" | "error";
  source: "backend" | "frontend" | "integration";
  service: string | null;
  message: string;
  context: Record<string, unknown> | null;
  correlation_id: string | null;
  created_at: string;
}

export interface UserPreference {
  id: UUID;
  user_id: string;
  theme: "light" | "dark" | "system";
  language: "fr" | "en" | "de" | "it" | "es";
  timezone: string;
}

export type PublicationMode = "draft" | "publish" | "email" | "email+publish";
export type MaintenanceType = "scheduled" | "outage" | "network" | "update" | "improvement" | "security";

export interface GenerationConfig {
  template_id: UUID;
  title: string;
  publication_mode: PublicationMode;
  ghost_newsletter_id: string | null;
  tautulli: ContentSourceConfig & { featured_item: boolean };
  romm: ContentSourceConfig;
  komga: ContentSourceConfig;
  audiobookshelf: ContentSourceConfig;
  tunarr: ContentSourceConfig & { channels: string[]; display_format: "grid" | "list" };
  statistics: { enabled: boolean; days: number; include_comparison: boolean };
  maintenance: {
    enabled: boolean;
    description: string;
    type: MaintenanceType;
    duration_value: number;
    duration_unit: "hours" | "days" | "weeks";
    start_datetime: string | null;
  };
  max_total_items: number;
  skip_if_empty: boolean;
}

export interface ContentSourceConfig {
  enabled: boolean;
  days: number;
  max_items: number;
}
```

## Migrations

### Initial Migration (001)

```python
# backend/alembic/versions/001_initial.py
"""Initial schema

Revision ID: 001
Create Date: 2026-01-20
"""

def upgrade():
    # Templates
    op.create_table('templates', ...)
    op.create_index('ix_templates_name', 'templates', ['name'])
    op.create_index('ix_templates_is_default', 'templates', ['is_default'])

    # Schedules
    op.create_table('schedules', ...)
    op.create_index('ix_schedules_is_active', 'schedules', ['is_active'])
    op.create_index('ix_schedules_next_run_at', 'schedules', ['next_run_at'])

    # History
    op.create_table('history', ...)
    op.create_index('ix_history_type', 'history', ['type'])
    op.create_index('ix_history_status', 'history', ['status'])
    op.create_index('ix_history_created_at', 'history', ['created_at'])

    # Logs
    op.create_table('logs', ...)
    op.create_index('ix_logs_level', 'logs', ['level'])
    op.create_index('ix_logs_source', 'logs', ['source'])
    op.create_index('ix_logs_service', 'logs', ['service'])
    op.create_index('ix_logs_correlation_id', 'logs', ['correlation_id'])
    op.create_index('ix_logs_created_at', 'logs', ['created_at'])

    # Settings
    op.create_table('settings', ...)

    # User Preferences
    op.create_table('user_preferences', ...)
    op.create_index('ix_user_preferences_user_id', 'user_preferences', ['user_id'])

def downgrade():
    op.drop_table('user_preferences')
    op.drop_table('settings')
    op.drop_table('logs')
    op.drop_table('history')
    op.drop_table('schedules')
    op.drop_table('templates')
```

## Indexes Summary

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| templates | ix_templates_name | name | Unique lookup |
| templates | ix_templates_is_default | is_default | Find default template |
| schedules | ix_schedules_is_active | is_active | Filter active schedules |
| schedules | ix_schedules_next_run_at | next_run_at | Scheduler queries |
| history | ix_history_type | type | Filter by manual/auto |
| history | ix_history_status | status | Filter by status |
| history | ix_history_created_at | created_at | Pagination/sorting |
| logs | ix_logs_level | level | Filter by severity |
| logs | ix_logs_created_at | created_at | Pagination, retention cleanup |
| logs | ix_logs_correlation_id | correlation_id | Request tracing |
