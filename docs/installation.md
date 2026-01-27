# 🚀 Installation Guide

This guide covers all methods to install and run Ghostarr.

## Docker Compose (Recommended)

### 1. Create docker-compose.yml

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

### 2. Start the container

```bash
docker compose up -d
```

### 3. Access the interface

Open http://localhost:8080 in your browser.

---

## Docker Run

```bash
docker run -d \
  --name ghostarr \
  -p 8080:8080 \
  -v $(pwd)/config:/config \
  -e TZ=Europe/Paris \
  -e APP_SECRET_KEY=your-secret-key-minimum-32-characters \
  sharkhunterr/ghostarr:latest
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_SECRET_KEY` | **Yes** | - | Encryption key (min 32 characters) |
| `TZ` | No | `UTC` | Container timezone |
| `APP_LOG_LEVEL` | No | `INFO` | Log level: DEBUG, INFO, WARNING, ERROR |
| `PORT` | No | `8080` | Web server port |

### Generate a Secret Key

```bash
# Linux/macOS
openssl rand -hex 32

# Or using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

---

## Volumes

| Container Path | Description |
|----------------|-------------|
| `/config/data.db` | SQLite database (settings, history, schedules) |
| `/config/templates/` | Custom newsletter templates |

> **Important**: Always mount `/config` to persist your data between container updates.

---

## First Launch

1. **Access the interface** at http://localhost:8080
2. **Go to Settings → Services** to configure your integrations
3. **Test each connection** using the "Test" button
4. **Create a template** or use the default one
5. **Generate your first newsletter** from the Dashboard

---

## Updating

```bash
# Pull latest image
docker compose pull

# Recreate container
docker compose up -d

# Clean old images
docker image prune -f
```

---

## Unraid Installation

Ghostarr is available in the Unraid Community Applications store.

1. Go to **Apps** tab in Unraid
2. Search for **Ghostarr**
3. Click **Install**
4. Configure the template variables
5. Click **Apply**

---

## Troubleshooting

### Container won't start

Check the logs:
```bash
docker logs ghostarr
```

### Database locked error

Ensure only one Ghostarr instance accesses the database. SQLite WAL mode is enabled by default.

### Permission issues

```bash
# Fix volume permissions
sudo chown -R 1000:1000 ./config
```

---

## Next Steps

- [Configuration Guide](configuration.md) - Set up your services
- [User Guide](user-guide.md) - Learn how to use Ghostarr
- [Docker Guide](docker.md) - Advanced Docker options
