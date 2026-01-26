# Ghostarr Docker Deployment

**Newsletter generator for media server administrators - Complete deployment guide**

This guide covers Docker deployment of Ghostarr. For Docker Hub overview, see [DOCKERHUB.md](DOCKERHUB.md).

---

## Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Download docker-compose.yml
curl -o docker-compose.yml https://raw.githubusercontent.com/sharkhunterr/ghostarr/master/docker/docker-compose.yml

# Start Ghostarr
docker compose up -d

# View logs
docker compose logs -f ghostarr
```

**Access**: http://localhost:3000

### Option 2: Docker Run

```bash
docker run -d \
  --name ghostarr \
  -p 3000:3000 \
  -p 8000:8000 \
  -v ghostarr-data:/app/data \
  -e LOG_LEVEL=INFO \
  --restart unless-stopped \
  sharkhunterr/ghostarr:latest
```

---

## What's in the Image

The unified Ghostarr image includes:

| Component | Description | Port |
|-----------|-------------|------|
| **Web UI** | React frontend (nginx) | 3000 |
| **API** | FastAPI backend | 8000 |
| **Database** | SQLite | - |

**Platforms**: `linux/amd64`, `linux/arm64`

---

## Configuration

### Docker Compose Example

```yaml
services:
  ghostarr:
    image: sharkhunterr/ghostarr:latest
    container_name: ghostarr
    hostname: ghostarr
    ports:
      - "3000:3000"   # Web UI
      - "8000:8000"   # API
    volumes:
      - ghostarr-data:/app/data
    environment:
      # Logging
      - LOG_LEVEL=INFO

      # Database (SQLite default)
      - DATABASE_URL=sqlite+aiosqlite:////app/data/ghostarr.db

      # CORS (optional)
      - CORS_ORIGINS=*

    restart: unless-stopped

    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

volumes:
  ghostarr-data:
    driver: local
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LOG_LEVEL` | `INFO` | `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |
| `DATABASE_URL` | `sqlite+aiosqlite:////app/data/ghostarr.db` | Database connection string |
| `CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated) |

---

## Backup & Restore

### Via Web UI

1. **Settings > Configuration** tab
2. Select data to export
3. Click **Export** to download JSON

### Via Volume

```bash
# Backup
docker run --rm \
  -v ghostarr-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/ghostarr-$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm \
  -v ghostarr-data:/data \
  -v $(pwd):/backup \
  alpine sh -c "cd /data && tar xzf /backup/ghostarr-YYYYMMDD.tar.gz"
```

---

## Updates

```bash
# Pull latest image
docker compose pull

# Recreate container
docker compose up -d

# Clean old images
docker image prune -f
```

### Version Pinning

```yaml
services:
  ghostarr:
    image: sharkhunterr/ghostarr:v1.0.0  # Pin to specific version
```

---

## Troubleshooting

### Container Won't Start

Check logs: `docker compose logs ghostarr`

Common issues:
- Port conflict: Change ports in compose file
- Permission: `chmod -R 755 ./data`
- Database locked: Stop all instances

### Services Can't Connect

**Mac/Windows**: Use `host.docker.internal` instead of `localhost`

**Linux**: Use your machine's IP (not `localhost`)

Test: `docker compose exec ghostarr curl -I http://YOUR_SERVICE`

---

## Resources

- **Docker Hub**: https://hub.docker.com/r/sharkhunterr/ghostarr
- **GitHub**: https://github.com/sharkhunterr/ghostarr

---

**Built with Docker for the homelab community**
