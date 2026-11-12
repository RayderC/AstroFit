# AstroFit

Self-hosted workout tracker where lifting and cardio are equal parts of the app. One session can hold both. It logs like the Strong app, tells you when to add weight, and builds workouts and weekly programs for you. Built with Next.js and SQLite, it runs in a single Docker container.

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![SQLite](https://img.shields.io/badge/SQLite-WAL-green?logo=sqlite)
![Docker](https://img.shields.io/badge/Docker-ready-blue?logo=docker)
![Port](https://img.shields.io/badge/port-7090-purple)

## Features

- **Lift logging**: a Previous column, warm-up/drop/failure set tags, a per-exercise rest timer with a phone notification when rest ends, supersets and sticky exercise notes. Swipe a set left to delete it.
- **Cardio logging**: time, distance, heart rate, elevation and calories, or live GPS tracking with current pace, splits, spoken updates each mile or km, auto-pause and a route map. A track survives the page reloading, and rides show speed instead of pace.
- **Exercise detail**: History, Charts and Records tabs for every exercise, from a library of about 120 plus your own.
- **Progression coach**: set a rep range. When every working set reaches the top, your next session suggests more weight and pre-fills it (+5 lb upper / +10 lb lower, or +2.5 / +5 kg, adjustable per exercise). When a lift goes three sessions without a new best, it says so and offers a lighter week about 10% down, with one tap to fill it in.
- **Builder**: generate one workout from focus, time, equipment and goal, or a full weekly program. Pick the split (full body, push/pull/legs, upper/lower, body part and more) and your training days, see weekly sets per muscle, and rebuild any single day. Edit anything before you use it.
- **Personal plans**: tick **Base it on me** and the builder reads your last few months of workouts, plus your weight, height, body fat and age, to pick the days, split, goal, cardio and sets that suit you, and says why. Muscles you've been neglecting get extra sets, and coming back from a break starts lighter. Optional AI coach notes come from Google Gemini's free tier.
- **Progress**: weekly volume, sets per muscle, best lifts, weekly distance and time, pace trends, a muscle heatmap, and best efforts (1K to marathon) taken from the fastest stretch of your GPS tracks. Finishing a workout shows any new lifting or cardio records.
- **Food**: an optional calorie and macro diary on its own tab. Scan a barcode or search packaged foods from [Open Food Facts](https://world.openfoodfacts.org), add your own foods, and set daily goals.
- **Body**: weight, body fat and tape measurements, each with its own chart.
- **Your data**: import a Strong CSV export, and export everything as CSV or JSON.
- **Multi-user**: separate data per person, with an admin page for accounts. Admins can sign anyone out of every device, and Settings shows your recent sign-ins and wrong-password tries.
- **Backups**: a copy of the database every night (the last 7 are kept in `/config/backups`), plus **Download backup** and restore on the Admin page. A copy is saved before every restore, so a restore can be undone.
- **Update notice**: the Admin page says when a newer image is on Docker Hub. It checks once a day and sends nothing about you.
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

GPS tracking, live barcode scanning, notifications and installing the PWA need HTTPS when you aren't on localhost, because browsers restrict them on plain HTTP. Over plain HTTP you can still scan a barcode by taking a photo of it. Food lookups need the server to reach openfoodfacts.org. Put AstroFit behind a reverse proxy and set `SESSION_COOKIE_SECURE=true`.

## Sign in with Amethyst (optional)

If you run [Amethyst](https://github.com/RayderC/Amethyst), people can sign in here with their Amethyst account. In Amethyst, open **Dashboard → System** and turn on shared login. Then on this app's admin page, under **Sign in with Amethyst**, put in Amethyst's address and paste the shared secret. The login page gets a **Sign in with Amethyst** button.

It signs in the account here with the same username as the Amethyst one, so create the accounts here first. Passwords keep working. You can also set `AMETHYST_URL` and `AMETHYST_SSO_SECRET` on the container instead.

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
    # environment:
    #   GEMINI_API_KEY: ""   # optional, for AI coach notes in the builder
    restart: unless-stopped

volumes:
  astrofit_data:
```

## AI coach notes (optional)

With **Base it on me** ticked, a built program can get a few written tips from Google Gemini. Its API has a free tier:

1. Get a key at [Google AI Studio](https://aistudio.google.com/apikey). No card is needed.
2. Paste it under **Admin → Optional services** and tap Save, then Test. That page has a step-by-step guide.

You can set it as `GEMINI_API_KEY` on the container instead.

Notes are only fetched when you tap **Get coach notes**, which keeps you well inside the free daily limit. Your training stats, body stats and the plan are sent to Google to write them. Everything else in the builder works without a key.

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_PATH` | `/config/astrofit.db` | SQLite database path |
| `SESSION_SECRET` | generated | Cookie encryption secret, at least 32 characters. If unset, one is generated and saved to `/config/.session_secret` |
| `SESSION_COOKIE_SECURE` | `false` | Set to `true` when serving over HTTPS |
| `PORT` | `7090` | Listening port |
| `GEMINI_API_KEY` | unset | Optional. A free Google AI Studio key for coach notes. Usually set on the Admin page instead |
| `GEMINI_MODEL` | `gemini-flash-lite-latest` | Optional. The Gemini model for coach notes |
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
