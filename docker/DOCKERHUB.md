# 👻 Ghostarr - Newsletter Generator

[![GitHub](https://img.shields.io/github/v/tag/sharkhunterr/ghostarr?label=version&color=blue)](https://github.com/sharkhunterr/ghostarr/releases)
[![Docker Pulls](https://img.shields.io/docker/pulls/sharkhunterr/ghostarr?color=2496ED)](https://hub.docker.com/r/sharkhunterr/ghostarr)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/sharkhunterr/ghostarr/blob/master/LICENSE)

**Automated newsletter generator for media server administrators** — Collect statistics from your homelab services and publish beautiful newsletters to Ghost CMS.

---

## 🚀 Quick Start

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
    restart: unless-stopped
```

```bash
docker compose up -d
```

**Access**: http://localhost:8080

---

## ✨ Features

**🔌 7 Service Integrations**
- **Tautulli** - Plex viewing statistics, top movies and shows
- **Ghost CMS** - Newsletter publishing with multiple modes
- **TMDB** - Rich metadata, ratings, and artwork
- **ROMM** - Video game library
- **Komga** - Comics and manga
- **Audiobookshelf** - Audiobooks
- **Tunarr** - TV programming guide

**📅 Smart Scheduling**
- CRON-based scheduling with timezone support
- Newsletter generation & automated cleanup
- Real-time progress tracking
- Manual execution with live progress

**📰 Beautiful Newsletters**
- Jinja2 template customization
- Ranking evolution badges
- Play statistics comparison
- Maintenance notices
- Preview before sending

**🖥️ Modern Interface**
- 5 languages (EN, FR, DE, ES, IT)
- Light/Dark/System themes
- Export/Import configuration
- Complete history tracking

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_SECRET_KEY` | *required* | Encryption key (min 32 chars) |
| `TZ` | `UTC` | Container timezone |
| `APP_LOG_LEVEL` | `INFO` | Log level |
| `PORT` | `8080` | Server port |

### Volumes

| Path | Description |
|------|-------------|
| `/config/data.db` | SQLite database |
| `/config/templates/` | Custom templates |

---

## 🏷️ Available Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest stable release |
| `v1.x.x` | Specific version |

```bash
docker pull sharkhunterr/ghostarr:latest
```

---

## 🔄 Update

```bash
docker compose pull
docker compose up -d
docker image prune -f
```

---

## 🛠️ Technical Stack

| Layer | Technologies |
|-------|--------------|
| Backend | Python 3.11, FastAPI, SQLAlchemy, APScheduler |
| Frontend | React 18, TypeScript, Tailwind CSS, Radix UI |
| Data | SQLite, Zustand, React Query |

**Platforms**: `linux/amd64`, `linux/arm64`

---

## 🔗 Links

- [📖 Documentation](https://github.com/sharkhunterr/ghostarr#readme)
- [🐛 Report Issues](https://github.com/sharkhunterr/ghostarr/issues)
- [⭐ Star on GitHub](https://github.com/sharkhunterr/ghostarr)

---

## 📄 License

MIT License - [LICENSE](https://github.com/sharkhunterr/ghostarr/blob/master/LICENSE)

---

<div align="center">

**Built with Claude Code 🤖 for the homelab community 🏠**

</div>
