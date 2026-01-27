# GitHub Releases - Ghostarr

> Release notes for GitHub releases

---

# v1.1.4

## 👻 Ghostarr v1.1.4 - The Complete Media Newsletter Solution

We're excited to announce Ghostarr v1.1.4, a powerful automated newsletter generator for media server administrators. This release brings together all the features that make Ghostarr the ultimate tool for keeping your users informed about your media library.

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
