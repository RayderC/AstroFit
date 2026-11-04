# AstroFit

Self-hosted workout tracker where lifting and cardio are equal parts of the app. One session can hold both. It logs like the Strong app, tells you when to add weight, and builds workouts and weekly programs for you. Built with Next.js and SQLite, it runs in a single Docker container.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-WAL-green?logo=sqlite)
![Docker](https://img.shields.io/badge/Docker-ready-blue?logo=docker)
![Port](https://img.shields.io/badge/port-7090-purple)

## Features

- **Lift logging**: a Previous column, warm-up/drop/failure set tags, a per-exercise rest timer, supersets and sticky exercise notes.
- **Cardio logging**: time, distance, heart rate, elevation and calories, or live GPS tracking with splits and a route map.
- **Exercise detail**: History, Charts and Records tabs for every exercise, from a library of about 120 plus your own.
- **Progression coach**: set a rep range. When every working set reaches the top, your next session suggests more weight and pre-fills it (+5 lb upper / +10 lb lower, or +2.5 / +5 kg, adjustable per exercise).
- **Builder**: generate one workout from focus, time, equipment and goal, or a full weekly program with cardio days. Edit anything before you use it.
- **Progress**: weekly volume, sets per muscle, best lifts, weekly distance and time, pace trends, best efforts and a muscle heatmap.
- **Body**: weight, body fat and tape measurements, each with its own chart.
- **Your data**: import a Strong CSV export, and export everything as CSV or JSON.
- **Multi-user**: separate data per person, with an admin page for accounts.
- **Installable**: works as a PWA on your phone.

There are no XP, levels, streaks or challenges.

## Quick start

```bash
docker run -d \
  --name astrofit \
  -p 7090:7090 \
  -v astrofit_data:/config \
  --restart unless-stopped \
  rayderc/astrofit:latest
```

Open **http://localhost:7090** and create the admin account.

GPS tracking and installing the PWA need HTTPS when you aren't on localhost, because browsers restrict both on plain HTTP. Put AstroFit behind a reverse proxy and set `SESSION_COOKIE_SECURE=true`.

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

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_PATH` | `/config/astrofit.db` | SQLite database path |
| `SESSION_SECRET` | generated | Cookie encryption secret, at least 32 characters. If unset, one is generated and saved to `/config/.session_secret` |
| `SESSION_COOKIE_SECURE` | `false` | Set to `true` when serving over HTTPS |
| `PORT` | `7090` | Listening port |
| `V1_WEIGHT_UNIT` | `lb` | v1 upgrade only: the unit your v1 weights are in (`lb` or `kg`) |
| `V1_DISTANCE_UNIT` | `mi` | v1 upgrade only: the unit your v1 distances are in (`mi` or `km`) |

## Upgrading from v1

Point v2 at your existing `/config` volume and start it. On first boot AstroFit detects the v1 database and:

1. Copies it to `/config/astrofit.v1.bak.db`.
2. Converts accounts (passwords keep working), custom exercises, templates, workouts and cardio.
3. Drops XP, levels, streaks, challenges and stored PRs. Records are recalculated from your sets.

v1 stored plain numbers in whichever unit you had selected in your browser, so the database doesn't record which one it was. **If yours weren't lb and mi, set `V1_WEIGHT_UNIT` and `V1_DISTANCE_UNIT` before the first boot.** Every user is converted using the same units.

If the conversion fails, the v1 database isn't changed and the next start tries again. The logs show what went wrong.

What to expect afterwards:

- Workouts with no completed sets are removed, and unfinished sets are dropped.
- A workout left open in v1 is closed at its last completed set.
- v1 had no time field for lifts, so numbers typed into reps for timed exercises like Plank are read as seconds.
- v1 had one list of muscles per exercise. For custom exercises the first becomes primary and the rest secondary, which you can change on the exercise page.

## Importing from Strong

Export a CSV from Strong, then go to **Settings → Import from Strong**. You'll see a preview with counts, the date range, a lb/kg and mi/km choice, and how each exercise matches your library. Nothing is saved until you confirm.

Unmatched exercises become custom ones. Importing a newer export later only adds workouts you don't already have. Set muscles on new custom exercises so they count on the heatmap.

## Running from source

```bash
git clone https://github.com/RayderC/AstroFit.git
cd AstroFit
npm install
npm run dev       # http://localhost:7090
```

Without `DATABASE_PATH`, the database is created as `astrofit.db` in the project folder.

## Building the image

```bash
docker build -t rayderc/astrofit:latest .
```

## Updating

```bash
docker pull rayderc/astrofit:latest
docker stop astrofit && docker rm astrofit
docker run -d --name astrofit -p 7090:7090 -v astrofit_data:/config --restart unless-stopped rayderc/astrofit:latest
```

Your data lives in the `/config` volume, so it survives updates.

## Tech stack

Next.js 16 (App Router), React 19, TypeScript, SQLite via better-sqlite3 (WAL mode), iron-session and pure CSS.

## License

MIT
