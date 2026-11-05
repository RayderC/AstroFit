import type Database from "better-sqlite3";
import { ACTIVITY_SEED, EXERCISE_SEED } from "./exerciseSeed";

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ','now'))";

export const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password      TEXT    NOT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,
  disabled      INTEGER NOT NULL DEFAULT 0,
  weight_unit   TEXT    NOT NULL DEFAULT 'lb',
  distance_unit TEXT    NOT NULL DEFAULT 'mi',
  rest_default  INTEGER NOT NULL DEFAULT 90,
  created_at    TEXT    NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS exercises (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  name              TEXT    NOT NULL,
  equipment         TEXT    NOT NULL DEFAULT 'other',
  primary_muscles   TEXT    NOT NULL DEFAULT '[]',
  secondary_muscles TEXT    NOT NULL DEFAULT '[]',
  pattern           TEXT,
  log_type          TEXT    NOT NULL DEFAULT 'weight_reps',
  rank              INTEGER NOT NULL DEFAULT 5,
  is_builtin        INTEGER NOT NULL DEFAULT 0,
  created_by        INTEGER REFERENCES users(id) ON DELETE CASCADE,
  archived          INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT    NOT NULL DEFAULT ${NOW}
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_exercise_builtin ON exercises(name, equipment) WHERE is_builtin = 1;

CREATE TABLE IF NOT EXISTS exercise_prefs (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id  INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  rest_s       INTEGER,
  increment_kg REAL,
  note         TEXT,
  PRIMARY KEY (user_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS activity_types (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT    NOT NULL,
  has_distance INTEGER NOT NULL DEFAULT 1,
  icon         TEXT    NOT NULL DEFAULT 'other',
  is_builtin   INTEGER NOT NULL DEFAULT 0,
  created_by   INTEGER REFERENCES users(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_activity_builtin ON activity_types(name) WHERE is_builtin = 1;

CREATE TABLE IF NOT EXISTS routines (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  program_id  INTEGER REFERENCES programs(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT ${NOW},
  updated_at  TEXT    NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS routine_blocks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  routine_id        INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  kind              TEXT    NOT NULL CHECK (kind IN ('lift','cardio')),
  position          INTEGER NOT NULL DEFAULT 0,
  superset          INTEGER,
  exercise_id       INTEGER REFERENCES exercises(id),
  activity_type_id  INTEGER REFERENCES activity_types(id),
  sets_count        INTEGER NOT NULL DEFAULT 3,
  rep_min           INTEGER,
  rep_max           INTEGER,
  target_weight_kg  REAL,
  rest_s            INTEGER,
  target_duration_s INTEGER,
  target_distance_m REAL,
  notes             TEXT
);

CREATE TABLE IF NOT EXISTS programs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  goal        TEXT    NOT NULL,
  config      TEXT    NOT NULL DEFAULT '{}',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT ${NOW}
);

CREATE TABLE IF NOT EXISTS program_days (
  program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  weekday    INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  PRIMARY KEY (program_id, weekday)
);

CREATE TABLE IF NOT EXISTS sessions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  routine_id  INTEGER REFERENCES routines(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL,
  started_at  TEXT    NOT NULL DEFAULT ${NOW},
  ended_at    TEXT,
  paused_s    INTEGER NOT NULL DEFAULT 0,
  paused_at   TEXT,
  notes       TEXT,
  source      TEXT    NOT NULL DEFAULT 'app',
  source_key  TEXT
);
CREATE INDEX IF NOT EXISTS ix_sessions_user ON sessions(user_id, started_at);
CREATE UNIQUE INDEX IF NOT EXISTS ux_sessions_source ON sessions(user_id, source, source_key) WHERE source_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS blocks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id        INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kind              TEXT    NOT NULL CHECK (kind IN ('lift','cardio')),
  position          INTEGER NOT NULL DEFAULT 0,
  superset          INTEGER,
  exercise_id       INTEGER REFERENCES exercises(id),
  activity_type_id  INTEGER REFERENCES activity_types(id),
  rep_min           INTEGER,
  rep_max           INTEGER,
  rest_s            INTEGER,
  notes             TEXT
);
CREATE INDEX IF NOT EXISTS ix_blocks_session ON blocks(session_id);
CREATE INDEX IF NOT EXISTS ix_blocks_exercise ON blocks(exercise_id);

CREATE TABLE IF NOT EXISTS sets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  block_id    INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  kind        TEXT    NOT NULL DEFAULT 'normal' CHECK (kind IN ('normal','warmup','drop','failure')),
  weight_kg   REAL,
  reps        INTEGER,
  duration_s  INTEGER,
  rpe         REAL,
  done        INTEGER NOT NULL DEFAULT 0,
  done_at     TEXT
);
CREATE INDEX IF NOT EXISTS ix_sets_block ON sets(block_id);

CREATE TABLE IF NOT EXISTS cardio (
  block_id    INTEGER PRIMARY KEY REFERENCES blocks(id) ON DELETE CASCADE,
  duration_s  INTEGER,
  distance_m  REAL,
  elevation_m REAL,
  avg_hr      INTEGER,
  calories    INTEGER,
  route       TEXT,
  done        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS body_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          TEXT    NOT NULL,
  weight_kg     REAL,
  body_fat_pct  REAL,
  measurements  TEXT    NOT NULL DEFAULT '{}',
  notes         TEXT,
  UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS imports (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source      TEXT    NOT NULL,
  file_hash   TEXT    NOT NULL,
  sessions    INTEGER NOT NULL DEFAULT 0,
  skipped     INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT    NOT NULL DEFAULT ${NOW}
);
`;

/** Insert any built-in exercises / activity types that are missing. Safe to run every boot. */
export const SCHEMA_V2 = `
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions(user_id);
`;

export function seedLibrary(db: Database.Database) {
  const ins = db.prepare(`INSERT OR IGNORE INTO exercises
    (name, equipment, primary_muscles, secondary_muscles, pattern, log_type, rank, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)`);
  const insA = db.prepare(`INSERT OR IGNORE INTO activity_types (name, has_distance, icon, is_builtin) VALUES (?, ?, ?, 1)`);
  db.transaction(() => {
    for (const [name, eq, pri, sec, pattern, log, rank] of EXERCISE_SEED) {
      ins.run(name, eq, JSON.stringify(pri), JSON.stringify(sec), pattern, log, rank);
    }
    for (const [name, hasDist, icon] of ACTIVITY_SEED) insA.run(name, hasDist, icon);
  })();
}
