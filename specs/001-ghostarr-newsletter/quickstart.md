# Quickstart: Ghostarr Development

**Feature**: 001-ghostarr-newsletter
**Date**: 2026-01-20

## Prerequisites

- **Docker**: 24.0+ with Compose v2
- **Node.js**: 20 LTS (for frontend development)
- **Python**: 3.11+ (for backend development)
- **Git**: 2.40+

## Quick Start (Docker)

```bash
# Clone and navigate
cd ghostarr

# Copy environment template
cp .env.example .env

# Edit .env with your API keys (optional for dev)
# TAUTULLI_URL=http://your-tautulli:8181
# TAUTULLI_API_KEY=your-key

# Start development environment
docker compose up -d

# View logs
docker compose logs -f

# Access application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000/api/v1
# API Docs: http://localhost:8000/docs
```

## Local Development Setup

### Backend

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -e ".[dev]"

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest

# Run linting
ruff check .
ruff format .
```

### Frontend

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Run linting
npm run lint

# Build for production
npm run build
```

## Environment Variables

### Required for Production

```env
# Security (REQUIRED)
APP_SECRET_KEY=your-32-char-secret-key-here

# Application
APP_ENV=production
APP_TIMEZONE=Europe/Paris
```

### Optional Services

```env
# Tautulli (media stats)
TAUTULLI_URL=http://tautulli:8181
TAUTULLI_API_KEY=your-api-key

# TMDB (metadata enrichment)
TMDB_API_KEY=your-api-key

# Ghost (newsletter publishing)
GHOST_URL=https://your-ghost.com
GHOST_ADMIN_API_KEY=your-admin-api-key

# ROMM (games)
ROMM_URL=http://romm:8080
ROMM_API_KEY=your-api-key

# Komga (comics/books)
KOMGA_URL=http://komga:25600
KOMGA_API_KEY=your-api-key

# Audiobookshelf
AUDIOBOOKSHELF_URL=http://audiobookshelf:80
AUDIOBOOKSHELF_API_KEY=your-api-key

# Tunarr (TV programming)
TUNARR_URL=http://tunarr:8000
TUNARR_API_KEY=your-api-key
```

## Project Structure

```
ghostarr/
├── backend/           # FastAPI application
│   ├── app/
│   │   ├── api/v1/    # API endpoints
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   ├── services/  # Business logic
│   │   └── integrations/  # External service connectors
│   └── alembic/       # Database migrations
├── frontend/          # React application
│   └── src/
│       ├── api/       # API client
│       ├── components/  # React components
│       ├── pages/     # Page components
│       ├── hooks/     # Custom hooks
│       ├── stores/    # Zustand stores
│       └── i18n/      # Translations
├── templates/         # Newsletter templates
└── tests/             # Test suites
```

## Common Tasks

### Create Database Migration

```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

### Add New Translation

```bash
# 1. Copy existing locale
cp -r frontend/src/i18n/locales/fr frontend/src/i18n/locales/XX

# 2. Translate JSON files

# 3. Register in frontend/src/i18n/index.ts
```

### Add New Integration

```bash
# 1. Create integration file
touch backend/app/integrations/myservice.py

# 2. Implement BaseIntegration interface

# 3. Register in settings schema

# 4. Add service card in frontend
```

### Run Full Test Suite

```bash
# Backend tests
cd backend && pytest --cov=app

# Frontend tests
cd frontend && npm test -- --coverage

# Integration tests (requires Docker)
docker compose -f docker-compose.test.yml up --abort-on-container-exit
```

## API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## Debugging

### Backend Logs

```bash
# Docker
docker compose logs -f backend

# Local
# Logs are written to stdout and /config/logs/ghostarr.log
```

### Frontend DevTools

- React DevTools extension
- TanStack Query DevTools (enabled in dev mode)

### Database Inspection

```bash
# SQLite CLI
sqlite3 /config/ghostarr.db

# Common queries
.tables
.schema templates
SELECT * FROM history ORDER BY created_at DESC LIMIT 10;
```

## Troubleshooting

### Port Already in Use

```bash
# Find process
lsof -i :8000  # or :3000

# Kill process
kill -9 <PID>
```

### Database Migration Errors

```bash
# Reset to clean state (DEV ONLY)
rm /config/ghostarr.db
alembic upgrade head
```

### CORS Issues

Check that `CORS_ORIGINS` in backend config includes your frontend URL.

### SSE Not Working

- Ensure reverse proxy supports SSE (no buffering)
- Check browser console for connection errors
- Verify `/api/v1/progress/stream` endpoint is accessible

## Docker Build

```bash
# Build image
docker build -t ghostarr:latest .

# Run container
docker run -d \
  -p 8080:8080 \
  -v ./config:/config \
  -e APP_SECRET_KEY=your-secret-key \
  ghostarr:latest
```

## Contributing

1. Create feature branch from `main`
2. Follow naming conventions from constitution
3. Write tests for new features
4. Run linting before commit
5. Update translations if adding UI text
6. Submit PR with description

## Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [shadcn/ui Components](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query)
- [i18next](https://www.i18next.com/)
