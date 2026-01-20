# Tasks: Ghostarr Newsletter Generator

**Input**: Design documents from `/specs/001-ghostarr-newsletter/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/openapi.yaml

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US5)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project structure per plan.md (`backend/`, `frontend/`, `templates/`, `tests/`)
- [x] T002 [P] Initialize Python backend with FastAPI in `backend/pyproject.toml` (FastAPI, SQLAlchemy, APScheduler, Pydantic v2, httpx, Jinja2, sse-starlette, cryptography, croniter, pytz)
- [x] T003 [P] Initialize React frontend with Vite in `frontend/package.json` (React 18, TypeScript, TanStack Query, Zustand, React Router v6, React Hook Form, Zod, i18next, Lucide React)
- [x] T004 [P] Configure Tailwind CSS and shadcn/ui in `frontend/tailwind.config.ts` and `frontend/components.json`
- [x] T005 [P] Create Dockerfile with multi-stage build (frontend-build → backend → final image)
- [x] T006 [P] Create docker-compose.yml for development environment
- [x] T007 [P] Create .env.example with all environment variables documented
- [x] T008 [P] Configure backend linting with ruff in `backend/pyproject.toml`
- [x] T009 [P] Configure frontend linting with ESLint/Prettier in `frontend/`
- [x] T010 [P] Configure pytest in `backend/pyproject.toml` and Vitest in `frontend/vite.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database & Configuration

- [x] T011 Create SQLite database connection in `backend/app/database.py` with async session management
- [x] T012 Initialize Alembic for migrations in `backend/alembic/` with `env.py`
- [x] T013 [P] Create environment configuration loader in `backend/app/config.py` (APP_SECRET_KEY, APP_ENV, APP_TIMEZONE, CORS_ORIGINS)
- [x] T014 [P] Implement crypto service for AES-256 encryption in `backend/app/services/crypto_service.py` using PBKDF2 key derivation

### Core Models (No Relationships)

- [x] T015 [P] Create Template model in `backend/app/models/template.py`
- [x] T016 [P] Create Schedule model in `backend/app/models/schedule.py`
- [x] T017 [P] Create History model in `backend/app/models/history.py`
- [x] T018 [P] Create Log model in `backend/app/models/log.py`
- [x] T019 [P] Create Setting model in `backend/app/models/setting.py`
- [x] T020 [P] Create UserPreference model in `backend/app/models/user_preference.py`
- [x] T021 Create models __init__.py with Base export in `backend/app/models/__init__.py`
- [ ] T022 Create initial Alembic migration (001_initial.py) with all tables and indexes

### Core Schemas

- [x] T023 [P] Create common schemas (Pagination, ErrorResponse) in `backend/app/schemas/common.py`
- [x] T024 [P] Create GenerationConfig and related schemas in `backend/app/schemas/generation.py`
- [x] T025 [P] Create Template schemas (TemplateCreate, TemplateUpdate, TemplateResponse) in `backend/app/schemas/template.py`
- [x] T026 [P] Create Schedule schemas in `backend/app/schemas/schedule.py`
- [x] T027 [P] Create History schemas in `backend/app/schemas/history.py`
- [x] T028 [P] Create Settings schemas (service configs) in `backend/app/schemas/settings.py`

### Core Infrastructure

- [x] T029 Create custom exceptions in `backend/app/core/exceptions.py` (IntegrationError, TemplateError, GenerationError, ValidationError)
- [x] T030 [P] Create logging infrastructure with correlation ID support in `backend/app/core/logging.py`
- [x] T031 [P] Create SSE event manager in `backend/app/core/events.py` for progress broadcasting
- [x] T032 Create FastAPI main application with CORS, exception handlers in `backend/app/main.py`
- [x] T033 Create API v1 router aggregation in `backend/app/api/v1/router.py`

### Frontend Foundation

