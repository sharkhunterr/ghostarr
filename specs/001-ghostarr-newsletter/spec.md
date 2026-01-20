# Feature Specification: Ghostarr Newsletter Generator

**Feature Branch**: `001-ghostarr-newsletter`
**Created**: 2026-01-20
**Status**: Draft
**Input**: Application web Ghostarr - Generateur automatique de newsletters pour serveur multimedia integrant Tautulli, TMDB, Ghost, ROMM, Komga, Audiobookshelf et Tunarr avec dashboard, planifications, templates, historique et systeme de progression temps reel.

## Clarifications

### Session 2026-01-20

- Q: Comment les credentials des services externes doivent-elles etre protegees ? → A: Chiffrement au repos (AES-256) avec cle derivee de l'environnement
- Q: Modele de deploiement ? → A: Image Docker unique (ghostarr:latest) contenant backend, frontend et base de donnees
- Q: Syntaxe de templating pour les newsletters ? → A: Jinja2 ({{ variable }}, {% for %}, filtres)
- Q: Base de donnees embarquee ? → A: SQLite (fichier unique, zero config)
- Q: Template par defaut inclus ? → A: Oui, template par defaut pre-integre pour utilisation immediate

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manual Newsletter Generation (Priority: P1)

A media server administrator wants to manually generate and publish a newsletter to inform subscribers about recent content additions, viewing statistics, and upcoming maintenance.

**Why this priority**: Manual generation is the core MVP feature that validates the entire newsletter generation pipeline. Without this, no other features can deliver value.

**Independent Test**: Can be fully tested by configuring at least Ghost integration, selecting content sources, and generating a newsletter that appears in Ghost as a draft/published post.

**Acceptance Scenarios**:

1. **Given** the administrator is on the Dashboard page with Ghost configured, **When** they select a template, configure content sources (films/series with 7 days period), and click "Generate now", **Then** the system fetches recent content from Tautulli/TMDB, renders the template, and creates a post in Ghost with progress visible in real-time.

2. **Given** the administrator wants to preview before publishing, **When** they click "Preview", **Then** a modal displays the fully rendered HTML newsletter with the actual content that would be generated.

3. **Given** the administrator has configured maintenance mode, **When** they enable the maintenance section and fill in details (type, duration, start date), **Then** the generated newsletter includes a formatted maintenance notice block.

4. **Given** no new content exists for the selected period, **When** the "Skip if no news" option is enabled and generation is triggered, **Then** the system notifies the user that no newsletter was generated due to lack of new content.

---

### User Story 2 - Automatic Scheduled Newsletter Generation (Priority: P2)

A media server administrator wants to configure automatic weekly newsletters so subscribers receive updates every Monday morning without manual intervention.

**Why this priority**: Automation is the primary value proposition of Ghostarr - reducing manual work. Depends on P1 working first.

**Independent Test**: Can be tested by creating a schedule with a near-future CRON expression and verifying execution occurs with correct content.

**Acceptance Scenarios**:

1. **Given** the administrator is on the Dashboard's Automatic Generation section, **When** they create a new schedule with name "Weekly Recap", select a template, configure content sources, set frequency to "Weekly - Monday at 08:00", and save, **Then** the schedule appears in the list with next execution time displayed.

2. **Given** a schedule is configured and active, **When** the scheduled time arrives, **Then** the system automatically generates and publishes the newsletter according to the configured settings, and records the execution in history.

3. **Given** a schedule execution fails (e.g., Ghost unreachable), **When** the administrator views the schedule list, **Then** they see the failed status with error details, and can retry the execution manually.

4. **Given** the administrator wants to test a schedule before its scheduled time, **When** they click "Execute now" on a schedule, **Then** the newsletter is generated immediately using the schedule's configuration.

---

### User Story 3 - Template Management (Priority: P2)

A media server administrator wants to customize the look and feel of newsletters by uploading custom HTML templates and configuring default generation settings for each template.

**Why this priority**: Templates enable customization and branding. Equal priority with scheduling as both extend core functionality.

**Independent Test**: Can be tested by uploading a template, configuring preset values, and verifying these presets auto-fill when selecting the template for generation.

**Acceptance Scenarios**:

1. **Given** the administrator is on the Templates page, **When** they upload an HTML file with valid template structure, **Then** the template is saved and appears in the grid with a generated preview thumbnail.

2. **Given** a template exists, **When** the administrator edits its metadata and sets preset values (e.g., default days period = 7, include statistics = true), **Then** these values are saved and auto-fill the generation form when this template is selected.

