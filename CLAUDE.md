# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # http://localhost:7090
npm run build
npm run typecheck
docker build -t rayderc/astrofit:latest .
docker rm -f astrofit; docker run -d --name astrofit -p 7090:7090 -v astrofit_data:/config --restart unless-stopped rayderc/astrofit:latest
```

## Architecture

Hybrid Next.js router: `app/` (App Router, all UI, all `"use client"`) + `pages/api/` (Pages Router, all API routes). No middleware — auth is enforced client-side via `/api/me` in `app/dashboard/layout.tsx`.

`lib/db.ts` opens SQLite and runs migrations on import. Key schema: `cardio_activities.started_at` (not `created_at`); `personal_records` has `UNIQUE(user_id, exercise_id)` with `ON CONFLICT DO UPDATE`; `challenges.type` is `weekly_auto` or `special`.

iron-session (`lib/session.ts`), cookie `astrofit_session`. Production requires `SESSION_SECRET` ≥ 32 chars. CSRF (`lib/csrf.ts`) checks `origin` vs `host` on all mutating routes except `/api/setup` and `/api/login`.

XP: 50 base + 2/set per workout; 30 base + 5/km for cardio; 25 bonus for PRs.

## Workout Session (`app/dashboard/workout/[id]/page.tsx`)

Active session page. Key behaviours to keep in mind:

- **Timestamp parsing** — SQLite `datetime('now')` returns UTC without a `Z` (e.g. `"2024-01-15 10:30:00"`). Always parse as `new Date(raw.replace(" ","T")+"Z")` or the elapsed timer goes negative for users behind UTC.
- **Elapsed timer** — Pause-aware via `isPausedRef` + `pauseOffsetRef`. Elapsed = `floor((now − startMs)/1000) − pauseOffset`. The ref approach avoids stale-closure issues inside the interval.
- **Rest timer** — Compact fixed bottom bar (`.rest-timer-bar`), not a full-screen overlay. `restDuration` state drives the default; ±15 s buttons in the bar adjust both the live countdown and the default for future sets.
- **Set inputs** — `type="number"` with `onKeyDown` guards filtering `e E + −` (weight) and also `.` (reps). `inputMode="decimal"` / `"numeric"` for correct mobile keyboards.
- **Delete set** — `DELETE /api/workouts/[id]/sets/[setId]` alongside PATCH in `pages/api/workouts/[id]/sets/[setId].ts`.
- **Finish workout** — Wrapped in try/catch; timers stop before the fetch. On success `completionData` is set and the completion card renders; user navigates away manually.

## Units System

Default units are **lb** (weight) and **mi** (distance). User preference is stored in `localStorage` keys `astrofit_weight_unit` and `astrofit_distance_unit`. The context provider lives in `app/context/UnitsContext.tsx` and wraps the entire dashboard via `app/dashboard/layout.tsx`. Toggle is at `/dashboard/settings`.

The DB stores raw numbers — no server-side unit conversion. GPS tracking (`cardio/track`) computes distance via haversine (always km internally) then converts to miles for display and saves in the user's preferred unit. All measurement labels are dynamic from `useUnits()`.

## Design System

Cyberpunk dark theme in `app/globals.css`, consistent with Amethyst/ComicOrbit/SkyBit. Body uses system fonts (`-apple-system, Segoe UI, Roboto`). `var(--font-mono)` (JetBrains Mono) applies only to nav labels, badges, stat values, form labels, `.sidebar-logo` — never body text. Auth/modal cards use `overflow: hidden` with brackets 10px inside (cyan top-left, magenta bottom-right). Sidebar active state uses `box-shadow: inset 2px 0 0 var(--accent-cyan)`, not `border-left`. Page titles use chromatic `text-shadow`, not animated gradient. No logo image — text-only branding.

Mobile breakpoints: 900px (sidebar collapses to drawer, padding reduces), 640px (inputs get `font-size: 16px` to prevent iOS zoom, modals become bottom sheets, progress grid stacks). Uses `env(safe-area-inset-bottom)` for notch padding.

Key CSS classes: `.progress-grid` (220px 1fr, stacks at 640px), `.settings-row`, `.unit-toggle`, `.unit-btn`.

## Docker

`.dockerignore` must exclude `node_modules` or the Windows DLL corrupts the Linux SQLite binary. Use named volumes only (`-v astrofit_data:/config`) — WAL locking breaks on Windows bind mounts.
