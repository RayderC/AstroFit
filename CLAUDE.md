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

There is no test suite. Set `DATABASE_PATH` to a scratch file when running locally so you don't touch real data.

## Product rules

- Lifting and cardio are equal. One session holds both lift and cardio blocks.
- No gamification: no XP, levels, streaks or challenges.
- Logging follows the Strong app: Previous column, W/D/F set tags, per-exercise rest, supersets, sticky notes.

## Architecture

Next.js 16 App Router, one Docker container, SQLite. All UI is `"use client"` and fetches from `app/api/**/route.ts`.

- **Auth**: `proxy.ts` redirects signed-out page requests to `/login` server-side. API routes are excluded from it and check auth through `route()`.
- **API**: every handler except login and setup uses `route()` from `lib/api.ts`, which handles auth, the CSRF origin check, JSON parsing, errors and `{ admin: true }`. Throw `bad()`, `notFound()` or `HttpError` to return an error. Scope every query to `user.id`; the `own*` helpers in `lib/repo/sessions.ts` do this for sessions, blocks and sets.
- **Database**: `lib/db.ts` opens the DB on first use, never on import, because `next build` imports every route in parallel workers. Don't query it at module level. Schema changes go in as a new entry in its `MIGRATIONS` array (versioned with `PRAGMA user_version`), never by editing `SCHEMA_V1` in `lib/schema.ts`, which existing databases won't re-run. `seedLibrary` adds missing built-in exercises on every boot.
- **Client vs server code**: anything importing `lib/db.ts` is server-only. Pages can't import `lib/repo/*`, which is why `app/(app)/body/page.tsx` repeats the measurement list from `lib/repo/body.ts`. Shared shapes live in `lib/types.ts`, and `lib/exerciseSeed.ts` and `lib/units.ts` are safe on both sides.

## Units and time

This is the rule most likely to cause data bugs:

- **Stored**: always kg, meters and seconds, including tape measurements. Timestamps are ISO-8601 UTC with a `Z`.
- **Displayed**: convert only at display and input time with `lib/units.ts`. Units are per-user settings (`users.weight_unit`, `users.distance_unit`). Tape measurements show in inches or cm based on the distance unit.
- **Days and weeks**: "which day or week" depends on the viewer's zone, so pages pass an IANA `tz` and the server uses `lib/tz.ts`. `body_entries.date` is a bare `YYYY-MM-DD`; format it with `fmtDate` from `lib/client.ts`, which avoids showing the previous day west of UTC.

## Key modules

- `lib/repo/sessions.ts`: core logging, prefill from last time plus progression (`seedSets`), supersets, finish with summary and records. Finishing deletes unfinished sets and empty blocks, so history only holds `done = 1` rows.
- `lib/progression.ts`: `suggest()` compares the last session's sets at top weight to the rep range. `increase` needs every one of them at the top.
- `lib/builder.ts`: rule-based generator. Days/week picks the split (2-3 full body, 4 upper/lower, 5 PPL+UL, 6 PPL×2), exercises come from movement pattern + equipment, leaning toward what the user already does.
- `lib/stats.ts`, `lib/progress.ts`: exercise detail/records, muscle sets, Progress page data. Warm-ups don't count toward volume or records.
- `lib/strong.ts` is the pure CSV parser; `lib/repo/strongImport.ts` does matching and writes. Dedupe key is `sessions.source = 'strong'` + `source_key` (raw date + workout name). It deliberately excludes `Workout #`, which can renumber between exports.
- `lib/migrateV1.ts`: runs before the DB opens when a v1 database (has `xp_events`) is found. It builds into a temp file and swaps it in only when complete. v1 stored raw numbers in an unrecorded unit, hence `V1_WEIGHT_UNIT` / `V1_DISTANCE_UNIT`.
- `lib/export.ts`: Strong-layout CSV and full JSON backup.

## Design system

Cyberpunk dark theme in `app/globals.css`, consistent with Amethyst/ComicOrbit/SkyBit: purple/cyan/magenta, grid and scanline backdrop, circuit background. The file is the v1 base plus an "AstroFit v2 additions" section; add new styles to the additions.

Body text uses system fonts. `var(--font-mono)` (JetBrains Mono) is only for labels, badges, stat values and form labels. Auth and modal cards use `overflow: hidden` with brackets 10px inside (cyan top-left, magenta bottom-right). Sidebar active state uses `box-shadow: inset 2px 0 0 var(--accent-cyan)`, not `border-left`. Page titles use a chromatic `text-shadow`. Branding is text-only, with no logo image.

Mobile breakpoints: 900px (sidebar becomes a drawer, bottom tab bar appears) and 640px (inputs get `font-size: 16px` to prevent iOS zoom, modals become bottom sheets). Use `env(safe-area-inset-bottom)` for notch padding.

## PWA

`public/sw.js` is network-first and never caches `/api`. It's only registered in production builds, so test it with `npm run build`. Bump `CACHE` when changing what it precaches. The icons in `public/icons/` are committed PNGs.

## Docker

- `.dockerignore` must exclude `node_modules`, or Windows binaries overwrite the Linux SQLite build.
- `.gitattributes` forces LF on `*.sh` and `Dockerfile`. A CRLF `docker-entrypoint.sh` won't run in the container.
- Use named volumes (`-v astrofit_data:/config`). WAL locking breaks on Windows bind mounts.
- `docker-entrypoint.sh` generates `SESSION_SECRET` into `/config/.session_secret` when it isn't set.
