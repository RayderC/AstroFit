# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server at http://localhost:7090
npm run build      # Production build
npm start          # Start production server at http://localhost:7090
npm run typecheck  # TypeScript check without emitting
npm run lint       # ESLint
```

**Docker:**
```bash
# Build (must have .dockerignore — without it, Windows node_modules corrupt the Linux binary)
docker build -t rayderc/astrofit:latest .

# Run with named volume (bind mounts break SQLite WAL locking on Windows)
docker run -d --name astrofit -p 7090:7090 -v astrofit_data:/config --restart unless-stopped rayderc/astrofit:latest
```

## Architecture

### Hybrid Next.js Router

This app uses **two Next.js routers simultaneously**:
- `app/` — App Router for all UI pages (all `"use client"` components; no server components do data fetching)
- `pages/api/` — Pages Router exclusively for API routes

There is no middleware. Auth is enforced client-side: `app/dashboard/layout.tsx` calls `/api/me` on mount and redirects to `/login` on 401. The login page checks `/api/setup` and redirects to `/setup` if no users exist yet.

### Database (`lib/db.ts`)

Single module that opens the SQLite database and runs schema migrations on import. There is no separate init call — importing the module is sufficient. The module also seeds 80+ built-in exercises on first run.

Key schema notes:
- `cardio_activities` uses `started_at` (not `created_at`) for its timestamp column
- `personal_records` has `UNIQUE(user_id, exercise_id)` — one PR record per exercise, updated via `ON CONFLICT DO UPDATE`
- `challenges.target_type` valid values: `workout_count`, `cardio_km`, `cardio_count`, `volume_kg`, `pr_count`
- `challenges.type` values: `weekly_auto` (system-generated), `special` (admin-created)

Database path: `process.env.DATABASE_PATH || path.join(process.cwd(), "astrofit.db")`. Docker sets it to `/config/astrofit.db`.

### Auth (`lib/session.ts`)

iron-session with cookie name `astrofit_session`. In dev (`NODE_ENV !== 'production'`), uses a hardcoded placeholder secret. In production, requires `SESSION_SECRET` env var ≥ 32 chars — throws at module load if missing. Docker auto-generates this via `docker-entrypoint.sh`.

### CSRF (`lib/csrf.ts`)

`checkCsrf(req)` compares the `origin` header host to the `host` header. Called in all mutating API routes except `/api/setup` and `/api/login` (public endpoints). If no `origin` header is present, the request is allowed through.

### XP System (`lib/xp.ts`)

Level formula: XP needed for level n = cumulative sum of `100 + 75*(k-1)` for k=1..n-1. Awards: 50 XP base per workout + 2 per completed set; 30 base + 5/km for cardio; 25 bonus for PRs. `awardXp()` in `lib/db.ts` writes an `xp_events` row and updates `users.xp` and `users.level` atomically.

### Weekly Challenges

`ensureWeeklyChallenges()` in `lib/db.ts` is called from `/api/challenges` on GET. It generates 3 challenges per week (strength, cardio, rotating wildcard) if they don't exist yet. Challenge progress is updated inline in the cardio and workout completion API routes via a local `updateChallengeProgress()` function.

### API Conventions

- All API routes use `getIronSession(req, res, sessionOptions)` from iron-session to read the session
- Dynamic route params are read via `req.query` (Pages Router style), not `useParams`
- `useParams<{ id: string }>()` is used in App Router pages for dynamic segments like `[id]`
- `/api/me` returns camelCase: `streakDays`, `isAdmin`, `createdAt`, `xpProgress: { current, needed, level }`
- `/api/dashboard/stats` returns: `workoutsThisWeek`, `volumeThisWeek`, `cardioKmThisWeek`, `xpThisWeek`, `totalWorkouts`, `totalCardio`, `totalVolumeKg`

### CSS

Single global stylesheet at `app/globals.css`. Cyberpunk dark theme with CSS variables (`--primary`, `--surface`, `--border`, `--text-muted`, `--danger`, etc.). Button classes `btn-primary`, `btn-secondary`, `btn-danger`, `btn-success` work standalone without a `btn` base class.

## Docker Build Notes

**Critical:** Always have `.dockerignore` excluding `node_modules` before building. Without it, `COPY . .` in the builder stage overwrites the Linux-compiled `better_sqlite3.node` with the Windows DLL from the local `node_modules`, causing `ERR_DLOPEN_FAILED: invalid ELF header` at runtime.

**Named volumes only:** SQLite WAL mode does not work on Windows bind mounts (Docker Desktop uses 9P/virtio-9p which doesn't support the required file locking). Always use `-v astrofit_data:/config`, never `-v C:\...\config:/config`.
