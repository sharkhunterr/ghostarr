# Implementation Plan: Ghostarr Newsletter Generator

**Branch**: `001-ghostarr-newsletter` | **Date**: 2026-01-20 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-ghostarr-newsletter/spec.md`

## Summary

Ghostarr is a self-hosted newsletter generator for media server administrators. It aggregates content from multiple media services (Tautulli, TMDB, ROMM, Komga, Audiobookshelf, Tunarr) and publishes automated newsletters to Ghost CMS. The application is packaged as a single Docker image with embedded SQLite database, featuring a React frontend with i18n support (5 languages), dark/light themes, and real-time SSE progress tracking.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript 5.x strict (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy, APScheduler, Jinja2 (backend) | React 18, Vite, shadcn/ui, TanStack Query, Zustand, i18next (frontend)
**Storage**: SQLite with SQLAlchemy ORM + Alembic migrations
**Testing**: pytest (backend), Vitest + React Testing Library (frontend)
**Target Platform**: Docker container (linux/amd64, linux/arm64), modern browsers (ES2020+)
**Project Type**: Web application (monolithic Docker with backend + frontend)
**Performance Goals**: <1s SSE latency, <3s page load, support 100 history entries without degradation
**Constraints**: Single Docker image, single volume mount (/config), environment-derived encryption key
**Scale/Scope**: Single-user deployment, 7 external service integrations, 5 pages, 40 functional requirements

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Service-Oriented Architecture | PASS | FastAPI backend with versioned `/api/v1/` endpoints, each integration encapsulated in separate connector |
| II. Type Safety First | PASS | TypeScript strict mode, Pydantic v2 for backend validation, Zod for frontend forms |
| III. Progressive Enhancement | PASS | Mobile-first design, theme/language auto-detection, SSE graceful degradation |
| IV. Observability & Feedback | PASS | Real-time SSE progress, toast notifications, correlation IDs in logs |
| V. Configuration over Code | PASS | Settings in SQLite, templates as files, env vars for infrastructure only |
| VI. Extensibility by Design | PASS | BaseIntegration interface, JSON translation files, template volume mount |

**Technology Stack Alignment**:
- Backend: Python 3.11+, FastAPI, SQLite, SQLAlchemy, APScheduler, Pydantic v2, httpx, Jinja2
- Frontend: React 18+, TypeScript, Vite, shadcn/ui, Tailwind CSS, TanStack Query, Zustand, React Router v6, React Hook Form, Zod, i18next, Lucide React
- Infrastructure: Docker (single image), compatible with Traefik/Caddy

**All constitution gates PASSED.**

## Project Structure

### Documentation (this feature)

```text
specs/001-ghostarr-newsletter/
├── plan.md              # This file
├── research.md          # Phase 0 output - technology decisions
├── data-model.md        # Phase 1 output - entity schemas
├── quickstart.md        # Phase 1 output - developer setup guide
├── contracts/           # Phase 1 output - OpenAPI specs
│   └── openapi.yaml
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
ghostarr/
├── docker-compose.yml           # Development compose
├── Dockerfile                   # Single multi-stage image
├── .env.example                 # Environment template
│
├── backend/
│   ├── pyproject.toml           # Python dependencies + tooling
│   ├── alembic/                 # Database migrations
│   │   ├── env.py
│   │   └── versions/
│   └── app/
│       ├── __init__.py
│       ├── main.py              # FastAPI entrypoint
│       ├── config.py            # Settings from env
│       ├── database.py          # SQLite connection
│       │
│       ├── api/v1/
│       │   ├── __init__.py
│       │   ├── router.py        # Main router aggregation
│       │   ├── newsletters.py   # Generation endpoints
│       │   ├── templates.py     # Template CRUD
│       │   ├── schedules.py     # Schedule CRUD
│       │   ├── history.py       # History queries
│       │   ├── settings.py      # Settings & preferences
│       │   ├── logs.py          # Log viewer
│       │   ├── integrations.py  # Service data fetchers
│       │   └── progress.py      # SSE endpoint
│       │
│       ├── models/
│       │   ├── __init__.py
│       │   ├── template.py
│       │   ├── schedule.py
│       │   ├── history.py
│       │   ├── log.py
│       │   ├── setting.py
│       │   └── user_preference.py
│       │
│       ├── schemas/
│       │   ├── __init__.py
│       │   ├── template.py
│       │   ├── schedule.py
│       │   ├── history.py
│       │   ├── generation.py
│       │   ├── settings.py
│       │   └── common.py
│       │
│       ├── services/
│       │   ├── __init__.py
│       │   ├── newsletter_generator.py
│       │   ├── scheduler_service.py
│       │   ├── progress_tracker.py
│       │   ├── template_service.py
│       │   └── crypto_service.py
│       │
│       ├── integrations/
│       │   ├── __init__.py
│       │   ├── base.py          # BaseIntegration interface
│       │   ├── tautulli.py
│       │   ├── tmdb.py
│       │   ├── romm.py
│       │   ├── audiobookshelf.py
│       │   ├── komga.py
│       │   ├── tunarr.py
│       │   └── ghost.py
│       │
│       └── core/
│           ├── __init__.py
│           ├── exceptions.py
│           ├── logging.py
│           └── events.py
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── index.html
│   │
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── vite-env.d.ts
│       │
│       ├── api/
│       │   ├── client.ts        # Axios/fetch config
│       │   ├── newsletters.ts
│       │   ├── templates.ts
│       │   ├── schedules.ts
│       │   ├── history.ts
│       │   ├── settings.ts
│       │   └── integrations.ts
│       │
│       ├── components/
│       │   ├── ui/              # shadcn/ui components
│       │   ├── layout/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── Header.tsx
│       │   │   └── Layout.tsx
│       │   ├── dashboard/
│       │   │   ├── ManualGeneration.tsx
│       │   │   ├── AutomaticGeneration.tsx
│       │   │   ├── ScheduleForm.tsx
│       │   │   └── ScheduleList.tsx
│       │   ├── templates/
│       │   │   ├── TemplateCard.tsx
│       │   │   ├── TemplateGrid.tsx
│       │   │   └── TemplatePreview.tsx
│       │   ├── history/
│       │   │   ├── HistoryTable.tsx
│       │   │   ├── HistoryFilters.tsx
│       │   │   └── ProgressModal.tsx
│       │   ├── settings/
│       │   │   ├── ServiceCard.tsx
│       │   │   ├── GeneralSettings.tsx
│       │   │   └── LogViewer.tsx
│       │   └── common/
│       │       ├── ProgressCard.tsx
│       │       ├── NotificationCenter.tsx
│       │       ├── ThemeToggle.tsx
│       │       └── LanguageSelector.tsx
│       │
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── History.tsx
│       │   ├── Templates.tsx
│       │   ├── Settings.tsx
│       │   └── Help.tsx
│       │
│       ├── hooks/
│       │   ├── useProgress.ts
│       │   ├── useSSE.ts
│       │   ├── useTheme.ts
│       │   └── useNotifications.ts
│       │
│       ├── stores/
│       │   ├── progressStore.ts
│       │   ├── notificationStore.ts
│       │   └── preferencesStore.ts
│       │
│       ├── i18n/
│       │   ├── index.ts
│       │   └── locales/
│       │       ├── fr/
│       │       ├── en/
│       │       ├── de/
│       │       ├── it/
│       │       └── es/
│       │
│       ├── lib/
│       │   ├── utils.ts
│       │   └── cn.ts
│       │
│       └── types/
│           ├── index.ts
│           ├── api.ts
│           └── entities.ts
│
├── templates/
│   └── default/
│       └── newsletter.html      # Default Jinja2 template
│
└── tests/
    ├── backend/
    │   ├── conftest.py
    │   ├── unit/
    │   ├── integration/
    │   └── contract/
    └── frontend/
        ├── setup.ts
        └── components/
```

**Structure Decision**: Web application with backend and frontend in single Docker image. Backend serves the frontend as static files in production. SQLite database and templates stored in `/config` volume.

## Complexity Tracking

No constitution violations requiring justification. All gates passed.

## Phase Outputs

- **Phase 0**: [research.md](./research.md) - Technology decisions and best practices
- **Phase 1**: [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md)
- **Phase 2**: [tasks.md](./tasks.md) (generated by `/speckit.tasks`)
