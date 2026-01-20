# Prompt pour `.specify/constitution.md`

Crée le fichier `.specify/constitution.md` avec le contenu suivant :

---

```markdown
# Ghostarr Constitution

## Core Principles

### I. Service-Oriented Architecture
L'application est structurée en services découplés communiquant via API REST. Le backend FastAPI expose des endpoints versionnés (`/api/v1/`), le frontend React consomme ces APIs. Chaque intégration externe (Tautulli, ROMM, Ghost, etc.) est encapsulée dans un connecteur indépendant et testable. Les services sont containerisés via Docker pour garantir la portabilité.

### II. Type Safety First
TypeScript strict côté frontend (pas de `any`), type hints obligatoires côté Python. Validation des données entrantes via Pydantic (backend) et Zod (frontend). Les schémas API sont la source de vérité partagée. Les clés i18n sont typées pour éviter les erreurs de traduction.

### III. Progressive Enhancement
L'interface fonctionne d'abord sur mobile (mobile-first), puis s'enrichit pour tablette et desktop. Les fonctionnalités critiques restent accessibles sans JavaScript avancé. Le thème (light/dark) et la langue sont détectés automatiquement puis personnalisables. Les notifications dégradent gracieusement si SSE indisponible.

### IV. Observability & Feedback
Chaque action utilisateur produit un feedback visuel immédiat (toast, loader, progression). Les opérations longues (génération newsletter) reportent leur progression en temps réel via SSE avec états granulaires. Tous les événements sont loggés avec correlation ID pour traçabilité. L'historique conserve les détails de chaque étape pour diagnostic.

### V. Configuration over Code
Les paramètres des services externes, les préférences utilisateur (thème, langue, timezone), et les options de génération sont stockés en base de données et modifiables via l'UI. Les variables d'environnement Docker configurent l'infrastructure, pas le comportement métier. Les templates de newsletter sont des fichiers éditables sans recompilation.

### VI. Extensibility by Design
Nouvelles langues : ajouter un dossier de traductions JSON. Nouveaux services : implémenter l'interface `BaseIntegration`. Nouveaux templates : déposer dans le volume `/templates`. La structure modulaire permet d'étendre sans modifier le code existant.

## Technology Stack

### Backend
- **Runtime**: Python 3.11+ avec FastAPI
- **Database**: SQLite + SQLAlchemy ORM + Alembic migrations
- **Scheduling**: APScheduler pour tâches CRON
- **Validation**: Pydantic v2
- **HTTP Client**: httpx (async)
- **Templating**: Jinja2 pour newsletters

### Frontend
- **Framework**: React 18+ avec TypeScript strict
- **Build**: Vite
- **UI**: shadcn/ui + Tailwind CSS
- **State**: TanStack Query + Zustand
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod
- **i18n**: i18next + react-i18next
- **Icons**: Lucide React

### Infrastructure
- **Containers**: Docker + Docker Compose
- **Proxy**: Compatible Traefik/Caddy
- **Volumes**: data/, templates/, logs/, locales/

## Architecture

```
ghostarr/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic/
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── api/v1/
│       │   ├── router.py
│       │   ├── newsletters.py
│       │   ├── templates.py
│       │   ├── schedules.py
│       │   ├── history.py
│       │   ├── settings.py
│       │   └── logs.py
│       ├── models/
│       ├── schemas/
│       ├── services/
│       │   ├── newsletter_generator.py
│       │   ├── scheduler_service.py
│       │   └── progress_tracker.py
│       ├── integrations/
│       │   ├── base.py
│       │   ├── tautulli.py
│       │   ├── tmdb.py
│       │   ├── romm.py
│       │   ├── audiobookshelf.py
│       │   ├── komga.py
│       │   ├── tunarr.py
│       │   └── ghost.py
│       └── core/
│           ├── exceptions.py
│           ├── logging.py
│           └── events.py
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       ├── components/
│       │   ├── ui/
│       │   ├── layout/
│       │   ├── dashboard/
│       │   └── common/
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── History.tsx
│       │   ├── Templates.tsx
│       │   ├── Settings.tsx
│       │   └── Help.tsx
│       ├── hooks/
│       ├── stores/
│       ├── i18n/
│       │   ├── index.ts
│       │   └── locales/{fr,en,de,it,es}/
│       └── themes/
└── templates/
```

## Naming Conventions

### Backend (Python)
- Classes: `PascalCase` (NewsletterGenerator)
- Functions: `snake_case` (generate_newsletter)
- Constants: `SCREAMING_SNAKE_CASE` (MAX_RETRY_COUNT)
- Files: `snake_case.py`

### Frontend (TypeScript)
- Components: `PascalCase.tsx` (ManualGeneration.tsx)
- Hooks: `useCamelCase.ts` (useProgress.ts)
- Types: `PascalCase` (NewsletterConfig)
- Utils: `camelCase.ts`

### API & Database
- Endpoints: `/api/v1/{resources}` (plural, kebab-case actions)
- Tables: `snake_case_plural` (newsletter_templates)
- Columns: `snake_case` (created_at)

## Internationalization

### Supported Languages
- 🇫🇷 Français (fr) - Default
- 🇬🇧 English (en)
- 🇩🇪 Deutsch (de)
- 🇮🇹 Italiano (it)
- 🇪🇸 Español (es)

### Adding a Language
1. Create folder: `/src/i18n/locales/{code}/`
2. Copy JSON files from existing language
3. Translate all values
4. Register in i18n config

### Structure
```
locales/{code}/
├── common.json      # Shared UI elements
├── dashboard.json   # Dashboard page
├── templates.json   # Templates page
├── history.json     # History page
├── settings.json    # Settings page
├── help.json        # Help page
└── errors.json      # Error messages
```

## Theming

### Modes
- ☀️ Light
- 🌙 Dark
- 🖥️ System (auto-detect OS preference)

### Implementation
- CSS variables with `--color-` prefix in `index.css`
- Tailwind `dark:` classes for component variants
- Theme class on `<html>` element
- Persistence: localStorage + database sync
- Smooth 200ms transitions

## Quality Standards

### Code Quality
- ESLint + Prettier (frontend)
- Ruff + Black (backend)
- No `any` types in TypeScript
- Type hints on all Python functions
- Docstrings Google style

### Testing
- Backend: Pytest, 70%+ coverage, mock external services
- Frontend: Vitest + React Testing Library
- Integration tests for each connector

### Error Handling
- Custom typed exceptions (backend)
- Error Boundaries with fallback UI (frontend)
- Structured logging with correlation ID
- Retry with exponential backoff for external APIs

## Docker Configuration

### Environment Variables
```env
# Application
APP_ENV=production
APP_SECRET_KEY=
APP_TIMEZONE=Europe/Paris