- [x] T034 Create Axios/fetch API client with interceptors in `frontend/src/api/client.ts`
- [x] T035 [P] Create TypeScript entity types in `frontend/src/types/entities.ts` (Template, Schedule, History, etc.)
- [x] T036 [P] Create TypeScript API types in `frontend/src/types/api.ts` (request/response shapes)
- [x] T037 Setup i18next with French locale in `frontend/src/i18n/index.ts` and `frontend/src/i18n/locales/fr/`
- [x] T038 [P] Create utility functions (cn, formatDate) in `frontend/src/lib/utils.ts`
- [x] T039 [P] Create Zustand notification store in `frontend/src/stores/notificationStore.ts`
- [x] T040 [P] Create Zustand preferences store in `frontend/src/stores/preferencesStore.ts`
- [x] T041 Create main App.tsx with React Router, QueryClient, ThemeProvider setup
- [ ] T042 Create base Layout component with sidebar placeholder in `frontend/src/components/layout/Layout.tsx`

### Install shadcn/ui Components

- [ ] T043 [P] Install shadcn/ui base components: Button, Input, Label, Card, Badge, Separator, Skeleton
- [ ] T044 [P] Install shadcn/ui form components: Select, Checkbox, Switch, Textarea, Slider
- [ ] T045 [P] Install shadcn/ui overlay components: Dialog, Sheet, Dropdown Menu, Toast, Tooltip
- [ ] T046 [P] Install shadcn/ui data components: Table, Tabs, Accordion, Progress

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 5 - External Services Configuration (Priority: P1) 🎯 MVP

**Goal**: Configure and test connections to external services (Tautulli, TMDB, Ghost, etc.)

**Independent Test**: Enter service credentials, click "Test connection", verify connectivity status

### Backend Integration Layer

- [x] T047 Create BaseIntegration abstract class in `backend/app/integrations/base.py` (test_connection, fetch_data, _request with retry)
- [x] T048 [P] [US5] Implement Tautulli integration in `backend/app/integrations/tautulli.py` (test_connection, fetch_recent_media, fetch_statistics)
- [x] T049 [P] [US5] Implement TMDB integration in `backend/app/integrations/tmdb.py` (test_connection, enrich_media)
- [x] T050 [P] [US5] Implement Ghost integration in `backend/app/integrations/ghost.py` (test_connection, get_newsletters, create_post, update_post, delete_post)
- [x] T051 [P] [US5] Implement ROMM integration in `backend/app/integrations/romm.py` (test_connection, fetch_recent_games)
- [x] T052 [P] [US5] Implement Komga integration in `backend/app/integrations/komga.py` (test_connection, fetch_recent_books)
- [x] T053 [P] [US5] Implement Audiobookshelf integration in `backend/app/integrations/audiobookshelf.py` (test_connection, fetch_recent_audiobooks)
- [x] T054 [P] [US5] Implement Tunarr integration in `backend/app/integrations/tunarr.py` (test_connection, get_channels, fetch_programming)
- [x] T055 Create integrations __init__.py with factory function in `backend/app/integrations/__init__.py`

### Backend Settings API

- [x] T056 [US5] Implement settings CRUD endpoints in `backend/app/api/v1/settings.py` (GET/PUT /settings/services/{service}, POST /settings/services/{service}/test)
- [x] T057 [US5] Implement integrations data endpoints in `backend/app/api/v1/integrations.py` (GET /integrations/ghost/newsletters, GET /integrations/tunarr/channels)

### Frontend Settings Page

- [x] T058 [US5] Create Settings page structure in `frontend/src/pages/Settings.tsx` with tabs (General, Services, Logs)
- [x] T059 [US5] Create ServiceCard component in `frontend/src/components/settings/ServiceCard.tsx` (URL input, API key input with mask, test button, status badge)
- [x] T060 [US5] Create settings API hooks in `frontend/src/api/settings.ts` (useServices, useUpdateService, useTestService)
- [x] T061 [US5] Wire ServiceCard to API with connection testing feedback and encrypted storage

**Checkpoint**: User Story 5 complete - can configure and test all external services

---

## Phase 4: User Story 1 - Manual Newsletter Generation (Priority: P1) 🎯 MVP

**Goal**: Generate and publish a newsletter manually from the Dashboard

**Independent Test**: Select template, configure sources, generate, verify post appears in Ghost

### Backend Generation Core

