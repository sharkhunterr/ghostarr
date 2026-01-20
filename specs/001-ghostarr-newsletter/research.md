# Research: Ghostarr Newsletter Generator

**Feature**: 001-ghostarr-newsletter
**Date**: 2026-01-20
**Status**: Complete

## Technology Decisions

### 1. Backend Framework

**Decision**: FastAPI with Python 3.11+

**Rationale**:
- Native async support for concurrent API calls to external services
- Built-in OpenAPI documentation generation
- Pydantic v2 integration for validation
- Excellent SSE support via `sse-starlette`
- Constitution mandates FastAPI

**Alternatives Considered**:
- Flask: Lacks native async, would require Celery for background tasks
- Django: Overkill for single-user app, slower startup

### 2. Database

**Decision**: SQLite with SQLAlchemy ORM + Alembic

**Rationale**:
- Zero configuration required for deployment
- Single file easily backed up with volume mount
- Sufficient performance for single-user, <1000 records
- Alembic enables schema migrations
- Constitution mandates SQLite

**Alternatives Considered**:
- PostgreSQL: Requires separate container, overkill for single-user
- TinyDB: No migration support, limited query capabilities

### 3. Task Scheduler

**Decision**: APScheduler with SQLAlchemy job store

**Rationale**:
- In-process scheduler (no external dependency)
- Persistent job storage in SQLite
- CRON expression support
- Timezone-aware scheduling
- Constitution mandates APScheduler

**Alternatives Considered**:
- Celery + Redis: Requires Redis container, overkill
- Huey: Less mature, smaller community

### 4. Template Engine

**Decision**: Jinja2

**Rationale**:
- Industry standard for Python templating
- Rich feature set (loops, conditions, filters, inheritance)
- Familiar syntax for users
- Secure by default (auto-escaping)
- Clarification session confirmed Jinja2

**Alternatives Considered**:
- Handlebars: JavaScript-based, would require Node.js
- Custom syntax: Higher development cost, less documentation

### 5. Real-time Updates

**Decision**: Server-Sent Events (SSE)

**Rationale**:
- Simpler than WebSockets for unidirectional updates
- Native browser support, no library needed client-side
- HTTP-based, works with reverse proxies
- Automatic reconnection built into EventSource API
- Constitution mandates SSE for progress

**Alternatives Considered**:
- WebSockets: Bidirectional not needed, more complex
- Polling: Higher latency, more server load

### 6. Frontend State Management

**Decision**: TanStack Query + Zustand

**Rationale**:
- TanStack Query for server state (caching, refetching, mutations)
- Zustand for client state (theme, notifications, progress)
- Lightweight, TypeScript-first
- Constitution mandates this combination

**Alternatives Considered**:
- Redux: Boilerplate heavy for this scale
- Jotai: Less mature server state handling

### 7. UI Component Library

**Decision**: shadcn/ui + Tailwind CSS

**Rationale**:
- Copy-paste components, full control over code
- Accessible by default (Radix primitives)
- Consistent design system
- Dark mode support built-in
- Constitution mandates shadcn/ui + Tailwind

**Alternatives Considered**:
- Material UI: Larger bundle, opinionated styling
- Chakra UI: Similar benefits but less customizable

### 8. Internationalization

**Decision**: i18next + react-i18next

**Rationale**:
- Industry standard for React i18n
- JSON namespace files for easy translation
- Instant language switching without reload
- TypeScript support for type-safe keys
- Constitution mandates i18next

**Alternatives Considered**:
- FormatJS: More complex setup
- Custom solution: Higher maintenance cost

### 9. Credential Encryption

**Decision**: AES-256 with environment-derived key

**Rationale**:
- Industry standard symmetric encryption
- Key derived from `APP_SECRET_KEY` environment variable
- Cryptography library well-maintained
- Clarification session confirmed this approach

**Implementation**:
```python
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import base64

def derive_key(secret: str) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=b"ghostarr_salt",  # Static salt, key changes with secret
        iterations=100000,
    )
    return base64.urlsafe_b64encode(kdf.derive(secret.encode()))
```

### 10. Docker Image Strategy

**Decision**: Multi-stage build, single image

**Rationale**:
- Clarification confirmed single Docker image requirement
- Multi-stage reduces final image size
- Backend serves frontend static files
- All data in `/config` volume

**Build Stages**:
1. `frontend-build`: Node.js, build React app
2. `backend`: Python 3.11-slim, copy built frontend
3. Final image: ~200MB target

## Integration Best Practices

### External Service Pattern

All integrations implement `BaseIntegration`:

```python
from abc import ABC, abstractmethod
from typing import TypeVar, Generic
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)

class BaseIntegration(ABC, Generic[T]):
    def __init__(self, url: str, api_key: str):
        self.url = url.rstrip("/")
        self.api_key = api_key
        self._client: httpx.AsyncClient | None = None

    @abstractmethod
    async def test_connection(self) -> bool:
        """Verify service is reachable and credentials valid."""
        pass

    @abstractmethod
    async def fetch_data(self, **kwargs) -> list[T]:
        """Fetch data from service with optional filters."""
        pass

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        """Common request handler with retry and error handling."""
        pass
```

### Error Handling Strategy

1. **External Service Errors**: Retry with exponential backoff (max 3 attempts)
2. **Validation Errors**: Return 422 with detailed field errors
3. **Generation Errors**: Log step, mark history as failed, continue to next step if possible
4. **Template Errors**: Fail fast with line number and variable name

### SSE Event Format

```typescript
interface ProgressEvent {
  type: "step_start" | "step_complete" | "step_error" | "generation_complete" | "generation_cancelled";
  step: string;
  progress: number;  // 0-100
  message: string;
  data?: Record<string, unknown>;
  timestamp: string;  // ISO 8601
}
```

## Security Considerations

1. **API Keys**: Encrypted at rest, never logged, masked in UI
2. **CORS**: Restricted to same-origin in production
3. **Input Validation**: All endpoints validated via Pydantic
4. **Template Sandbox**: Jinja2 sandbox mode to prevent arbitrary code execution
5. **Rate Limiting**: Not required for single-user, but endpoint structure allows future addition

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cold start | <5s | Docker container to first request |
| API response | <200ms | p95 for CRUD operations |
| SSE latency | <1s | Progress event to UI update |
| Generation time | <30s | Full newsletter with all sources |
| Memory usage | <256MB | Typical runtime |

## Open Questions (None)

All technical decisions resolved. Ready for Phase 1.
