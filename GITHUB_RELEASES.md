# GitHub Releases - Ghostarr

> Release notes for GitHub releases

---

# v1.5.0

## 👻 Ghostarr v1.5.0 - Bulk Operations, Full Backup & Ghost Email Fix

This release introduces bulk template operations, a comprehensive backup/restore system, and fixes critical Ghost email publishing issues with newsletter channel selection.

### ✨ What's New

**📦 Bulk Template Export**
- Export multiple templates at once with a new selection dialog
- Select all or pick specific templates to export
- Single JSON file containing all selected templates with:
  - HTML content
  - Labels
  - Preset configurations
  - Metadata

**📥 Smart Bulk Import**
- Drag & drop a bulk export file into the upload dialog
- Auto-detection of file format (single template vs bulk export)
- Preview list of templates before importing
- Skip existing templates to avoid duplicates
- Detailed import results with success/skipped/error counts

**💾 Full Configuration Backup**
- New backup system in Settings to export your entire configuration:
  - Service configurations (with credentials)
  - User preferences (theme, language, timezone)
  - Retention settings
  - Templates (with HTML content)
  - Schedules (generation & cleanup)
  - Labels
- Selective backup: choose which components to include
- Restore with conflict handling (skip existing items)

**🔄 Improved Upload Dialog**
- Unified upload experience for all template formats
- Accepts: HTML, ZIP, single JSON, or bulk JSON
- Format auto-detection with appropriate UI
- Bulk imports show template list preview

**📬 Newsletter Channel Selection**
- New dropdown to select which Ghost newsletter to use for email sending
- Available in both Manual Generation and Scheduled Generation forms
- Selector only appears when an email mode is selected
- Default: "Automatic" - uses the first active newsletter

**🔄 Smart Newsletter Auto-Selection**
- If no newsletter is specified, Ghostarr automatically selects the first active newsletter
- Backwards compatible with existing schedules that don't have a newsletter configured
- Detailed logging of newsletter selection for troubleshooting

### 🐛 Bug Fixes

**📧 Ghost Email Publishing**
- Fixed an issue where email modes (Email, Email+Publish) weren't sending newsletters
- Implemented Ghost API 2-step process for email sending:
  1. Create post as draft
  2. PUT request with newsletter slug in URL to trigger email
- Email-only mode now correctly sets posts as visible only via email (not on site)
- Publish+Email mode now correctly publishes on site AND sends email

**🔧 API Route Ordering**
- Fixed 405 errors on bulk export/import endpoints
- Reordered FastAPI routes to ensure static paths match before dynamic ones

### 🌍 Multi-language Support
- All new features fully translated in 5 languages (EN, FR, DE, ES, IT)
- Newsletter selector, bulk operations, and backup/restore dialogs fully localized

### 🔧 Technical Details

The Ghost Admin API requires email sending to be triggered via the PUT endpoint URL:
```
PUT /ghost/api/admin/posts/{id}/?newsletter={slug}
```

This is different from the documented `newsletter_id` body parameter, which only links the post to a newsletter but doesn't trigger email delivery.

### 📋 Backup File Format

```json
{
  "version": "3.0",
  "exportedAt": "2026-02-05T12:00:00",
  "type": "full_backup",
  "services": { ... },
  "preferences": { ... },
  "retention": { ... },
  "templates": [ ... ],
  "schedules": [ ... ],
  "labels": [ ... ]
}
```

### 🐳 Docker Quick Start

```yaml
services:
  ghostarr:
    image: sharkhunterr/ghostarr:latest
    ports:
      - "8080:8080"
    volumes:
      - ./config:/config
    environment:
      - TZ=Europe/Paris
      - APP_SECRET_KEY=your-secret-key-minimum-32-characters
```

### 🔗 Links

