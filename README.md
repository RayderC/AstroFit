# AstroFit

**Self-hosted fitness tracker with Solo Leveling RPG progression.** Log workouts, earn XP, level up — no subscriptions, no tracking.

[![Docker Hub](https://img.shields.io/docker/v/rayderc/astrofit?label=Docker%20Hub&logo=docker)](https://hub.docker.com/r/rayderc/astrofit)
[![GitHub](https://img.shields.io/badge/GitHub-RayderC%2FAstroFit-181717?logo=github)](https://github.com/RayderC/AstroFit)

---

## Features

- **RPG progression system** — earn XP every workout, level up from 1 to 100, with streak bonuses up to +50% XP
- **Solo Leveling aesthetic** — dark theme, gold level badge, glowing XP bar, "The System" login screen
- **Run logging** — distance, pace, duration, elevation, calories, per-km splits
- **Strength logging** — exercises, sets, reps, weight with live volume and estimated 1RM
- **Mission log** — your workout history displayed as completed missions
- **Streak tracking** — consecutive workout days tracked automatically
- **Login-gated** — every page requires authentication; first launch auto-redirects to setup
- **PWA / Add to Home Screen** — installs as a full-screen app on iOS and Android
- **Single-container Docker** — SQLite database, bind-mount volume for persistence

---

## Quick start

```yaml
# docker-compose.yml
services:
  astrofit:
    image: rayderc/astrofit:latest
    container_name: astrofit
    restart: always
    ports:
      - "7090:7090"
    volumes:
      - ./config:/config
```

```bash
docker compose up -d
# then open http://localhost:7090
```

On first launch you'll be redirected to `/setup` to create the admin account.

---

## XP System

| Action | XP |
|---|---|
| Any workout (base) | 100 XP |
| Per minute of activity | +2 XP (capped at 90 min) |
| Per km run or cycled | +8 XP |
| Per strength exercise | +10 XP |
| 3–6 day streak bonus | +25% |
| 7+ day streak bonus | +50% |

1,000 XP = 1 level. Max level 100.

---

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `SESSION_SECRET` | auto-generated | Min 32 chars. Written to `/config/.session_secret` on first run if not set. |
| `SESSION_COOKIE_SECURE` | `false` | Set to `true` behind a TLS reverse proxy (nginx, Traefik, etc). |
| `DATABASE_PATH` | `/config/astrofit.db` | SQLite file location. |

---

## Development

```bash
git clone https://github.com/RayderC/AstroFit.git
cd AstroFit
npm install
npm run dev   # http://localhost:7090
```

Requires Node.js 20+.

---

## Stack

- **Next.js 16** (App Router + Pages Router) · **React 19** · **TypeScript**
- **SQLite** via `better-sqlite3`
- **iron-session** for encrypted cookie auth
- Solo Leveling / dark RPG theme

---

## License

MIT