- [x] T062 [US1] Create template service in `backend/app/services/template_service.py` (render template with Jinja2 sandbox, validate template)
- [x] T063 [US1] Create progress tracker service in `backend/app/services/progress_tracker.py` (broadcast SSE events, step management)
- [x] T064 [US1] Create newsletter generator service in `backend/app/services/newsletter_generator.py` (orchestrate fetch → enrich → render → publish pipeline)
- [x] T065 [US1] Implement generation endpoints in `backend/app/api/v1/newsletters.py` (POST /newsletters/generate, POST /newsletters/preview, POST /newsletters/{id}/cancel)
- [x] T066 [US1] Implement SSE progress endpoint in `backend/app/api/v1/progress.py` (GET /progress/stream)

### Backend Templates API

- [x] T067 [US1] Implement templates CRUD endpoints in `backend/app/api/v1/templates.py` (GET/POST/PUT/DELETE /templates, GET /templates/{id}/preview)
- [x] T068 [US1] Create default newsletter template in `templates/default/newsletter.html` with Jinja2 sections for all content types

### Frontend Dashboard

- [x] T069 [US1] Create Dashboard page structure in `frontend/src/pages/Dashboard.tsx` with Manual/Automatic tabs
- [x] T070 [US1] Create ManualGeneration component in `frontend/src/components/dashboard/ManualGeneration.tsx` (template select, title with variables, publication mode, content sources config)
- [x] T071 [US1] Create content source configuration forms (Tautulli toggle, days, max items; ROMM/Komga/Audiobookshelf similar; Tunarr with channel multi-select)
- [x] T072 [US1] Create maintenance notice section in ManualGeneration (type select, description, duration, start datetime)
- [x] T073 [US1] Create statistics configuration section in ManualGeneration (enable, days, include comparison toggle)
- [x] T074 [US1] Create newsletter preview modal in `frontend/src/components/dashboard/PreviewModal.tsx`
- [x] T075 [US1] Create newsletters API hooks in `frontend/src/api/newsletters.ts` (useGenerateNewsletter, usePreviewNewsletter, useCancelGeneration)
- [x] T076 [US1] Create templates API hooks in `frontend/src/api/templates.ts` (useTemplates, useTemplate)

### Frontend Progress Tracking

- [x] T077 [US1] Create useSSE hook in `frontend/src/hooks/useSSE.ts` for EventSource connection
- [x] T078 [US1] Create Zustand progress store in `frontend/src/stores/progressStore.ts` (current generation, steps, status)
- [x] T079 [US1] Create ProgressCard component in `frontend/src/components/dashboard/ProgressCard.tsx` (persistent bottom-right card with step list, progress bar, cancel button)
- [x] T080 [US1] Create useProgress hook in `frontend/src/hooks/useProgress.ts` to connect SSE with store

**Checkpoint**: User Story 1 complete - can manually generate newsletters end-to-end

---

## Phase 5: User Story 7 - Real-time Generation Progress (Priority: P2)

**Goal**: See real-time progress during newsletter generation with ability to cancel

**Independent Test**: Trigger generation, observe progress card update step-by-step in real-time

### Backend SSE Refinements

- [x] T081 [US7] Enhance progress tracker with detailed step events in `backend/app/services/progress_tracker.py` (step_start, step_complete, step_error, generation_complete, generation_cancelled)
- [x] T082 [US7] Add cancellation support in newsletter generator with graceful cleanup
- [x] T083 [US7] Add heartbeat mechanism to SSE endpoint for connection keep-alive

### Frontend Progress Enhancements

- [x] T084 [US7] Enhance ProgressCard with expandable step details (each step: name, status icon, duration, item count)
- [x] T085 [US7] Add elapsed time counter and estimated completion
- [x] T086 [US7] Ensure ProgressCard persists across page navigation via Layout component
- [x] T087 [US7] Add generation complete notification with link to history entry

**Checkpoint**: User Story 7 complete - real-time progress with cancellation works

---

## Phase 6: User Story 2 - Automatic Scheduled Generation (Priority: P2)

**Goal**: Configure automatic weekly newsletters with CRON scheduling

**Independent Test**: Create schedule, wait for execution time, verify newsletter generated

### Backend Scheduler