3. **Given** a template is used by an active schedule, **When** the administrator tries to delete it, **Then** the system prevents deletion and displays which schedules use this template.

4. **Given** the administrator wants to preview a template, **When** they click "Preview" on a template card, **Then** a fullscreen modal shows the template rendered with sample/mock data, with mobile/tablet/desktop viewport toggles.

---

### User Story 4 - Generation History and Monitoring (Priority: P2)

A media server administrator wants to track all newsletter generations to monitor success/failure rates, regenerate previous newsletters, and manage published content.

**Why this priority**: Essential for operational visibility and troubleshooting. Required for production use.

**Independent Test**: Can be tested by generating a newsletter and verifying it appears in history with correct details, then viewing its progression log.

**Acceptance Scenarios**:

1. **Given** a newsletter has been generated (manually or automatically), **When** the administrator views the History page, **Then** they see an entry with date/time, type (manual/automatic), template used, status, duration, and item count.

2. **Given** a history entry exists, **When** the administrator clicks "View details", **Then** a modal shows a timeline of all generation steps with their status, duration, received data, and any error messages.

3. **Given** a successful history entry exists, **When** the administrator clicks "Regenerate with same parameters", **Then** a new generation is started using the exact same configuration, and a new history entry is created.

4. **Given** multiple history entries exist, **When** the administrator applies filters (period, type, status, template), **Then** the list updates to show only matching entries, and export respects the applied filters.

---

### User Story 5 - External Services Configuration (Priority: P1)

A media server administrator needs to configure connections to external services (Tautulli, TMDB, Ghost, etc.) before using the newsletter generator.

**Why this priority**: P1 because without configured services, no other features work. This is the entry point for new users.

**Independent Test**: Can be tested by entering service credentials and clicking "Test connection" to verify connectivity.

**Acceptance Scenarios**:

1. **Given** the administrator is on the Settings page Services section, **When** they enter URL and API key for Tautulli and click "Test connection", **Then** the system validates the connection and displays success with a green "Connected" badge, or failure with an error message.

2. **Given** Ghost is configured, **When** the administrator views the Dashboard generation form, **Then** the Ghost newsletter/tier dropdown is populated with options fetched from the Ghost API.

3. **Given** a service becomes unavailable after initial configuration, **When** the administrator clicks "Test all services", **Then** they see which services are connected and which have errors.

4. **Given** Tunarr is configured, **When** the administrator configures the TV Program source in generation form, **Then** the channel multi-select dropdown is populated with channels fetched from Tunarr.

---

### User Story 6 - User Preferences and Theming (Priority: P3)

A media server administrator wants to customize their interface experience with theme preferences, language selection, and timezone settings.

**Why this priority**: P3 because this is quality-of-life improvement, not core functionality.

**Independent Test**: Can be tested by changing theme/language and verifying immediate UI update without page reload.

**Acceptance Scenarios**:

1. **Given** the administrator is using the application, **When** they toggle the theme from "System" to "Dark" in the header, **Then** the interface immediately transitions to dark mode with a smooth animation.

2. **Given** the administrator prefers French, **When** they select "Francais" in the language dropdown, **Then** all interface labels update instantly without page reload.

3. **Given** the administrator is in a different timezone than the server, **When** they configure their preferred timezone, **Then** all displayed times (schedule next run, history dates) show in their local timezone with server time available on hover.

---

### User Story 7 - Real-time Generation Progress (Priority: P2)

A media server administrator wants to see real-time progress when generating a newsletter to understand what's happening and have the ability to cancel if needed.

**Why this priority**: P2 because it significantly improves user experience during the core generation workflow.

**Independent Test**: Can be tested by triggering a generation and observing the progress card update in real-time as each step completes.

**Acceptance Scenarios**:

1. **Given** the administrator triggers a newsletter generation, **When** generation starts, **Then** a persistent progress card appears in the bottom-right showing current step, progress bar, and elapsed time.

2. **Given** generation is in progress, **When** the administrator clicks "Cancel", **Then** generation stops, the history entry is marked as "Cancelled", and the progress card indicates cancellation.

3. **Given** generation is in progress, **When** the administrator navigates to another page, **Then** the progress card remains visible and continues updating via SSE connection.

4. **Given** multiple steps are processing, **When** the administrator expands the progress card, **Then** they see all generation steps with their individual statuses.

---

### User Story 8 - System Logs and Diagnostics (Priority: P3)

A system administrator needs to view and search application logs to diagnose issues, monitor system health, and maintain the application.

