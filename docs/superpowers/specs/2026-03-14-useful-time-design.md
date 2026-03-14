# Useful Time — Design Specification

## Overview

A web-based time management tool for developers who juggle multiple projects, meetings, and ad-hoc work. It visualizes how time is actually spent vs. how it should be spent, with interactive charts for direct manipulation and aggressive overcommitment protection.

**Primary user:** Developer with variable meeting load (often heavy), 8h work days, managing 2-3 focus projects per week across a larger portfolio of active projects. Shares weekly time allocation with manager/team via image export.

## Core Concept

Time is divided into four stacking categories, visualized as a stacked area chart (weekly) or donut (daily):

1. **Meetings** — imported from Outlook via .ics files, each with +15min buffer before and after
2. **Overhead** — lunch, breaks, coffee, admin (configurable daily defaults)
3. **Ad-hoc Dev** — bug fixes, teammate requests (budgeted upfront per day)
4. **Project Time** — what remains after the above; assigned to 2-3 focus projects

**Key formula:** `Available Project Time = 8h - overhead - ad_hoc_budget - (meeting_hours + buffer_hours)`

## Data Model

### Core Entities

```typescript
interface Project {
  id: string
  name: string
  color: string           // from project palette (see Design System)
  startDate: string       // ISO date
  endDate: string         // ISO date
  status: 'active' | 'paused' | 'completed'
  tasks: Task[]
}

interface Task {
  id: string
  name: string
  estimatedHours: number
  status: 'todo' | 'in_progress' | 'done'
}

interface WeekPlan {
  weekStart: string       // ISO date (Monday)
  focusProjects: string[] // project IDs, max 3 (enforced at write time)
  dailyAllocations: DayAllocation[]
}
// Validation: focusProjects.length is capped at 3 in useWeekPlan.
// On JSON import, excess entries are truncated to first 3 with a warning shown to user.

interface DayAllocation {
  date: string
  meetings: Meeting[]     // from .ics import
  overhead: number        // hours (initialized from DayDefaults, overridable per day)
  adHocBudget: number     // hours (initialized from DayDefaults, overridable per day)
  projectAllocations: { projectId: string; hours: number }[]
}
// When a new WeekPlan is created, each DayAllocation is initialized with values from
// DayDefaults. The user can then override overhead and adHocBudget per day via drag
// interactions or the day view. Per-day overrides persist; defaults only apply to new weeks.

interface Meeting {
  id: string              // maps to VEVENT UID from .ics to prevent duplicate imports
  title: string
  start: string           // ISO datetime
  end: string             // ISO datetime
  bufferBefore: number    // hours (default 0.25)
  bufferAfter: number     // hours (default 0.25)
}
// Buffer merging: when meetings are back-to-back or overlapping, adjacent buffers
// are merged (not double-counted). E.g., meeting A ends 10:30, meeting B starts 10:30 →
// A's bufferAfter and B's bufferBefore collapse into a single 15min gap.
// Buffers that extend outside working hours (before workday start or after workday end)
// are clipped to the workday boundary — they don't count toward time calculations.
// timemath.ts owns all pure time arithmetic: buffer merging, interval math, the key
// formula calculation. useTimeCalculator.ts is a Vue composable that wraps timemath.ts
// with reactivity — it watches meetings/overhead/adHoc and exposes computed available time.
// Rule: timemath.ts has zero Vue dependencies; useTimeCalculator.ts has zero D3 dependencies.

interface DayDefaults {
  workHours: number       // default 8
  workdayStart: string    // default "09:00" (used by meeting timeline)
  overhead: number        // default 1.5
  adHocBudget: number     // default 1.5
  meetingBuffer: number   // default 0.25 (15min each side)
}
```

## Views

### Weekly View (Main)

- **Stacked area chart** spanning Mon-Fri as the primary interface
- Layers from bottom: Meetings (red), Overhead (orange), Ad-hoc (blue), Project Time (green)
- **Side panel** shows: focus projects with assigned days, weekly summary stats, overcommitment warnings
- **Interactions:**
  - Hover: tooltip with full day breakdown
  - Drag boundary lines: reallocate between ad-hoc and project time
  - Click green (project) area: popover to assign block to a specific focus project
  - Drag handles appear on hover (white circle on boundary lines)
- **Drag constraints:** Total must equal workHours (8h). Meetings layer is read-only (from calendar). Overhead minimum: 0.5h. Ad-hoc minimum: 0h. Project time minimum: 0h (but triggers overcommitment warning). Dragging snaps to 15-minute increments. When total project time shrinks, project allocations reduce proportionally (e.g., 2 projects at 2h each → total drops to 2h → each becomes 1h). Proportional reduction rounds to nearest 15min; rounding residual (±15min max) is assigned to the highest-priority project to keep the total exact.
- Navigation: week picker with arrows, Week/Day view toggle
- Share button: exports chart as PNG image

