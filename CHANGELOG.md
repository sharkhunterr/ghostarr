# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Individual Ranking Evolution
- Statistics now show individual evolution (up/down/new/stable) for each movie, show, and user
- Uses Tautulli `get_history` API with date filters to fetch previous period rankings
- Compares current vs previous period positions to calculate ranking changes
- Displays evolution badges with position changes (e.g., "+2", "-1", "NEW")

#### History Configuration Display
- New collapsible "Generation Config" section in history progress modal
- Displays all generation parameters used for each newsletter:
  - Publication mode (draft, site, email, site+email)
  - Active sources (Tautulli, Romm, Komga, Audiobookshelf, Tunarr)
  - Tautulli settings (days, max items, featured item)
  - Statistics settings (days, comparison enabled)
  - Maintenance settings (type)
  - Max total items limit
- Added `@radix-ui/react-collapsible` dependency
- New Collapsible UI component

#### SQLite Concurrency Improvements
- Enabled WAL (Write-Ahead Logging) mode for better database concurrency
- Added 30-second timeout for SQLite connections
- Added `busy_timeout` pragma (30 seconds)
- Batch log writes in `DatabaseLogHandler` to reduce database contention
- Added connection pool settings (`pool_size=5`, `max_overflow=10`, `pool_pre_ping=True`)

### Changed

- Statistics comparison (`include_comparison`) is now enabled by default in:
  - Manual generation form
  - Schedule form
  - Backend generation schema

### Fixed

- Fixed "database is locked" error during newsletter generation
- Fixed evolution always showing "stable" for all content
- Fixed `get_home_stats` API not supporting date range filtering by switching to `get_history`

## [0.1.0] - 2026-01-20

### Added

- Initial Ghostarr newsletter generator application
- FastAPI backend with async support
- React frontend with TypeScript and Vite
- Tautulli integration for media statistics
- Ghost CMS integration for newsletter publishing
- TMDB integration for media metadata enrichment
- SQLite database with SQLAlchemy ORM
- Real-time progress tracking with SSE
- Scheduled newsletter generation with APScheduler
- Multi-language support (English, French)
- Dark/light theme support
- Database log persistence with correlation IDs
- Toast notification system
- Template preview with responsive viewports