- [x] T088 [US2] Create scheduler service in `backend/app/services/scheduler_service.py` (APScheduler with SQLAlchemy job store, timezone-aware)
- [x] T089 [US2] Implement schedule CRUD endpoints in `backend/app/api/v1/schedules.py` (GET/POST/PUT/DELETE /schedules, POST /schedules/{id}/execute, PATCH /schedules/{id}/toggle)
- [x] T090 [US2] Add CRON expression validation and human-readable translation helper
- [x] T091 [US2] Integrate scheduler startup/shutdown in FastAPI lifespan events
- [x] T092 [US2] Create schedule execution job that calls newsletter generator with schedule config

### Frontend Schedule Management

- [x] T093 [US2] Create AutomaticGeneration component in `frontend/src/components/dashboard/AutomaticGeneration.tsx` (schedule list, create button)
- [x] T094 [US2] Create ScheduleForm component in `frontend/src/components/dashboard/ScheduleForm.tsx` (name, template select, CRON or simple mode, timezone, full generation config)
- [x] T095 [US2] Create ScheduleList component in `frontend/src/components/dashboard/ScheduleList.tsx` (cards with name, next run, status, toggle, execute now, edit, delete)
- [x] T096 [US2] Create CRON input with simple mode toggle (daily/weekly/monthly + time picker) and preview of next 5 runs
- [x] T097 [US2] Create schedules API hooks in `frontend/src/api/schedules.ts` (useSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule, useToggleSchedule, useExecuteSchedule)

**Checkpoint**: User Story 2 complete - automatic scheduled generation works

---

## Phase 7: User Story 3 - Template Management (Priority: P2)

**Goal**: Upload, customize, and manage newsletter templates

**Independent Test**: Upload template, configure presets, verify presets auto-fill on selection

### Backend Template Features

- [x] T098 [US3] Enhance template upload endpoint to handle HTML files and ZIP archives in `backend/app/api/v1/templates.py`
- [x] T099 [US3] Add template validation (required sections, valid Jinja2 syntax)
- [x] T100 [US3] Add template preview with mock data endpoint
- [x] T101 [US3] Add template deletion protection when used by active schedules

### Frontend Templates Page

- [x] T102 [US3] Create Templates page in `frontend/src/pages/Templates.tsx` with grid layout
- [x] T103 [US3] Create TemplateCard component in `frontend/src/components/templates/TemplateCard.tsx` (thumbnail, name, tags, actions: preview, edit, delete)
- [x] T104 [US3] Create TemplateGrid component in `frontend/src/components/templates/TemplateGrid.tsx` with upload button
- [x] T105 [US3] Create TemplatePreview component in `frontend/src/components/templates/TemplatePreview.tsx` (fullscreen modal, viewport toggles: mobile/tablet/desktop)
- [x] T106 [US3] Create template upload dialog with drag-and-drop support
- [x] T107 [US3] Create template edit dialog for metadata and preset configuration
- [x] T108 [US3] Wire preset config to auto-fill generation form when template selected

**Checkpoint**: User Story 3 complete - template upload and management works

---

## Phase 8: User Story 4 - Generation History and Monitoring (Priority: P2)

**Goal**: Track all generations with ability to view details and regenerate

**Independent Test**: Generate newsletter, view in history, check details, regenerate

### Backend History API

- [x] T109 [US4] Implement history CRUD endpoints in `backend/app/api/v1/history.py` (GET /history with pagination/filters, GET /history/{id}, DELETE /history/{id}, POST /history/{id}/regenerate, DELETE /history/{id}/ghost-post)
- [x] T110 [US4] Add history export endpoint (GET /history/export with format query param: json/csv)
- [x] T111 [US4] Add auto-purge job for history retention policy

### Frontend History Page

- [x] T112 [US4] Create History page in `frontend/src/pages/History.tsx`
- [x] T113 [US4] Create HistoryTable component in `frontend/src/components/history/HistoryTable.tsx` (date, type badge, template, status badge, duration, items, actions)
- [x] T114 [US4] Create HistoryFilters component in `frontend/src/components/history/HistoryFilters.tsx` (period date range, type select, status select, template select)
- [x] T115 [US4] Create ProgressModal component in `frontend/src/components/history/ProgressModal.tsx` (step timeline with status, duration, data received, errors)
- [x] T116 [US4] Create history API hooks in `frontend/src/api/history.ts` (useHistory, useHistoryDetail, useRegenerateHistory, useDeleteHistory, useDeleteGhostPost, useExportHistory)
- [x] T117 [US4] Add regenerate confirmation dialog and delete Ghost post confirmation

