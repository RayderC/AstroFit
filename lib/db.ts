import Database from "better-sqlite3";
import path from "path";
import bcrypt from "bcryptjs";
import { levelFromXp } from "./xp";

const dbPath =
  process.env.DATABASE_PATH ||
  path.join(process.cwd(), "astrofit.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ─── Schema ────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    UNIQUE NOT NULL,
    password      TEXT    NOT NULL,
    is_admin      INTEGER NOT NULL DEFAULT 0,
    xp            INTEGER NOT NULL DEFAULT 0,
    level         INTEGER NOT NULL DEFAULT 1,
    streak_days   INTEGER NOT NULL DEFAULT 0,
    last_activity_date TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS exercises (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    category      TEXT    NOT NULL,
    muscle_groups TEXT    NOT NULL DEFAULT '[]',
    equipment     TEXT,
    is_builtin    INTEGER NOT NULL DEFAULT 0,
    created_by    INTEGER REFERENCES users(id),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS templates (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    description TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS template_exercises (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    template_id   INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
    exercise_id   INTEGER NOT NULL REFERENCES exercises(id),
    sets          INTEGER NOT NULL DEFAULT 3,
    target_reps   TEXT,
    target_weight REAL,
    rest_seconds  INTEGER NOT NULL DEFAULT 90,
    order_index   INTEGER NOT NULL DEFAULT 0,
    notes         TEXT
  );

  CREATE TABLE IF NOT EXISTS workouts (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id      INTEGER REFERENCES templates(id),
    name             TEXT    NOT NULL,
    started_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    completed_at     TEXT,
    duration_seconds INTEGER,
    notes            TEXT,
    xp_earned        INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS workout_exercises (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_id  INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise_id INTEGER NOT NULL REFERENCES exercises(id),
    order_index INTEGER NOT NULL DEFAULT 0,
    notes       TEXT
  );

  CREATE TABLE IF NOT EXISTS workout_sets (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    workout_exercise_id  INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
    set_number           INTEGER NOT NULL,
    weight               REAL,
    reps                 INTEGER,
    duration_seconds     INTEGER,
    distance_km          REAL,
    rpe                  REAL,
    is_warmup            INTEGER NOT NULL DEFAULT 0,
    is_pr                INTEGER NOT NULL DEFAULT 0,
    completed            INTEGER NOT NULL DEFAULT 0,
    completed_at         TEXT
  );

  CREATE TABLE IF NOT EXISTS personal_records (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_id   INTEGER NOT NULL REFERENCES exercises(id),
    weight        REAL,
    reps          INTEGER,
    estimated_1rm REAL,
    achieved_at   TEXT    NOT NULL,
    workout_id    INTEGER REFERENCES workouts(id),
    UNIQUE(user_id, exercise_id)
  );

  CREATE TABLE IF NOT EXISTS cardio_activities (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type             TEXT    NOT NULL,
    distance_km      REAL,
    duration_seconds INTEGER NOT NULL,
    pace_per_km      INTEGER,
    elevation_m      REAL,
    notes            TEXT,
    gps_data         TEXT,
    started_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    completed_at     TEXT,
    xp_earned        INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS xp_events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount     INTEGER NOT NULL,
    reason     TEXT    NOT NULL,
    ref_type   TEXT,
    ref_id     INTEGER,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS challenges (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    type               TEXT    NOT NULL,
    category           TEXT    NOT NULL,
    title              TEXT    NOT NULL,
    description        TEXT    NOT NULL,
    target_type        TEXT    NOT NULL,
    target_value       REAL    NOT NULL,
    target_exercise_id INTEGER REFERENCES exercises(id),
    xp_reward          INTEGER NOT NULL DEFAULT 100,
    starts_at          TEXT    NOT NULL,
    ends_at            TEXT    NOT NULL,
    created_by         INTEGER REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_challenges (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    progress     REAL    NOT NULL DEFAULT 0,
    completed    INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    xp_earned    INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, challenge_id)
  );

  CREATE INDEX IF NOT EXISTS idx_workouts_user    ON workouts(user_id);
  CREATE INDEX IF NOT EXISTS idx_workout_ex_wid   ON workout_exercises(workout_id);
  CREATE INDEX IF NOT EXISTS idx_workout_sets_wid ON workout_sets(workout_exercise_id);
  CREATE INDEX IF NOT EXISTS idx_cardio_user       ON cardio_activities(user_id);
  CREATE INDEX IF NOT EXISTS idx_xp_user           ON xp_events(user_id);
  CREATE INDEX IF NOT EXISTS idx_challenges_dates  ON challenges(starts_at, ends_at);
  CREATE INDEX IF NOT EXISTS idx_uc_user           ON user_challenges(user_id);
`);

// ─── Seed built-in exercises ────────────────────────────────────────────────

const exerciseCount = (db.prepare("SELECT COUNT(*) as c FROM exercises WHERE is_builtin = 1").get() as { c: number }).c;

if (exerciseCount === 0) {
  const insert = db.prepare(`
    INSERT INTO exercises (name, category, muscle_groups, equipment, is_builtin)
    VALUES (?, ?, ?, ?, 1)
  `);

  const seed = db.transaction(() => {
    // ── Chest ──
    insert.run("Bench Press",           "strength", '["chest","triceps","shoulders"]', "barbell");
    insert.run("Incline Bench Press",   "strength", '["chest","triceps","shoulders"]', "barbell");
    insert.run("Decline Bench Press",   "strength", '["chest","triceps"]',             "barbell");
    insert.run("Dumbbell Bench Press",  "strength", '["chest","triceps","shoulders"]', "dumbbell");
    insert.run("Dumbbell Flyes",        "strength", '["chest"]',                       "dumbbell");
    insert.run("Cable Flyes",           "strength", '["chest"]',                       "cable");
    insert.run("Push-up",               "bodyweight","['chest','triceps','shoulders']", null);
    insert.run("Chest Dip",             "bodyweight","['chest','triceps']",             null);
    insert.run("Pec Deck",              "strength", '["chest"]',                       "machine");

    // ── Back ──
    insert.run("Deadlift",              "strength", '["back","glutes","hamstrings"]',   "barbell");
    insert.run("Romanian Deadlift",     "strength", '["hamstrings","glutes","back"]',   "barbell");
    insert.run("Barbell Row",           "strength", '["back","biceps"]',                "barbell");
    insert.run("Dumbbell Row",          "strength", '["back","biceps"]',                "dumbbell");
    insert.run("Pull-up",               "bodyweight",'["back","biceps"]',               null);
    insert.run("Chin-up",               "bodyweight",'["back","biceps"]',               null);
    insert.run("Lat Pulldown",          "strength", '["back","biceps"]',                "cable");
    insert.run("Seated Cable Row",      "strength", '["back","biceps"]',                "cable");
    insert.run("T-Bar Row",             "strength", '["back","biceps"]',                "barbell");
    insert.run("Face Pull",             "strength", '["shoulders","back"]',             "cable");
    insert.run("Hyperextension",        "strength", '["back","glutes","hamstrings"]',   "machine");

    // ── Shoulders ──
    insert.run("Overhead Press",        "strength", '["shoulders","triceps"]',          "barbell");
    insert.run("Seated Dumbbell Press", "strength", '["shoulders","triceps"]',          "dumbbell");
    insert.run("Arnold Press",          "strength", '["shoulders","triceps"]',          "dumbbell");
    insert.run("Lateral Raise",         "strength", '["shoulders"]',                    "dumbbell");
    insert.run("Front Raise",           "strength", '["shoulders"]',                    "dumbbell");
    insert.run("Rear Delt Fly",         "strength", '["shoulders","back"]',             "dumbbell");
    insert.run("Upright Row",           "strength", '["shoulders","traps"]',            "barbell");
    insert.run("Shrugs",                "strength", '["traps"]',                        "barbell");

    // ── Arms ──
    insert.run("Barbell Curl",          "strength", '["biceps"]',                       "barbell");
    insert.run("Dumbbell Curl",         "strength", '["biceps"]',                       "dumbbell");
    insert.run("Hammer Curl",           "strength", '["biceps","forearms"]',            "dumbbell");
    insert.run("Preacher Curl",         "strength", '["biceps"]',                       "barbell");
    insert.run("Cable Curl",            "strength", '["biceps"]',                       "cable");
    insert.run("Concentration Curl",    "strength", '["biceps"]',                       "dumbbell");
    insert.run("Tricep Pushdown",       "strength", '["triceps"]',                      "cable");
    insert.run("Overhead Tricep Ext",   "strength", '["triceps"]',                      "cable");
    insert.run("Skull Crushers",        "strength", '["triceps"]',                      "barbell");
    insert.run("Close-Grip Bench",      "strength", '["triceps","chest"]',              "barbell");
    insert.run("Tricep Dip",            "bodyweight",'["triceps","chest"]',             null);
    insert.run("Diamond Push-up",       "bodyweight",'["triceps","chest"]',             null);
    insert.run("Wrist Curl",            "strength", '["forearms"]',                     "barbell");

    // ── Legs ──
    insert.run("Squat",                 "strength", '["quads","glutes","hamstrings"]',  "barbell");
    insert.run("Front Squat",           "strength", '["quads","glutes"]',               "barbell");
    insert.run("Hack Squat",            "strength", '["quads","glutes"]',               "machine");
    insert.run("Leg Press",             "strength", '["quads","glutes","hamstrings"]',  "machine");
    insert.run("Bulgarian Split Squat", "strength", '["quads","glutes"]',               "dumbbell");
    insert.run("Lunge",                 "strength", '["quads","glutes","hamstrings"]',  "dumbbell");
    insert.run("Step-Up",               "strength", '["quads","glutes"]',               "dumbbell");
    insert.run("Leg Extension",         "strength", '["quads"]',                        "machine");
    insert.run("Leg Curl",              "strength", '["hamstrings"]',                   "machine");
    insert.run("Hip Thrust",            "strength", '["glutes","hamstrings"]',          "barbell");
    insert.run("Glute Bridge",          "bodyweight",'["glutes","hamstrings"]',         null);
    insert.run("Standing Calf Raise",   "strength", '["calves"]',                       "machine");
    insert.run("Seated Calf Raise",     "strength", '["calves"]',                       "machine");
    insert.run("Good Morning",          "strength", '["hamstrings","back","glutes"]',   "barbell");

    // ── Core ──
    insert.run("Plank",                 "bodyweight",'["core"]',                        null);
    insert.run("Side Plank",            "bodyweight",'["core","obliques"]',             null);
    insert.run("Crunch",                "bodyweight",'["core"]',                        null);
    insert.run("Sit-up",                "bodyweight",'["core"]',                        null);
    insert.run("Leg Raise",             "bodyweight",'["core"]',                        null);
    insert.run("Hanging Leg Raise",     "bodyweight",'["core"]',                        null);
    insert.run("Russian Twist",         "bodyweight",'["core","obliques"]',             null);
    insert.run("Ab Wheel Rollout",      "bodyweight",'["core"]',                        null);
    insert.run("Cable Crunch",          "strength", '["core"]',                         "cable");
    insert.run("Mountain Climber",      "bodyweight",'["core","cardio"]',               null);
    insert.run("Dead Bug",              "bodyweight",'["core"]',                        null);
    insert.run("Pallof Press",          "strength", '["core","obliques"]',              "cable");

    // ── Full Body / Olympic ──
    insert.run("Power Clean",           "strength", '["back","legs","shoulders"]',      "barbell");
    insert.run("Clean and Jerk",        "strength", '["full body"]',                    "barbell");
    insert.run("Snatch",                "strength", '["full body"]',                    "barbell");
    insert.run("Thruster",              "strength", '["quads","shoulders","triceps"]',  "barbell");
    insert.run("Farmer's Carry",        "strength", '["traps","core","forearms"]',      "dumbbell");
    insert.run("Kettlebell Swing",      "strength", '["glutes","hamstrings","back"]',   "kettlebell");
    insert.run("Turkish Get-Up",        "strength", '["full body"]',                    "kettlebell");
    insert.run("Box Jump",              "bodyweight",'["quads","glutes","calves"]',     null);
    insert.run("Burpee",                "bodyweight",'["full body"]',                   null);

    // ── Cardio (for manual logging as strength exercises / HIIT) ──
    insert.run("Jump Rope",             "cardio",   '["calves","cardio"]',              null);
    insert.run("Battle Ropes",          "cardio",   '["shoulders","cardio"]',           null);
    insert.run("Rowing Machine",        "cardio",   '["back","cardio"]',                "machine");
    insert.run("Assault Bike",          "cardio",   '["cardio","full body"]',           "machine");
    insert.run("Stair Climber",         "cardio",   '["quads","glutes","cardio"]',      "machine");
    insert.run("Elliptical",            "cardio",   '["cardio"]',                       "machine");
    insert.run("Treadmill",             "cardio",   '["cardio"]',                       "machine");
    insert.run("Sled Push",             "strength", '["quads","glutes","cardio"]',      null);
  });

  seed();
}

export default db;

// ─── User helpers ───────────────────────────────────────────────────────────

export function countUsers(): number {
  return (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
}

export function getUserByUsername(username: string) {
  return db.prepare("SELECT * FROM users WHERE username = ?").get(username) as
    | { id: number; username: string; password: string; is_admin: number; xp: number; level: number; streak_days: number; last_activity_date: string | null; created_at: string }
    | undefined;
}

export function getUserById(id: number) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | { id: number; username: string; password: string; is_admin: number; xp: number; level: number; streak_days: number; last_activity_date: string | null; created_at: string }
    | undefined;
}

export function createUser(username: string, password: string, isAdmin = false) {
  const hashed = bcrypt.hashSync(password, 12);
  const result = db.prepare(
    "INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)"
  ).run(username, hashed, isAdmin ? 1 : 0);
  return result.lastInsertRowid as number;
}

// ─── XP helpers ─────────────────────────────────────────────────────────────

export function awardXp(userId: number, amount: number, reason: string, refType?: string, refId?: number) {
  db.prepare(
    "INSERT INTO xp_events (user_id, amount, reason, ref_type, ref_id) VALUES (?, ?, ?, ?, ?)"
  ).run(userId, amount, reason, refType ?? null, refId ?? null);

  const user = db.prepare("SELECT xp FROM users WHERE id = ?").get(userId) as { xp: number };
  const newXp = user.xp + amount;
  const newLevel = levelFromXp(newXp);
  db.prepare("UPDATE users SET xp = ?, level = ? WHERE id = ?").run(newXp, newLevel, userId);
  return { xp: newXp, level: newLevel };
}

// ─── Streak helpers ──────────────────────────────────────────────────────────

export function updateStreak(userId: number): { streak: number; bonusXp: number } {
  const user = db.prepare(
    "SELECT streak_days, last_activity_date FROM users WHERE id = ?"
  ).get(userId) as { streak_days: number; last_activity_date: string | null };

  const today = new Date().toISOString().slice(0, 10);
  const last = user.last_activity_date;

  let streak = user.streak_days;
  let bonusXp = 0;

  if (last === today) {
    // Already logged today — no change
  } else if (last) {
    const diff = Math.round(
      (new Date(today).getTime() - new Date(last).getTime()) / 86400000
    );
    if (diff === 1) {
      streak++;
      if (streak === 7 || streak === 30 || (streak > 0 && streak % 30 === 0)) {
        bonusXp = streak >= 30 ? 200 : 50;
      }
    } else {
      streak = 1;
    }
  } else {
    streak = 1;
  }

  db.prepare(
    "UPDATE users SET streak_days = ?, last_activity_date = ? WHERE id = ?"
  ).run(streak, today, userId);

  return { streak, bonusXp };
}

// ─── Challenge helpers ───────────────────────────────────────────────────────

export function getActiveWeekChallenges(userId: number) {
  const now = new Date().toISOString();
  return db.prepare(`
    SELECT c.*, uc.progress, uc.completed, uc.xp_earned
    FROM challenges c
    LEFT JOIN user_challenges uc ON uc.challenge_id = c.id AND uc.user_id = ?
    WHERE c.starts_at <= ? AND c.ends_at >= ?
    ORDER BY c.type DESC, c.category
  `).all(userId, now, now);
}

export function ensureWeeklyChallenges() {
  const monday = getMondayIso();
  const sunday = getSundayIso(monday);

  const existing = db.prepare(
    "SELECT COUNT(*) as c FROM challenges WHERE type = 'weekly_auto' AND starts_at = ?"
  ).get(monday) as { c: number };

  if (existing.c >= 3) return;

  const insert = db.prepare(`
    INSERT INTO challenges (type, category, title, description, target_type, target_value, xp_reward, starts_at, ends_at)
    VALUES ('weekly_auto', ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    insert.run(
      "strength",
      "Complete 3 Workouts",
      "Finish 3 strength training sessions this week.",
      "workout_count", 3, 100, monday, sunday
    );
    insert.run(
      "cardio",
      "Log 10 km",
      "Record 10 km of cardio activities this week.",
      "cardio_km", 10, 100, monday, sunday
    );
    // Rotating wildcard based on week number
    const week = getWeekNumber();
    const wildcards = [
      { title: "Hit a New PR", desc: "Achieve a personal record on any exercise this week.", type: "pr_count", val: 1 },
      { title: "5 Workouts in a Row", desc: "Complete 5 total workouts this week.", type: "workout_count", val: 5 },
      { title: "Log 20 km", desc: "Record 20 km of cardio activities this week.", type: "cardio_km", val: 20 },
      { title: "Heavy Volume Week", desc: "Lift a total of 10,000 kg this week.", type: "volume_kg", val: 10000 },
    ];
    const wc = wildcards[week % wildcards.length];
    insert.run("wildcard", wc.title, wc.desc, wc.type, wc.val, 150, monday, sunday);
  })();
}

function getMondayIso(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10) + "T00:00:00.000Z";
}

function getSundayIso(monday: string): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function getWeekNumber(): number {
  const d = new Date();
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
}

// ─── PR helpers ──────────────────────────────────────────────────────────────

// Epley formula: weight * (1 + reps/30)
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function checkAndUpdatePr(
  userId: number, exerciseId: number, weight: number, reps: number, workoutId: number
): boolean {
  const e1rm = estimateOneRepMax(weight, reps);
  const existing = db.prepare(
    "SELECT estimated_1rm FROM personal_records WHERE user_id = ? AND exercise_id = ?"
  ).get(userId, exerciseId) as { estimated_1rm: number } | undefined;

  if (!existing || e1rm > existing.estimated_1rm) {
    db.prepare(`
      INSERT INTO personal_records (user_id, exercise_id, weight, reps, estimated_1rm, achieved_at, workout_id)
      VALUES (?, ?, ?, ?, ?, datetime('now'), ?)
      ON CONFLICT(user_id, exercise_id) DO UPDATE SET
        weight = excluded.weight, reps = excluded.reps,
        estimated_1rm = excluded.estimated_1rm,
        achieved_at = excluded.achieved_at, workout_id = excluded.workout_id
    `).run(userId, exerciseId, weight, reps, e1rm, workoutId);
    return true;
  }
  return false;
}
