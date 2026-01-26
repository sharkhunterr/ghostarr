# Ghostarr Newsletter Generator

[![GitHub](https://img.shields.io/github/v/tag/sharkhunterr/ghostarr?label=version&color=blue)](https://github.com/sharkhunterr/ghostarr/releases)
[![Docker Pulls](https://img.shields.io/docker/pulls/sharkhunterr/ghostarr?color=2496ED)](https://hub.docker.com/r/sharkhunterr/ghostarr)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/sharkhunterr/ghostarr/blob/master/LICENSE)

**Newsletter generator for media server administrators** — Automatically create beautiful newsletters showcasing your latest media additions from Plex, Tautulli, Overseerr, and more.

---

## Quick Start

```bash
# Pull the image
docker pull sharkhunterr/ghostarr:latest

# Run with Docker Compose
curl -o docker-compose.yml https://raw.githubusercontent.com/sharkhunterr/ghostarr/master/docker/docker-compose.yml
docker compose up -d
```

**Access**: http://localhost:3000

---

## What You Get

| Component | Port | Description |
|-----------|------|-------------|
| **Web UI** | 3000 | Modern React interface |
| **API** | 8000 | FastAPI REST API |
| **Database** | - | SQLite |

**Platforms**: `linux/amd64`, `linux/arm64`

---

## Features

- **Multi-Source Integration** — Plex, Tautulli, Overseerr, Radarr, Sonarr, and more
- **Ghost CMS Publishing** — Direct newsletter publishing to Ghost
- **Customizable Templates** — Jinja2-based HTML templates
- **Scheduled Generation** — Automatic newsletter creation via CRON
- **Multi-language** — 5 languages (EN, FR, DE, ES, IT)
- **Export/Import** — Full configuration backup and restore
- **Preview Mode** — Preview newsletters before publishing

---

## Configuration

### Basic Deployment

```yaml
services:
  ghostarr:
    image: sharkhunterr/ghostarr:latest
    container_name: ghostarr
    ports:
      - "3000:3000"   # Web UI
      - "8000:8000"   # API
    volumes:
      - ghostarr-data:/app/data
    environment:
      - LOG_LEVEL=INFO
      - DATABASE_URL=sqlite+aiosqlite:////app/data/ghostarr.db
    restart: unless-stopped

volumes:
  ghostarr-data:
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR` |
| `DATABASE_URL` | `sqlite+aiosqlite:////app/data/ghostarr.db` | Database connection |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |

---

## Available Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest stable release |
| `v1.0.0` | Specific version |
| `v1.x.x` | Version pinning |

```bash
# Pin to specific version
docker pull sharkhunterr/ghostarr:v1.0.0
```

---

## Update

```bash
docker compose pull
docker compose up -d
docker image prune -f
```

---

## Documentation

- **[Docker Guide](https://github.com/sharkhunterr/ghostarr/blob/master/docker/README.md)** — Complete deployment guide
- **[GitHub](https://github.com/sharkhunterr/ghostarr)** — Source code and docs

---

## Technology Stack

**Backend**: Python 3.11 - FastAPI - SQLAlchemy - APScheduler

**Frontend**: React 18 - TypeScript - Tailwind CSS - i18next

**DevOps**: Docker - GitLab CI - GitHub Actions

---

## Built With

- **[Claude Code](https://claude.ai/claude-code)** — 100% vibe coded

---

## License

MIT License - see [LICENSE](https://github.com/sharkhunterr/ghostarr/blob/master/LICENSE)

---

<div align="center">

**Built with Claude Code for the homelab community**

[Star on GitHub](https://github.com/sharkhunterr/ghostarr) - [Report Bug](https://github.com/sharkhunterr/ghostarr/issues) - [Request Feature](https://github.com/sharkhunterr/ghostarr/issues)

</div>