**Checkpoint**: User Story 4 complete - history tracking and management works

---

## Phase 9: User Story 6 - User Preferences and Theming (Priority: P3)

**Goal**: Customize interface with theme, language, and timezone

**Independent Test**: Change theme to dark, verify immediate UI update without reload

### Backend Preferences API

- [x] T118 [US6] Implement preferences endpoints in `backend/app/api/v1/settings.py` (GET/PUT /settings/preferences)

### Frontend Theme System

- [x] T119 [US6] Create useTheme hook in `frontend/src/hooks/useTheme.ts` with CSS variable switching
- [x] T120 [US6] Create ThemeToggle component in `frontend/src/components/common/ThemeToggle.tsx` (light/dark/system)
- [x] T121 [US6] Define CSS variables for light and dark themes in `frontend/src/index.css`
- [x] T122 [US6] Add theme transition animation on switch

### Frontend i18n Complete

- [x] T123 [P] [US6] Create English translations in `frontend/src/i18n/locales/en/`
- [x] T124 [P] [US6] Create German translations in `frontend/src/i18n/locales/de/`
- [x] T125 [P] [US6] Create Italian translations in `frontend/src/i18n/locales/it/`
- [x] T126 [P] [US6] Create Spanish translations in `frontend/src/i18n/locales/es/`
- [x] T127 [US6] Create LanguageSelector component in `frontend/src/components/common/LanguageSelector.tsx` with flag icons
- [x] T128 [US6] Wire language switch to i18next with instant update (no reload)

### Frontend Layout

- [x] T129 [US6] Create Sidebar component in `frontend/src/components/layout/Sidebar.tsx` (navigation: Dashboard, History, Templates, Settings, Help)
- [x] T130 [US6] Create Header component in `frontend/src/components/layout/Header.tsx` (logo, theme toggle, language selector, notification bell)
- [x] T131 [US6] Create NotificationCenter component in `frontend/src/components/common/NotificationCenter.tsx` (dropdown with recent notifications, unread count badge)
- [x] T132 [US6] Add timezone display with server time on hover in datetime components
- [x] T133 [US6] Create GeneralSettings component in `frontend/src/components/settings/GeneralSettings.tsx` (timezone select, retention periods)

**Checkpoint**: User Story 6 complete - preferences and theming works

---

## Phase 10: User Story 8 - System Logs and Diagnostics (Priority: P3)

**Goal**: View, filter, and export application logs

**Independent Test**: Perform action, verify log entry appears, filter by level

### Backend Logs API

- [x] T134 [US8] Implement logs endpoints in `backend/app/api/v1/logs.py` (GET /logs with pagination/filters, GET /logs/export, DELETE /logs/purge)
- [x] T135 [US8] Add auto-purge job for logs retention policy
- [x] T136 [US8] Integrate logging throughout application with correlation ID injection

### Frontend Logs Section

- [x] T137 [US8] Create LogViewer component in `frontend/src/components/settings/LogViewer.tsx` (table with timestamp, level badge, source, service, message)
- [x] T138 [US8] Add log filters (level multi-select, source select, service search, date range)
- [x] T139 [US8] Add log export button (JSON/CSV format selection)
- [x] T140 [US8] Add purge old logs button with confirmation dialog

**Checkpoint**: User Story 8 complete - logs viewing and management works

---

## Phase 11: User Story 9 - Help and Documentation (Priority: P3)

**Goal**: Provide in-app guidance and documentation

**Independent Test**: Search for "CRON", verify relevant help appears

### Backend Help Content

- [x] T141 [US9] Create help content JSON/markdown files organized by category
- [x] T142 [US9] Implement help search endpoint in `backend/app/api/v1/help.py` (GET /help/search, GET /help/categories, GET /help/articles/{id})

