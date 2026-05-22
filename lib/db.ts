import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// During `next build`, workers all import this module simultaneously and
// compete for the same SQLite file. Use an in-memory DB for the build phase
// so there is no file contention.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

const dbPath = isBuildPhase
  ? ":memory:"
  : process.env.DATABASE_PATH || path.resolve(process.cwd(), "astrofit.db");

if (!isBuildPhase) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

const db = new Database(dbPath);
db.pragma("busy_timeout = 5000");
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    is_admin INTEGER NOT NULL DEFAULT 0,
    unit_preference TEXT NOT NULL DEFAULT 'mi',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS site_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, endpoint),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Core workout log (running + strength + other)
  CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'run',
    title TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    started_at TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    -- Run-specific fields
    distance_meters REAL,
    avg_pace_seconds_per_km REAL,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    elevation_gain_meters REAL,
    elevation_loss_meters REAL,
    calories INTEGER,
    cadence INTEGER,
    gpx_data TEXT,
    -- Import source
    source TEXT NOT NULL DEFAULT 'manual',
    strava_id TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Per-km/mi splits for runs
  CREATE TABLE IF NOT EXISTS run_splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL,
    split_number INTEGER NOT NULL,
    distance_meters REAL NOT NULL,
    duration_seconds INTEGER NOT NULL,
    elevation_gain_meters REAL,
    FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
  );

  -- Exercises performed in a strength workout
  CREATE TABLE IF NOT EXISTS workout_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id INTEGER NOT NULL,
    exercise_name TEXT NOT NULL,
    muscle_group TEXT NOT NULL DEFAULT '',
    order_index INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE
  );

  -- Sets for each exercise
  CREATE TABLE IF NOT EXISTS exercise_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_exercise_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    reps INTEGER,
    weight_kg REAL,
    duration_seconds INTEGER,
    rest_seconds INTEGER,
    completed INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises(id) ON DELETE CASCADE
  );

  -- Reusable workout templates
  CREATE TABLE IF NOT EXISTS workout_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'strength',
    description TEXT NOT NULL DEFAULT '',
    estimated_duration_minutes INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS template_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id INTEGER NOT NULL,
    exercise_name TEXT NOT NULL,
    muscle_group TEXT NOT NULL DEFAULT '',
    sets INTEGER NOT NULL DEFAULT 3,
    reps TEXT NOT NULL DEFAULT '8-12',
    weight_kg REAL,
    rest_seconds INTEGER DEFAULT 60,
    order_index INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (template_id) REFERENCES workout_templates(id) ON DELETE CASCADE
  );

  -- Training plans
  CREATE TABLE IF NOT EXISTS training_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    goal_type TEXT NOT NULL DEFAULT 'custom',
    goal_date TEXT,
    weeks_duration INTEGER NOT NULL DEFAULT 12,
    start_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS plan_weeks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    target_distance_km REAL,
    FOREIGN KEY (plan_id) REFERENCES training_plans(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS plan_workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'easy_run',
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    target_distance_km REAL,
    target_duration_minutes INTEGER,
    target_pace TEXT NOT NULL DEFAULT '',
    completed_workout_id INTEGER,
    FOREIGN KEY (week_id) REFERENCES plan_weeks(id) ON DELETE CASCADE,
    FOREIGN KEY (completed_workout_id) REFERENCES workouts(id) ON DELETE SET NULL
  );

  -- Goals
  CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    target_value REAL NOT NULL,
    unit TEXT NOT NULL DEFAULT 'km',
    period_start TEXT,
    period_end TEXT,
    is_recurring INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Body metrics log
  CREATE TABLE IF NOT EXISTS body_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    weight_kg REAL,
    body_fat_pct REAL,
    chest_cm REAL,
    waist_cm REAL,
    hips_cm REAL,
    arms_cm REAL,
    legs_cm REAL,
    notes TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Progress photos
  CREATE TABLE IF NOT EXISTS progress_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    file_path TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Nutrition log
  CREATE TABLE IF NOT EXISTS nutrition_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    logged_date TEXT NOT NULL,
    meal_type TEXT NOT NULL DEFAULT 'snack',
    food_name TEXT NOT NULL,
    calories REAL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    amount_g REAL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Per-user nutrition macro targets
  CREATE TABLE IF NOT EXISTS nutrition_goals (
    user_id INTEGER PRIMARY KEY,
    calories INTEGER,
    protein_g INTEGER,
    carbs_g INTEGER,
    fat_g INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Achievement definitions (seeded on startup)
  CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '🏅',
    xp_reward INTEGER NOT NULL DEFAULT 50,
    category TEXT NOT NULL DEFAULT 'milestone'
  );

  -- Achievements earned by users
  CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL,
    earned_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
  );

  -- XP and level tracking
  CREATE TABLE IF NOT EXISTS user_xp (
    user_id INTEGER PRIMARY KEY,
    total_xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  -- Personal records
  CREATE TABLE IF NOT EXISTS personal_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    record_type TEXT NOT NULL,
    value REAL NOT NULL,
    workout_id INTEGER,
    achieved_at TEXT NOT NULL,
    UNIQUE(user_id, record_type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE SET NULL
  );

  -- Push notification delivery log (bounded, for admin diagnostics)
  CREATE TABLE IF NOT EXISTS push_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    endpoint_host TEXT NOT NULL,
    status_code INTEGER,
    error TEXT NOT NULL DEFAULT '',
    title TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id, started_at DESC);
  CREATE INDEX IF NOT EXISTS idx_workouts_type ON workouts(user_id, type);
  CREATE INDEX IF NOT EXISTS idx_body_metrics_user ON body_metrics(user_id, recorded_at DESC);
  CREATE INDEX IF NOT EXISTS idx_nutrition_user ON nutrition_logs(user_id, logged_date DESC);
  CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id, is_active);
`);

// Inline idempotent migrations for upgrading existing installs.
const migrations: string[] = [
  "ALTER TABLE user_xp ADD COLUMN streak INTEGER NOT NULL DEFAULT 0",
  "ALTER TABLE user_xp ADD COLUMN last_workout_date TEXT",
];

if (!isBuildPhase) {
  for (const sql of migrations) {
    try { db.exec(sql); } catch { /* already applied */ }
  }
}

export function getSiteConfig(): Record<string, string> {
  const rows = db.prepare("SELECT key, value FROM site_config").all() as { key: string; value: string }[];
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function setSiteConfigKey(key: string, value: string) {
  db.prepare("INSERT OR REPLACE INTO site_config (key, value) VALUES (?, ?)").run(key, value);
}

export function userCount(): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number };
  return row.c;
}

export function adminCount(): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM users WHERE is_admin = 1").get() as { c: number };
  return row.c;
}

export default db;