**Why this priority**: P3 because this is operational/maintenance functionality, not user-facing features.

**Independent Test**: Can be tested by performing an action and verifying corresponding log entries appear in the logs view.

**Acceptance Scenarios**:

1. **Given** the administrator is on the Settings Logs section, **When** they view the logs table, **Then** they see real-time log entries with timestamp, level, source, service, and message.

2. **Given** an error occurred during generation, **When** the administrator filters logs by level "ERROR" and service "Ghost", **Then** only matching error logs are displayed.

3. **Given** the administrator needs to share logs for support, **When** they click "Export", **Then** the filtered logs are downloaded as JSON or CSV file.

4. **Given** old logs are consuming storage, **When** the administrator clicks "Purge old logs" with confirmation, **Then** logs older than the configured retention period are deleted.

---

### User Story 9 - Help and Documentation (Priority: P3)

A new administrator needs guidance on configuring and using Ghostarr effectively.

**Why this priority**: P3 because core functionality should work intuitively, help is supplementary.

**Independent Test**: Can be tested by searching for a topic and verifying relevant help content is returned.

**Acceptance Scenarios**:

1. **Given** the administrator is on the Help page, **When** they search for "CRON", **Then** they see relevant help articles about scheduling syntax with clickable examples.

2. **Given** the administrator is on the generation form, **When** they hover/click the help icon next to "Publication Mode", **Then** a tooltip or mini-modal explains each option.

3. **Given** the administrator is on the Help page, **When** they browse by category, **Then** they can navigate through Getting Started, Manual Generation, Scheduling, Templates, and other categories.

---

### Edge Cases

- What happens when Ghost API is unavailable during scheduled generation?
  - System retries once after 5 minutes, then marks as failed with detailed error. Administrator receives notification if email is configured.

- What happens when Tautulli returns no viewing data for the selected period?
  - If "Skip if no news" is enabled: generation is skipped with notification. Otherwise: newsletter is generated with empty content sections or a "No recent activity" message.

- What happens when a template contains invalid variables or syntax?
  - Generation fails at template rendering step with clear error message indicating the problematic variable/line.

- What happens when generation is cancelled mid-process?
  - Partial operations are rolled back where possible. No incomplete post is created in Ghost. History shows "Cancelled" status with progress at cancellation time.

- What happens when two scheduled generations overlap?
  - Second generation queues and waits for first to complete. Progress shows "Waiting for previous generation".

- What happens when the database grows very large?
  - History and logs are automatically pruned based on configured retention periods (default: 90 days for history, 30 days for logs).

## Requirements *(mandatory)*

### Functional Requirements

**Core Generation**
- **FR-001**: System MUST fetch recent media content (films, series) from Tautulli within a configurable date range (1-90 days)
- **FR-002**: System MUST enrich media content with metadata (posters, descriptions, ratings) from TMDB
- **FR-003**: System MUST render HTML templates with fetched content using a variable substitution system
- **FR-004**: System MUST publish generated newsletters to Ghost with configurable publication mode (draft, publish, email, email+publish)
- **FR-005**: System MUST support title variables (week number, month name, year, date, date range) with real-time preview

**Content Sources**
- **FR-006**: System MUST fetch video game data from ROMM within a configurable date range
- **FR-007**: System MUST fetch book/comic data from Komga within a configurable date range
- **FR-008**: System MUST fetch audiobook data from Audiobookshelf within a configurable date range
- **FR-009**: System MUST fetch TV programming data from Tunarr for selected channels (1-7 days)
- **FR-010**: System MUST fetch viewing statistics from Tautulli (total plays, active users, watch time, top content)
- **FR-011**: System MUST support optional period-over-period comparison for statistics

**Scheduling**
- **FR-012**: System MUST support CRON-based scheduling with 5-field expressions
- **FR-013**: System MUST provide a simple scheduling mode (daily/weekly/monthly with time selection)
- **FR-014**: System MUST translate CRON expressions to human-readable descriptions
- **FR-015**: System MUST respect configured timezone for schedule execution
- **FR-016**: System MUST allow enabling/disabling schedules without deletion

**Templates**
- **FR-017**: System MUST accept HTML template uploads (single file or ZIP archive)
- **FR-018**: System MUST validate template structure and required placeholders
- **FR-019**: System MUST store preset generation configurations per template
- **FR-020**: System MUST generate preview thumbnails for templates
- **FR-021**: System MUST prevent deletion of templates used by active schedules
- **FR-039**: System MUST use Jinja2 syntax for template variables (`{{ variable }}`), loops (`{% for %}`), conditions (`{% if %}`), and filters
- **FR-040**: System MUST include a default template pre-installed for immediate use without requiring user upload