### Day View

- **Donut chart** showing the four time categories with hours
  - Center displays available project time
  - Overhead and Ad-hoc segments are draggable to resize (same constraints as weekly view: overhead min 0.5h, ad-hoc min 0h, snap to 15min). Meeting segment is read-only.
  - Project time segment subdivided by assigned focus project color
- **Meeting timeline** below donut: horizontal bar showing meetings and their buffers across 9am-5pm
- Breakdown list next to donut with exact hours per category

### Settings/Projects View

- **Project CRUD:** create/edit/delete projects with name, color, date range, tasks
- **Task management:** simple checklist within each project with hour estimates
- **Day defaults:** configure work hours, overhead, ad-hoc budget, buffer duration
- **Import/Export:**
  - Import .ics files from Outlook (malformed events are skipped with a warning toast showing count of skipped entries; events outside the current week are stored for their respective weeks; duplicate UIDs update existing meetings rather than creating duplicates)
  - Export all data as JSON (download as file)
  - Import data from JSON (validates against current schema; rejects with error message on invalid structure; valid data replaces all localStorage contents)

## Intelligence Layer (Aggressive Mode)

### Focus Project Selection

- Select up to 3 projects per week; adding a 4th is **blocked** with a dialog requiring replace or delay
- **Priority scoring:** `urgency = remainingHours / max(daysUntilDeadline, 1)`. `remainingHours = sum of estimatedHours for tasks where status != 'done'`. Higher urgency = higher priority. Ties broken by earlier deadline. Projects past deadline (`daysUntilDeadline <= 0`) get `urgency = Infinity` and are always suggested first, sorted among themselves by how overdue they are. This produces a single sorted list.
- Auto-suggest day assignments: highest-priority project picks first from days with most available project time, then next project picks from remaining days. Each project gets at least 1 day; remaining days distributed to highest-priority project. Exception: if a project has <1h remaining work, it gets 1 day only (no extra days), and surplus days shift to the next project.

### Overcommitment Detection

Four levels, triggered automatically:

1. **Blocking** — 4th focus project attempted → must replace or delay
2. **Warning** — estimated remaining work exceeds available hours this week → "You'll need 2-3 more weeks at current pace"
3. **Suggestion** — deadline at risk → concrete fix proposals (drop another focus, reduce ad-hoc budget)
4. **Healthy** — green status indicator, no noise

### Aggressive Protection Features

- **Meeting creep alert:** if meetings increase >20% vs. previous week, prominent warning. Suppressed when no previous week data exists (first week of use). Compares against 0h if previous week had no imported meetings.
- **Focus time defender:** any day with <2h project time flagged red; suggests blocking morning for project work
- **Deadline countdown:** project in final week with >50% tasks remaining → urgent mode with daily progress check and pacing suggestions

## Technical Architecture

### Stack