# Frontend defaults
VITE_API_URL=http://localhost:8000
VITE_DEFAULT_LANGUAGE=fr
VITE_DEFAULT_THEME=system

# Services
TAUTULLI_URL=
TAUTULLI_API_KEY=
TMDB_API_KEY=
ROMM_URL=
GHOST_URL=
GHOST_ADMIN_API_KEY=
# ... other services
```

### Volumes
- `./data:/app/data` - SQLite database
- `./templates:/app/templates` - Custom newsletter templates
- `./logs:/app/logs` - Persistent logs
- `./locales:/app/locales:ro` - Custom translations (optional)

### Ports
- Frontend: 3000
- Backend: 8000

## Governance

Cette constitution définit les fondations architecturales et techniques de Ghostarr. Toute modification doit :
1. Être documentée avec justification
2. Maintenir la compatibilité avec les principes fondamentaux
3. Préserver l'extensibilité et la maintenabilité
4. Être reflétée dans les tests et la documentation

Les principes I à VI sont non-négociables. Les choix technologiques peuvent évoluer si les principes sont respectés.

**Version**: 1.0.0 | **Ratified**: 2025-01-20 | **Last Amended**: 2025-01-20
```

---

**Instructions**: Copie ce contenu markdown (entre les balises ```) dans `.specify/constitution.md` via Claude Code ou manuellement.