**History & Progress**
- **FR-022**: System MUST record all generation attempts with configuration, status, and timing
- **FR-023**: System MUST provide step-by-step progress tracking for each generation
- **FR-024**: System MUST support real-time progress updates via Server-Sent Events
- **FR-025**: System MUST allow regeneration using previous configuration
- **FR-026**: System MUST allow deletion of newsletters from Ghost via history interface

**Settings & Configuration**
- **FR-027**: System MUST store and test connections for all external services
- **FR-028**: System MUST persist user preferences (theme, language, timezone)
- **FR-029**: System MUST support configuration export and import
- **FR-030**: System MUST provide configurable log and history retention periods

**Notifications**
- **FR-031**: System MUST display toast notifications for user actions (success, error, warning, info)
- **FR-032**: System MUST maintain a notification center with unread count badge
- **FR-033**: System MUST provide persistent generation progress indicator during navigation

**Internationalization**
- **FR-034**: System MUST support multiple interface languages (French, English, German, Italian, Spanish)
- **FR-035**: System MUST allow instant language switching without page reload

**Maintenance Notices**
- **FR-036**: System MUST support optional maintenance notice blocks in newsletters
- **FR-037**: System MUST provide maintenance type selection (scheduled, outage, network, update, improvement, security)

**Security**
- **FR-038**: System MUST encrypt external service credentials at rest using AES-256 with an environment-derived key

### Key Entities

- **Template**: Represents an HTML newsletter template with metadata (name, description, tags), file reference, preset generation configuration, and default flag. A template can be used by multiple schedules.

- **Schedule**: Represents an automated generation configuration including name, active status, CRON expression, timezone, associated template reference, and full generation parameters. Tracks last run status and next execution time.

- **History**: Represents a single generation attempt (manual or automatic) with type, associated schedule reference (if automatic), template reference, status (pending/running/success/failed/cancelled), Ghost post reference, full configuration used, step-by-step progress log, item count, duration, and timestamps.

- **Log**: Represents a system log entry with level (debug/info/warning/error), source (backend/frontend/integration), service name, message, contextual data, and correlation ID for request tracing.

- **Setting**: Represents a key-value configuration pair for application settings (service credentials, retention periods, admin notifications).

- **UserPreference**: Represents user-specific preferences including theme (light/dark/system), language code, and timezone.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can complete a full manual newsletter generation (configure + generate + publish to Ghost) within 5 interactions from the Dashboard
- **SC-002**: Scheduled newsletters execute within 60 seconds of their configured time
- **SC-003**: Real-time progress updates are delivered to the user interface within 1 second of backend state changes
- **SC-004**: Users can configure a new external service and verify connectivity within 3 interactions
- **SC-005**: Theme and language changes reflect immediately in the interface without page reload
- **SC-006**: 95% of generation steps complete successfully when all external services are healthy
- **SC-007**: Users can find relevant help content within 2 searches
- **SC-008**: System supports at least 100 history entries and 1000 log entries without noticeable performance degradation in list views
- **SC-009**: Template preview renders accurately across mobile, tablet, and desktop viewports
- **SC-010**: Generation cancellation stops processing within 5 seconds of user request

## Assumptions

- Ghost CMS is already set up and accessible with Admin API credentials
- Tautulli is installed and configured with the media server (Plex/Jellyfin/Emby)
- TMDB API access is available (free tier sufficient for reasonable usage)
- Optional services (ROMM, Komga, Audiobookshelf, Tunarr) are assumed unavailable by default; features gracefully degrade when not configured
- Users have basic understanding of CRON syntax or will use the simple scheduling mode
- Network connectivity between Ghostarr and external services is stable and low-latency
- Browser supports modern JavaScript (ES2020+) and CSS features (CSS Grid, Flexbox, CSS Variables)
- Single-user deployment model (no multi-user authentication required for MVP)

## Deployment Constraints

- **DC-001**: Application MUST be packaged as a single Docker image (`ghostarr:latest`) containing backend, frontend, and embedded database
- **DC-002**: All persistent data (database, templates, configuration) MUST be stored in a single mountable volume (`/config`)
- **DC-003**: Application MUST be configurable via environment variables for essential settings (port, timezone, encryption key)
- **DC-004**: Application MUST use SQLite as embedded database (single file `ghostarr.db` in `/config`)