- **Vite** + **Vue 3** (Composition API, `<script setup>`)
- **TypeScript** throughout
- **D3.js** for interactive SVG charts (stacked area, donut)
- **Vue Router** for view navigation (deep linking: `/week/2026-03-09`, `/day/2026-03-11`, `/settings`; `/` redirects to current week's weekly view)
- **Vitest** for unit tests
- **Playwright** for E2E tests

### Design System

- Global CSS custom properties in `src/assets/tokens.css`
- Light beige background (`#faf6f0`) with pastel accents
- Category colors: meetings red (`#f4a4a4`), overhead orange (`#f4d4a4`), ad-hoc blue (`#a4c8f4`), project green (`#b8e6c8`)
- Project palette (8 colors, cycles if >8 projects): `#b8e6c8`, `#c8b8f4`, `#f4c8d4`, `#c8e0f4`, `#e0d4a4`, `#d4c8e8`, `#a4d8d8`, `#e8c8a4`
- Minimal global styles; components use scoped styles referencing tokens
- Typography: system font stack, clean and minimal

### File Structure

```
src/
├── assets/tokens.css           # Design tokens
├── composables/                # Business logic (atomic)
│   ├── useProjects.ts          # CRUD + validation
│   ├── useWeekPlan.ts          # Focus selection + allocation
│   ├── useTimeCalculator.ts    # Available time math
│   ├── useCalendarImport.ts    # .ics parsing
│   ├── useOvercommit.ts        # Detection + suggestions
│   ├── useAutoSuggest.ts       # Day assignment suggestions
│   └── useStorage.ts           # LocalStorage abstraction
├── components/
│   ├── charts/                 # D3-powered interactive charts
│   │   ├── StackedAreaChart.vue
│   │   ├── DonutChart.vue
│   │   └── MeetingTimeline.vue
│   ├── layout/                 # App shell
│   │   ├── AppHeader.vue
│   │   ├── SidePanel.vue
│   │   └── ViewToggle.vue
│   ├── projects/               # Project management
│   │   ├── ProjectCard.vue
│   │   ├── ProjectForm.vue
│   │   ├── TaskList.vue
│   │   └── FocusSelector.vue
│   └── alerts/                 # Overcommitment UI
│       ├── OvercommitWarning.vue
│       └── SuggestionCard.vue
├── views/
│   ├── WeekView.vue
│   ├── DayView.vue
│   └── SettingsView.vue
├── types/index.ts
├── utils/
│   ├── icsParser.ts
│   ├── timemath.ts
│   └── imageExport.ts
├── App.vue
└── main.ts
```

### Data Layer

`StorageAdapter` interface abstracts persistence:

```typescript
interface StorageAdapter {
  get<T>(key: string): T | null
  set<T>(key: string, value: T): void
  exportAll(): string
  importAll(json: string): void  // throws on invalid JSON/schema
}
```

- v1: `LocalStorageAdapter` implementation
- Future: `FirebaseAdapter` — same interface, swap implementation
- All composables receive the adapter via Vue's `provide`/`inject`

### Agent-Friendly Scripts

CLI scripts in `scripts/` that read/write `data/useful-time.json` (same shape as `StorageAdapter.exportAll()` output — a JSON object with keys: `projects`, `weekPlans`, `dayDefaults`):

```
get-weekly-stats.ts [--week YYYY-MM-DD]
  → stdout: { weekStart, focusProjects[], totalMeetingHours, totalProjectHours,
              totalAdHocHours, overcommitWarnings[], dailyBreakdown[] }
  → exit 0 on success, exit 1 if no data for requested week

add-project.ts --name NAME --start YYYY-MM-DD --end YYYY-MM-DD [--color HEX]
  → stdout: { id, name, startDate, endDate, color }
  → exit 1 if name is empty or dates invalid

import-calendar.ts --file PATH [--week YYYY-MM-DD]
  → stdout: { imported: N, skipped: N, updated: N }
  → exit 1 if file not found or unparseable

set-focus.ts --week YYYY-MM-DD --projects ID1,ID2[,ID3]
  → stdout: { weekStart, focusProjects[] }
  → exit 1 if >3 projects or unknown project IDs

check-overcommit.ts [--week YYYY-MM-DD]
  → stdout: { level: "healthy"|"warning"|"blocking", warnings[], suggestions[] }
  → exit 0 always (warnings are informational)
```

All scripts output JSON to stdout, errors to stderr.

**Data bridging:** The browser app uses localStorage exclusively. CLI scripts read/write `data/useful-time.json` directly. To sync between them:
- **Browser → file:** The app's "Export JSON" button downloads the full data as a JSON file. CLI scripts can also read from this exported file.
- **File → browser:** The app's "Import JSON" button loads data from a file (replacing localStorage contents).
- **CLI workflow:** Agent scripts operate on `data/useful-time.json`. After script changes, the user (or agent) refreshes the app and imports the updated JSON. This is intentionally simple — no filesystem access from the browser, no dev server middleware. Full bidirectional sync deferred to the Firebase adapter.
- **Shared types:** Both browser composables and CLI scripts import from `src/types/index.ts`, ensuring data shape consistency.

All documented in `CLAUDE.md` for AI agent discovery and use.

### Testing Strategy

- **Unit tests (Vitest):** composables and utils — time calculations, overcommit detection, ICS parsing, auto-suggest algorithm. TDD approach: write tests first.
- **E2E tests (Playwright):** chart interactions (drag boundaries, click-to-assign, donut resize), image export, import/export round-trip, overcommit blocking flow.

### Image Export

Uses `html-to-image` library (DOM → PNG via `toPng()`) which captures both SVG chart elements and surrounding HTML (side panel stats, legends). This avoids cross-origin canvas taint issues that affect raw SVG serialization. The export region is a wrapper `<div>` with a `data-export` attribute; the share button calls `toPng(exportElement)` and triggers a download. Both Weekly View (chart + side panel) and Day View (donut + breakdown) have export regions. PNG dimensions match the rendered viewport size.

## Design Principles

- **Desktop-first:** optimized for 1200px+ screens
- **Minimalist:** light beige with pastel accents, generous whitespace
- **Chart-centric:** the visualization IS the interface, not a read-only dashboard
- **Aggressive protection:** the tool actively pushes back when you're overcommitting
- **Agent-friendly:** data layer and scripts designed for AI agent integration
- **Firebase-ready:** storage abstraction makes backend swap straightforward
