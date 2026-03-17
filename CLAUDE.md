# Useful Time

A weekly time-allocation planner for knowledge workers. Visualizes how your work hours break down across meetings, project work, overhead, and ad-hoc tasks. Helps detect overcommitment before it happens.

## Tech Stack

- **Frontend:** Vue 3 (Composition API, `<script setup>`), TypeScript (strict mode), Vite
- **Charts:** D3.js (stacked area for weekly view, donut for daily view)
- **Routing:** vue-router 5
- **Testing:** Vitest (unit), Playwright (E2E)
- **Package Manager:** pnpm

## Project Structure

```
src/
  types/index.ts       # All shared types and constants
  utils/               # Pure utility functions (timemath, icsParser)
  composables/         # Vue composables (useStorage, etc.)
  components/          # Reusable Vue components
    layout/            # Layout components (shell, nav)
  views/               # Route-level views (WeekView, DayView, SettingsView)
  router/index.ts      # Vue Router configuration
  assets/              # CSS (main.css, tokens.css)
  App.vue              # Root component
  main.ts              # App entry point

scripts/               # CLI agent scripts (run with npx tsx)
  lib/data.ts          # Shared data read/write for JSON file
  add-project.ts       # Add a new project
  get-weekly-stats.ts  # Get weekly statistics
  import-calendar.ts   # Import .ics calendar file
  set-focus.ts         # Set focus projects for a week
  check-overcommit.ts  # Check for overcommitment

data/                  # CLI data storage
  useful-time.json     # App data file (created by scripts)

tests/e2e/             # Playwright E2E tests
```

## CLI Scripts

All scripts output JSON to stdout and errors to stderr. Run with `npx tsx`.

### Add a project

```bash
npx tsx scripts/add-project.ts --name "Project Alpha" --start 2026-03-14 --end 2026-06-14
npx tsx scripts/add-project.ts --name "Project Beta" --start 2026-04-01 --end 2026-07-01 --color "#c8b8f4"
```

### Get weekly stats

```bash
npx tsx scripts/get-weekly-stats.ts
npx tsx scripts/get-weekly-stats.ts --week 2026-03-09
```

### Import calendar (.ics)

```bash
npx tsx scripts/import-calendar.ts --file ~/calendar.ics
npx tsx scripts/import-calendar.ts --file ~/calendar.ics --week 2026-03-09
```

### Set focus projects for a week

```bash
npx tsx scripts/set-focus.ts --week 2026-03-09 --projects proj-id-1,proj-id-2
```

### Check overcommitment

```bash
npx tsx scripts/check-overcommit.ts
npx tsx scripts/check-overcommit.ts --week 2026-03-09
```

## Development Commands

```bash
pnpm dev          # Start Vite dev server (http://localhost:5173)
pnpm build        # Type-check and build for production
pnpm preview      # Preview production build
```

## Testing Commands

```bash
pnpm test         # Run Vitest unit tests
pnpm test:watch   # Run Vitest in watch mode
pnpm test:e2e     # Run Playwright E2E tests
```

Playwright auto-starts the Vite dev server via webServer config. To install browsers:

```bash
pnpm exec playwright install
```

## Conventions

- **Package manager:** Always use `pnpm`, never npm or yarn
- **Components:** Vue 3 Composition API with `<script setup lang="ts">`
- **Styling:** Design tokens defined in `src/assets/tokens.css`; use CSS custom properties
- **TypeScript:** Strict mode enabled; all types live in `src/types/index.ts`
- **Data flow:**
  - **Browser:** localStorage via `useStorage` composable
  - **CLI scripts:** `data/useful-time.json` via `scripts/lib/data.ts`
- **Colors:** Use `PROJECT_PALETTE` for auto-assigning project colors; `CATEGORY_COLORS` for meeting/overhead/ad-hoc/project categories
- **Time granularity:** 15-minute increments (0.25h); round to nearest quarter hour