- [🐳 Docker Hub](https://hub.docker.com/r/sharkhunterr/ghostarr)
- [📖 Documentation](https://github.com/sharkhunterr/ghostarr/tree/master/docs)
- [🐛 Report Issues](https://github.com/sharkhunterr/ghostarr/issues)

---

# v1.4.0

## 👻 Ghostarr v1.4.0 - Template Export & Import

This release introduces a complete template export/import system, making it easy to share templates between Ghostarr instances or backup your customized templates.

### ✨ What's New

**📤 Template Export**
- Export any template as a JSON file containing:
  - Complete HTML template content
  - Associated labels
  - Preset generation configuration
  - Template metadata (name, description)
- One-click download from the template card menu

**📥 Template Import**
- Import templates from exported JSON files
- Drag & drop JSON files directly into the upload dialog
- Auto-fill form fields from JSON metadata
- Automatic label creation if labels don't exist
- Preserves preset configuration during import

**🔍 Enhanced Folder Scan**
- Scan now detects both HTML and JSON template files
- JSON templates are automatically parsed and imported with their:
  - Labels (created if missing)
  - Preset configuration
  - Metadata

**🌍 Multi-language Support**
- All new features fully translated in 5 languages (EN, FR, DE, ES, IT)

### 🔄 Template Portability

Share templates between users or Ghostarr instances:
1. Export a template from the dropdown menu
2. Send the `.json` file to another user
3. They import it via drag & drop or folder scan
4. Labels and presets are preserved automatically

### 🐳 Docker Quick Start

```yaml
services:
  ghostarr:
    image: sharkhunterr/ghostarr:latest
    ports:
      - "8080:8080"
    volumes:
      - ./config:/config
    environment:
      - TZ=Europe/Paris
      - APP_SECRET_KEY=your-secret-key-minimum-32-characters
```

### 🔗 Links

- [🐳 Docker Hub](https://hub.docker.com/r/sharkhunterr/ghostarr)
- [📖 Documentation](https://github.com/sharkhunterr/ghostarr/tree/master/docs)
- [🐛 Report Issues](https://github.com/sharkhunterr/ghostarr/issues)

---

# v1.2.0

## 👻 Ghostarr v1.2.0 - Documentation & Branding Update

This release brings comprehensive documentation, new branding assets, and important fixes to make Ghostarr even more polished and user-friendly.

### ✨ What's New

**🎨 New Branding**
- Custom SVG logo with ghost + newsletter theme
- Beautiful banner for README and promotional use
- New favicon for the web interface
- Consistent visual identity across all platforms

**📚 Comprehensive Documentation**
- Complete [Installation Guide](https://github.com/sharkhunterr/ghostarr/blob/master/docs/installation.md)
- Detailed [Configuration Guide](https://github.com/sharkhunterr/ghostarr/blob/master/docs/configuration.md) for all 7 services
- [Docker Deployment Guide](https://github.com/sharkhunterr/ghostarr/blob/master/docs/docker.md) with advanced options
- Full [User Manual](https://github.com/sharkhunterr/ghostarr/blob/master/docs/user-guide.md) with screenshots

**🔧 Maintenance Notices Feature**
- Inform users about planned maintenance or incidents
- 6 notice types: Scheduled, Outage, Network, Update, Improvement, Security
- Generate maintenance-only newsletters
- Configurable duration and start time

**🐛 Bug Fixes**
- Fixed database initialization on fresh Docker installs
- Alembic migrations now work correctly for new databases
- Improved error handling during startup

**📸 Screenshot Gallery**
- 22 new screenshots documenting all features
- Consistent naming convention for all images
- Dark mode examples included

### 🔌 All Features

**7 Service Integrations**
- Tautulli, Ghost CMS, TMDB, ROMM, Komga, Audiobookshelf, Tunarr

**Smart Scheduling**
- CRON-based with timezone support
- Generation & Cleanup schedules
- Real-time progress tracking

**Beautiful Newsletters**
- Jinja2 templates
- Ranking evolution badges
- Play statistics comparison
- Preview before sending

**Modern Interface**
- 5 languages (EN, FR, DE, ES, IT)
- Light/Dark/System themes
- Export/Import configuration

### 🛠️ Technical Stack

| Layer | Technologies |
|-------|--------------|
| Backend | Python 3.11, FastAPI, SQLAlchemy, APScheduler |
| Frontend | React 18, TypeScript, Tailwind CSS, Radix UI |
| Data | SQLite, Zustand, React Query |
| DevOps | Docker, GitLab CI/CD |

### 🐳 Docker Quick Start

```yaml
services:
  ghostarr:
    image: sharkhunterr/ghostarr:latest
    ports:
      - "8080:8080"
    volumes:
      - ./config:/config
    environment:
      - TZ=Europe/Paris
      - APP_SECRET_KEY=your-secret-key-minimum-32-characters
```

### 🔗 Links

- [🐳 Docker Hub](https://hub.docker.com/r/sharkhunterr/ghostarr)
- [📖 Documentation](https://github.com/sharkhunterr/ghostarr/tree/master/docs)
- [🐛 Report Issues](https://github.com/sharkhunterr/ghostarr/issues)

---

# v1.1.5

## 👻 Ghostarr v1.1.5 - The Complete Media Newsletter Solution

We're excited to announce Ghostarr v1.1.5, a powerful automated newsletter generator for media server administrators. This release brings together all the features that make Ghostarr the ultimate tool for keeping your users informed about your media library.

### ✨ Highlights

**🔌 7 Service Integrations** - Connect your entire media ecosystem:
- **Tautulli** - Plex viewing statistics, top movies, shows, and user activity
- **Ghost CMS** - Beautiful newsletter publishing with multiple modes
- **TMDB** - Rich metadata, ratings, and poster artwork
- **ROMM** - Video game library management
- **Komga** - Comics and manga collections
- **Audiobookshelf** - Audiobook library
- **Tunarr** - TV programming guide

**📅 Smart Scheduling System**
- Flexible CRON-based scheduling with timezone support
- Two schedule types: Newsletter Generation & Automated Cleanup
- Retention policies to manage history automatically
- Real-time progress tracking with SSE streaming
- Manual execution with live progress modal

**📰 Beautiful Responsive Newsletters**
- Jinja2 template engine for full customization
- Ranking evolution badges showing position changes
- Play statistics with period-over-period comparison
- New additions and trending content sections
- Mobile-responsive design out of the box
- Preview before sending

**🖥️ Modern Web Interface**
- 5 languages supported (English, French, German, Spanish, Italian)
- Light/Dark/System theme support
- Fully responsive sidebar navigation
- Complete history tracking with config replay
- Export/Import configuration for easy backup

**📬 Flexible Publishing Options**
- Draft only - Review before publishing
- Site only - Blog post without email
- Email only - Newsletter distribution
- Site + Email - Full publication

**🔧 Maintenance Notices**
- Scheduled maintenance announcements
- Outage and incident communication
- Update and improvement notices
- Security advisories

**🏭 Production Ready**
- Docker deployment with single image
- SQLite with WAL mode for reliability
- Encrypted credential storage
- Comprehensive logging system

### 🛠️ Technical Stack

| Layer | Technologies |
|-------|--------------|
| Backend | Python 3.11, FastAPI, SQLAlchemy, APScheduler |
| Frontend | React 18, TypeScript, Tailwind CSS, Radix UI |
| Data | SQLite, Zustand, React Query |
| DevOps | Docker, GitLab CI/CD |

### 🐳 Docker Quick Start

```yaml
services:
  ghostarr:
    image: sharkhunterr/ghostarr:latest
    ports:
      - "8080:8080"
    volumes:
      - ./config:/config
    environment:
      - TZ=Europe/Paris
      - APP_SECRET_KEY=your-secret-key-minimum-32-characters
```

### 🔗 Links

- [🐳 Docker Hub](https://hub.docker.com/r/sharkhunterr/ghostarr)
- [📖 Documentation](https://github.com/sharkhunterr/ghostarr#readme)
- [🐛 Report Issues](https://github.com/sharkhunterr/ghostarr/issues)

---

# Instructions

1. Go to https://github.com/sharkhunterr/ghostarr/releases/new
2. **Tag**: Use the version tag
3. **Target**: `main`
4. **Title**: Copy the title from the version section
5. **Description**: Copy everything from `## 👻 Ghostarr` to the end of the section
6. **Publish release**

> The script `npm run release:full` automatically takes the FIRST version section (the one at the top)
