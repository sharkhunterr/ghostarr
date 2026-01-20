# GitHub Releases - Ghostarr

> Copier-coller directement le contenu de chaque release dans GitHub

---

# v0.2.0

**Title:** `v0.2.0 - UI Redesign & Bug Fixes`

**Release Notes (copier ci-dessous):**

---

## What's New in v0.2.0

### UI/UX Improvements

#### Complete UI Redesign
- New sidebar navigation with icons and text labels
- Responsive design with collapsible sidebar on mobile
- Top navbar with page title display
- Theme and language toggles integrated in sidebar (desktop) / topnav (mobile)
- Full-width content layout that adapts to all screen sizes

#### New Color Palette
- Modern blue-toned color scheme for both light and dark modes
- Dark mode: Deep blue backgrounds (#0f172a) instead of pure black
- Light mode: Soft blue-gray tones for better readability
- Improved contrast and visual hierarchy

#### Page Structure Changes
- **Dashboard split into two dedicated pages:**
  - **Manual Generation** - For on-demand newsletter generation
  - **Scheduled Generation** - For managing automatic schedules
- All pages now use full-width responsive grids (sm/md/lg/xl/2xl breakpoints)

### Bug Fixes

#### Ghost Integration
- **Fixed empty newsletter content** - Ghost now displays HTML content correctly using MobileDoc format conversion

#### TMDB Integration
- **Fixed 401 Unauthorized errors** - Now supports both API Read Access Token (Bearer) and legacy API Key authentication
- **URL field no longer required** - Uses default TMDB API URL automatically

#### Tautulli Integration
- **Fixed metadata extraction** - Improved handling of nested metadata structure for accurate title, year, and summary retrieval
- **Fixed statistics comparison** - "Include comparison" checkbox now works correctly, fetching previous period data and calculating growth percentages
- **Fixed statistics data parsing** - Added safe type conversion for all Tautulli API responses (API returns strings instead of integers)

#### Template Service
- **Fixed image proxy URLs** - Corrected path handling for proxied TMDB images in newsletters

#### Settings
- **Improved service configuration** - TMDB URL field now optional with placeholder guidance

### Technical Improvements
- Added sidebar color variables to Tailwind config
- Added success and warning color definitions
- Removed test configuration from Vite config (was causing TypeScript errors)
- Improved i18n translations for new navigation items (EN/FR)

---

# v0.1.0

**Title:** `v0.1.0 - Initial Release`

**Release Notes (copier ci-dessous):**

---

## What's New in v0.1.0

### Initial Release
- Ghostarr - AI Homelab Gateway with MCP server and web administration
- Initial project setup

---

# Instructions

1. Aller sur https://github.com/sharkhunterr/ghostarr/releases/new
2. **Tag**: Correspond au tag de version
3. **Target**: `main`
4. **Title**: Copier le titre de la version concernee
5. **Description**: Copier tout depuis `## What's New` jusqu'a `**Full Changelog**` inclus
6. **Publish release**

> Le script `npm run release:full` prend automatiquement la PREMIERE section de version (celle du haut)