### Frontend Help Page

- [x] T143 [US9] Create Help page in `frontend/src/pages/Help.tsx` with search and category browsing
- [x] T144 [US9] Create help article viewer with markdown rendering
- [x] T145 [US9] Add contextual help tooltips throughout the application (hover icons next to complex fields)
- [x] T146 [US9] Add CRON syntax reference with clickable examples in schedule form

**Checkpoint**: User Story 9 complete - help system works

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Final improvements affecting multiple stories

### Configuration Export/Import

- [x] T147 [P] Implement configuration export endpoint in `backend/app/api/v1/settings.py` (GET /settings/export)
- [x] T148 [P] Implement configuration import endpoint in `backend/app/api/v1/settings.py` (POST /settings/import)
- [x] T149 Add export/import UI in Settings General tab

### Error Handling & Edge Cases

- [x] T150 [P] Add retry logic with exponential backoff in all integrations
- [x] T151 [P] Handle generation queue (prevent overlapping generations)
- [x] T152 [P] Add empty content handling ("No recent activity" display)
- [x] T153 [P] Add graceful degradation when optional services unavailable

### Performance & Polish

- [x] T154 [P] Add loading skeletons to all list views
- [x] T155 [P] Add optimistic updates for toggle operations (schedule active, theme)
- [x] T156 [P] Add keyboard shortcuts (Ctrl+K for search, Escape to close modals)
- [x] T157 Run quickstart.md validation - verify all setup steps work

### Mobile Responsiveness

- [x] T158 [P] Ensure Sidebar collapses to hamburger menu on mobile
- [x] T159 [P] Ensure all forms are usable on mobile viewports
- [x] T160 [P] Test template preview viewport toggles

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 5 (Phase 3)**: P1 - Must be done first (configures services)
- **User Story 1 (Phase 4)**: P1 - Depends on US5 (needs configured services)
- **User Story 7 (Phase 5)**: P2 - Enhances US1 (progress tracking)
- **User Story 2 (Phase 6)**: P2 - Depends on US1 (reuses generation pipeline)
- **User Story 3 (Phase 7)**: P2 - Can run parallel with US2 after US1
- **User Story 4 (Phase 8)**: P2 - Can run parallel with US2/US3 after US1
- **User Story 6 (Phase 9)**: P3 - Can start after Foundation
- **User Story 8 (Phase 10)**: P3 - Can start after Foundation
- **User Story 9 (Phase 11)**: P3 - Can start after Foundation
- **Polish (Phase 12)**: Depends on all user stories being complete

### User Story Dependencies

```
Foundation (Phase 2)
       │
       ├──► US5 (P1: Services Config)
       │         │
       │         ▼
       │    US1 (P1: Manual Generation) ──► US7 (P2: Progress)
       │         │
       │         ├──► US2 (P2: Scheduling)
       │         ├──► US3 (P2: Templates)
       │         └──► US4 (P2: History)
       │
       ├──► US6 (P3: Preferences) [parallel]
       ├──► US8 (P3: Logs) [parallel]
       └──► US9 (P3: Help) [parallel]
```

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational model/schema tasks marked [P] can run in parallel
- All integration implementations (T048-T054) can run in parallel
- All i18n translations (T123-T126) can run in parallel
- US6, US8, US9 can run in parallel after Foundation
- US2, US3, US4 can run in parallel after US1

---

## Implementation Strategy

### MVP First (US5 + US1)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 5 (Services Configuration)
4. Complete Phase 4: User Story 1 (Manual Generation)
5. **STOP and VALIDATE**: Test end-to-end newsletter generation
6. Deploy as MVP

### Incremental Delivery

1. MVP (Phases 1-4) → Manual newsletter generation works
2. Add US7 (Progress) → Better UX during generation
3. Add US2 (Scheduling) → Automation capability
4. Add US3 (Templates) + US4 (History) → Full content management
5. Add US6 + US8 + US9 → Polish and help
6. Phase 12 → Final polish

---

## Notes

- All file paths reference the structure in plan.md
- [P] tasks can run in parallel within their phase
- [US#] label maps task to specific user story for traceability
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Default template (T068) is critical for MVP - users need immediate value
