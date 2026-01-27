# 🐳 Docker Deployment Guide

Advanced Docker configuration options for Ghostarr.

## Basic Deployment

```yaml
services:
  ghostarr:
    image: sharkhunterr/ghostarr:latest
    container_name: ghostarr
    ports:
      - "8080:8080"
    volumes:
      - ./config:/config
    environment:
      - TZ=Europe/Paris
      - APP_SECRET_KEY=your-secret-key-minimum-32-characters
    restart: unless-stopped
```

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `APP_SECRET_KEY` | Encryption key for credentials (min 32 chars) |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `TZ` | `UTC` | Container timezone |
| `APP_LOG_LEVEL` | `INFO` | DEBUG, INFO, WARNING, ERROR |
| `PORT` | `8080` | Web server port |

---

## Volumes

| Path | Description |
|------|-------------|
| `/config` | All persistent data |
| `/config/data.db` | SQLite database |
| `/config/templates/` | Custom templates |

---

## Network Configuration

### With Reverse Proxy

```yaml
services:
  ghostarr:
    image: sharkhunterr/ghostarr:latest
    container_name: ghostarr
    expose:
      - "8080"
    volumes:
      - ./config:/config
    environment:
      - TZ=Europe/Paris
      - APP_SECRET_KEY=your-secret-key
    networks:
      - proxy
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.ghostarr.rule=Host(`ghostarr.yourdomain.com`)"
      - "traefik.http.services.ghostarr.loadbalancer.server.port=8080"
    restart: unless-stopped

networks:
  proxy:
    external: true
```

### Custom Port

```yaml
services:
  ghostarr:
    image: sharkhunterr/ghostarr:latest
    ports:
      - "3000:8080"  # Access via port 3000
    # ...
```

---

## Health Check

The container includes a built-in health check:

```yaml
services:
  ghostarr:
    image: sharkhunterr/ghostarr:latest
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    # ...
```

---

## Resource Limits

```yaml
services:
  ghostarr:
    image: sharkhunterr/ghostarr:latest
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 128M
    # ...
```

---

## Backup Strategy

### Database Backup

```bash
# Stop container
docker compose stop ghostarr

# Backup database
cp ./config/data.db ./backups/data-$(date +%Y%m%d).db

# Start container
docker compose start ghostarr
```

### Full Backup

```bash
# Backup entire config
tar -czvf ghostarr-backup-$(date +%Y%m%d).tar.gz ./config
```

### Automated Backup (cron)

```bash
# Add to crontab
0 3 * * * cd /path/to/ghostarr && tar -czvf /backups/ghostarr-$(date +\%Y\%m\%d).tar.gz ./config
```

---

## Multi-Architecture Support

Ghostarr supports:
- `linux/amd64`
- `linux/arm64`

Docker will automatically pull the correct image for your platform.

---

## Available Tags

| Tag | Description |
|-----|-------------|
| `latest` | Latest stable release |
| `v1.1.4` | Specific version |
| `v1` | Latest v1.x release |

### Pin to Version

```yaml
services:
  ghostarr:
    image: sharkhunterr/ghostarr:v1.1.4
    # ...
```

---

## Updating

```bash
# Pull latest
docker compose pull

# Recreate container
docker compose up -d

# Clean old images
docker image prune -f
```

### Check Current Version

```bash
docker exec ghostarr cat /app/version.txt
# Or check via API
curl http://localhost:8080/api/v1/health
```

---

## Logs

### View Logs

```bash
# Follow logs
docker logs -f ghostarr

# Last 100 lines
docker logs --tail 100 ghostarr
```

### Log Levels

Set `APP_LOG_LEVEL` to control verbosity:

| Level | Description |
|-------|-------------|
| `DEBUG` | All messages (development) |
| `INFO` | Normal operations (default) |
| `WARNING` | Warnings only |
| `ERROR` | Errors only |

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs ghostarr

# Check if port is in use
lsof -i :8080
```

### Database locked

SQLite WAL mode is enabled. Ensure only one instance runs.

### Permission denied

```bash
# Fix permissions
sudo chown -R 1000:1000 ./config
```

### Out of memory

Increase container memory limit or reduce concurrent operations.

---

## Next Steps

- [Installation Guide](installation.md) - First-time setup
- [Configuration Guide](configuration.md) - Service configuration
- [User Guide](user-guide.md) - Using Ghostarr
