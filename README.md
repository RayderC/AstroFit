# AstroFit

Self-hosted fitness tracker with XP levels, strength workout logging, cardio tracking, weekly challenges, and personal record tracking. Built with Next.js and SQLite — runs in a single Docker container.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-WAL-green?logo=sqlite)
![Docker](https://img.shields.io/badge/Docker-ready-blue?logo=docker)
![Port](https://img.shields.io/badge/port-7090-purple)

## Features

- **Strength training** — Create workout templates, run active sessions, log sets with weight and reps. Rest timer after each completed set.
- **Cardio** — Manual entry (type, duration, distance) or browser GPS tracking with live pace display.
- **XP & Levels** — Earn XP for every workout, set, cardio session, and personal record. Level up as you train.
- **Streak bonus** — Daily and weekly streak XP bonuses keep you consistent.
- **Challenges** — 3 auto-generated weekly challenges (strength, cardio, wildcard) plus admin-posted special challenges.
- **Personal records** — Silent background tracking of best weight × reps and Epley-estimated 1RM per exercise.
- **Progress charts** — Per-exercise SVG line charts of max weight, volume, or estimated 1RM over time.
- **Exercise library** — 80+ built-in exercises across all major muscle groups, plus user-created custom exercises.
- **Templates** — Build reusable workout routines with target sets, reps, and weights.
- **Multi-user** — Admin creates accounts. Each user has their own data. No social features.
- **Admin panel** — User management, password resets, and special challenge creation.
- **PWA** — Installable as a mobile app from the browser.

## Quick Start

```bash
docker run -d \
  --name astrofit \
  -p 7090:7090 \
  -v astrofit_data:/config \
  --restart unless-stopped \
  rayderc/astrofit:latest
```

Open **http://localhost:7090** and create the first admin account on setup.

## Docker Compose

```yaml
services:
  astrofit:
    image: rayderc/astrofit:latest
    container_name: astrofit
    ports:
      - "7090:7090"
    volumes:
      - astrofit_data:/config
    restart: unless-stopped

volumes:
  astrofit_data:
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_PATH` | `/config/astrofit.db` | SQLite database path |
| `SESSION_SECRET` | auto-generated | Cookie encryption secret (persisted to `/config/.session_secret`) |
| `SESSION_COOKIE_SECURE` | `false` | Set to `true` when serving over HTTPS |
| `PORT` | `7090` | Listening port |

The session secret is auto-generated on first run and saved to `/config/.session_secret`. Mount the `/config` volume to persist data across container restarts.

## Running from Source

```bash
git clone https://github.com/RayderC/AstroFit.git
cd AstroFit
npm install
npm run dev       # http://localhost:7090
```

Build for production:

```bash
npm run build
npm start
```

## Tech Stack

- **Framework** — Next.js 16 (App Router + Pages API routes)
- **Language** — TypeScript
- **Database** — SQLite via better-sqlite3 (WAL mode)
- **Auth** — iron-session (encrypted HTTP-only cookies)
- **Styling** — Pure CSS with cyberpunk dark theme
- **Security** — CSRF protection, bcrypt password hashing, rate limiting

## Updating

```bash
docker pull rayderc/astrofit:latest
docker stop astrofit && docker rm astrofit
docker run -d --name astrofit -p 7090:7090 -v astrofit_data:/config --restart unless-stopped rayderc/astrofit:latest
```

Your data in the `/config` volume is preserved across updates.

## License

MIT
