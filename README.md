# Useful Time

A weekly time-allocation planner for knowledge workers. Visualizes how your work hours break down across meetings, project work, overhead, and ad-hoc tasks. Helps detect overcommitment before it happens.

## Features

- **Weekly view** — Stacked area chart showing how each day's hours are allocated across categories
- **Daily view** — Donut chart breakdown of a single day's time
- **Focus projects** — Select up to 3 projects per week; auto-suggest assigns them to days based on urgency and available time
- **Overcommit detection** — Alerts for overloaded weeks, meeting creep, low focus time, and approaching deadlines
- **Calendar import** — Import `.ics` files to pull meetings into your plan
- **Settings** — Configure work hours, overhead, ad-hoc budgets, and meeting buffers
- **Export** — Share your weekly chart as an image

## Tech Stack

- **Frontend:** Vue 3 (Composition API, `<script setup>`), TypeScript (strict mode), Vite
- **Charts:** D3.js (stacked area for weekly view, donut for daily view)
- **Routing:** vue-router 5
- **Testing:** Vitest (unit), Playwright (E2E)
- **Package Manager:** pnpm

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173).

## Development

```bash
pnpm dev          # Start Vite dev server
pnpm build        # Type-check and build for production
pnpm preview      # Preview production build
```

## Testing

```bash
pnpm test         # Run Vitest unit tests
pnpm test:watch   # Run Vitest in watch mode
pnpm test:e2e     # Run Playwright E2E tests
```

For E2E tests, install browsers first:

```bash
pnpm exec playwright install
```

## CLI Scripts

A set of CLI scripts for managing data outside the browser. All output JSON to stdout. Run with `npx tsx`.

```bash
# Add a project
npx tsx scripts/add-project.ts --name "Project Alpha" --start 2026-03-14 --end 2026-06-14

# Get weekly stats
npx tsx scripts/get-weekly-stats.ts --week 2026-03-09

# Import calendar
npx tsx scripts/import-calendar.ts --file ~/calendar.ics

# Set focus projects for a week
npx tsx scripts/set-focus.ts --week 2026-03-09 --projects proj-id-1,proj-id-2

# Check for overcommitment
npx tsx scripts/check-overcommit.ts --week 2026-03-09
```

## License

MIT
