import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { MUSCLES } from "./exerciseSeed";
import { toKg, toM, type DistanceUnit, type WeightUnit } from "./units";

// One-time conversion of a v1 AstroFit database, run on first boot before anything opens it.
//
// The result is built in a temp file and only replaces the v1 file once complete, so a failure at any
// point leaves the v1 database as it was and the next boot tries again. XP, levels, streaks, challenges
// and stored PRs aren't carried over: v2 has no gamification, and it computes records from the sets.

type Db = Database.Database;

/** v1 built-in exercise name → v2 library [name, equipment]. */
const LIFTS: Record<string, [string, string]> = {
  "Bench Press": ["Bench Press", "barbell"], "Incline Bench Press": ["Incline Bench Press", "barbell"],
  "Decline Bench Press": ["Decline Bench Press", "barbell"], "Dumbbell Bench Press": ["Bench Press", "dumbbell"],
  "Dumbbell Flyes": ["Chest Fly", "dumbbell"], "Cable Flyes": ["Cable Crossover", "cable"], "Push-up": ["Push Up", "bodyweight"],
  "Chest Dip": ["Chest Dip", "bodyweight"], "Pec Deck": ["Chest Fly", "machine"],
  "Deadlift": ["Deadlift", "barbell"], "Romanian Deadlift": ["Romanian Deadlift", "barbell"], "Barbell Row": ["Bent Over Row", "barbell"],
  "Dumbbell Row": ["Bent Over One Arm Row", "dumbbell"], "Pull-up": ["Pull Up", "bodyweight"], "Chin-up": ["Chin Up", "bodyweight"],
  "Lat Pulldown": ["Lat Pulldown", "cable"], "Seated Cable Row": ["Seated Row", "cable"], "T-Bar Row": ["T Bar Row", "other"],
  "Face Pull": ["Face Pull", "cable"], "Hyperextension": ["Back Extension", "bodyweight"],
  "Overhead Press": ["Overhead Press", "barbell"], "Seated Dumbbell Press": ["Overhead Press", "dumbbell"], "Arnold Press": ["Arnold Press", "dumbbell"],
  "Lateral Raise": ["Lateral Raise", "dumbbell"], "Front Raise": ["Front Raise", "dumbbell"], "Rear Delt Fly": ["Reverse Fly", "dumbbell"],
  "Upright Row": ["Upright Row", "barbell"], "Shrugs": ["Shrug", "barbell"],
  "Barbell Curl": ["Bicep Curl", "barbell"], "Dumbbell Curl": ["Bicep Curl", "dumbbell"], "Hammer Curl": ["Hammer Curl", "dumbbell"],
  "Preacher Curl": ["Preacher Curl", "barbell"], "Cable Curl": ["Bicep Curl", "cable"], "Concentration Curl": ["Concentration Curl", "dumbbell"],
  "Tricep Pushdown": ["Triceps Pushdown", "cable"], "Overhead Tricep Ext": ["Triceps Extension", "cable"], "Skull Crushers": ["Skullcrusher", "barbell"],
  "Close-Grip Bench": ["Close Grip Bench Press", "barbell"], "Tricep Dip": ["Triceps Dip", "bodyweight"], "Wrist Curl": ["Wrist Curl", "barbell"],
  "Squat": ["Squat", "barbell"], "Front Squat": ["Front Squat", "barbell"], "Hack Squat": ["Hack Squat", "machine"], "Leg Press": ["Leg Press", "machine"],
  "Bulgarian Split Squat": ["Bulgarian Split Squat", "dumbbell"], "Lunge": ["Lunge", "dumbbell"], "Step-Up": ["Step Up", "dumbbell"],
  "Leg Extension": ["Leg Extension", "machine"], "Leg Curl": ["Lying Leg Curl", "machine"], "Hip Thrust": ["Hip Thrust", "barbell"],
  "Glute Bridge": ["Glute Bridge", "bodyweight"], "Standing Calf Raise": ["Standing Calf Raise", "machine"], "Seated Calf Raise": ["Seated Calf Raise", "machine"],
  "Good Morning": ["Good Morning", "barbell"],
  "Plank": ["Plank", "bodyweight"], "Side Plank": ["Side Plank", "bodyweight"], "Crunch": ["Crunch", "bodyweight"], "Leg Raise": ["Lying Leg Raise", "bodyweight"],
  "Hanging Leg Raise": ["Hanging Leg Raise", "bodyweight"], "Russian Twist": ["Russian Twist", "bodyweight"], "Ab Wheel Rollout": ["Ab Wheel", "other"],
  "Cable Crunch": ["Cable Crunch", "cable"], "Dead Bug": ["Dead Bug", "bodyweight"], "Pallof Press": ["Pallof Press", "cable"],
  "Power Clean": ["Power Clean", "barbell"], "Clean and Jerk": ["Clean and Jerk", "barbell"], "Snatch": ["Snatch", "barbell"], "Thruster": ["Thruster", "barbell"],
  "Farmer's Carry": ["Farmers Walk", "dumbbell"], "Kettlebell Swing": ["Kettlebell Swing", "kettlebell"], "Box Jump": ["Box Jump", "bodyweight"], "Burpee": ["Burpee", "bodyweight"],
  "Jump Rope": ["Jump Rope", "other"], "Battle Ropes": ["Battle Ropes", "other"], "Sled Push": ["Sled Push", "other"],
};

/** v1 "exercises" that v2 models as cardio activities. */
const CARDIO_EXERCISES: Record<string, string> = {
  "Rowing Machine": "Rowing", "Assault Bike": "Assault Bike", "Stair Climber": "Stair Climber", "Elliptical": "Elliptical", "Treadmill": "Treadmill",
};

const MUSCLE_MAP: Record<string, string[]> = {
  back: ["lats", "upper_back"], shoulders: ["front_delts", "side_delts"], core: ["abs"], legs: ["quads", "hamstrings", "glutes"],
  "full body": ["quads", "glutes", "chest", "lats"], cardio: [],
};

export function isV1Database(file: string): boolean {
  let db: Db | null = null;
  try {
    db = new Database(file, { fileMustExist: true });
    return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'xp_events'").get();
  } catch {
    return false; // unreadable: let the normal open report it
  } finally {
    db?.close();
  }
}

/** v1 wrote "YYYY-MM-DD HH:MM:SS" (UTC, from SQLite's datetime('now')); v2 stores ISO-8601 with a Z. */
export function v1Iso(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s) ? `${s.replace(" ", "T")}Z` : s;
  const ms = Date.parse(t);
  return isNaN(ms) ? null : new Date(ms).toISOString();
}

/** muscle_groups is JSON, except some seeded rows use single quotes and custom rows can be free text. */
export function v1Muscles(raw: string | null): { primary: string[]; secondary: string[] } {
  let list: string[] = [];
  try { list = JSON.parse(raw || "[]"); }
  catch {
    try { list = JSON.parse((raw ?? "").replace(/'/g, '"')); }
    catch { list = (raw ?? "").split(",").map(s => s.trim()); }
  }
  const out: string[] = [];
  for (const g of Array.isArray(list) ? list : []) {
    const k = String(g).toLowerCase().trim();
    const direct = MUSCLES.find(m => m.id === k.replace(/ /g, "_") || m.label.toLowerCase() === k)?.id;
    for (const m of direct ? [direct] : MUSCLE_MAP[k] ?? []) if (!out.includes(m)) out.push(m);
  }
  // v1 kept one flat list, main muscle first.
  return { primary: out.slice(0, 1), secondary: out.slice(1) };
}

/** "8-12", "8–12", "10" → rep range. Anything else (AMRAP) has none. */
export function v1Reps(s: string | null | undefined): [number | null, number | null] {
  const m = (s ?? "").match(/^\s*(\d+)\s*(?:[-–—]|to)\s*(\d+)\s*$/i);
  if (m) { const a = +m[1], b = +m[2]; return a <= b ? [a, b] : [b, a]; }
  const one = (s ?? "").match(/^\s*(\d+)\s*$/);
  return one ? [+one[1], +one[1]] : [null, null];
}

function envUnit<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const v = process.env[name]?.trim().toLowerCase();
  if (!v) return fallback;
  if ((allowed as readonly string[]).includes(v)) return v as T;
  // Guessing here would silently corrupt every number, so stop instead.
  throw new Error(`${name} must be one of ${allowed.join(", ")} (got "${v}")`);
}

export function migrateFromV1(file: string, prepare: (db: Db) => void): void {
  const weightUnit = envUnit<WeightUnit>("V1_WEIGHT_UNIT", ["lb", "kg"], "lb");
  const distanceUnit = envUnit<DistanceUnit>("V1_DISTANCE_UNIT", ["mi", "km"], "mi");
  console.log(`[migrate] v1 database found at ${file}. Reading weights as ${weightUnit}, distances as ${distanceUnit}.`);

  // Fold the WAL into the main file first, or copying just that file would lose recent writes.
  const walDb = new Database(file);
  walDb.pragma("wal_checkpoint(TRUNCATE)");
  walDb.close();

  const backup = path.join(path.dirname(file), "astrofit.v1.bak.db");
  // A backup already there is from an earlier attempt and is the older copy, so keep it.
  if (!fs.existsSync(backup)) fs.copyFileSync(file, backup);

  const tmp = `${file}.migrating`;
  for (const f of [tmp, `${tmp}-journal`]) fs.rmSync(f, { force: true });

  const src = new Database(file, { readonly: true });
  const dst = new Database(tmp);
  try {
    dst.pragma("foreign_keys = ON");
    prepare(dst);
    const counts = dst.transaction(() => convert(src, dst, weightUnit, distanceUnit))();
    src.close();
    dst.close();
    // Clear v1's side files, then swap in the finished database in one step.
    for (const f of [`${file}-wal`, `${file}-shm`]) fs.rmSync(f, { force: true });
    fs.renameSync(tmp, file);
    console.log(`[migrate] Done. Original kept at ${backup}.`, JSON.stringify(counts));
  } catch (e) {
    if (src.open) src.close();
    if (dst.open) dst.close();
    fs.rmSync(tmp, { force: true });
    console.error("[migrate] Failed. The v1 database was not changed.");
    throw e;
  }
}

type V1Exercise = { id: number; name: string; category: string; muscle_groups: string | null; equipment: string | null; is_builtin: number; created_by: number | null };
type V1Set = { weight: number | null; reps: number | null; duration_seconds: number | null; distance_km: number | null; rpe: number | null; is_warmup: number; completed_at: string | null };
type Dest = { kind: "lift"; id: number; logType: string } | { kind: "cardio"; id: number };

function convert(src: Db, dst: Db, wu: WeightUnit, du: DistanceUnit) {
  const counts = { users: 0, exercises: 0, routines: 0, workouts: 0, cardio: 0, droppedEmptyWorkouts: 0, closedOpenWorkouts: 0, droppedUnfinishedSets: 0, repsReadAsSeconds: 0 };
  const now = new Date().toISOString();

  // ── Users: ids are kept so sessions from before the upgrade stay signed in ──
  const taken = new Set<string>();
  for (const u of src.prepare("SELECT * FROM users ORDER BY id").all() as { id: number; username: string; password: string; is_admin: number; created_at: string }[]) {
    // v1 usernames were case-sensitive and v2's aren't, so "Bob" and "bob" can't both stay.
    let name = u.username;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${u.username}_${n}`;
    if (name !== u.username) console.warn(`[migrate] Username "${u.username}" clashes with another account; it is now "${name}".`);
    taken.add(name.toLowerCase());
    dst.prepare("INSERT INTO users (id, username, password, is_admin, weight_unit, distance_unit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(u.id, name, u.password, u.is_admin ? 1 : 0, wu, du, v1Iso(u.created_at) ?? now);
    counts.users++;
  }

  // ── Exercises: built-ins map onto the library; the rest become per-user custom exercises ──
  const v1Ex = new Map((src.prepare("SELECT * FROM exercises").all() as V1Exercise[]).map(e => [e.id, e]));
  const builtinId = (name: string, eq: string) =>
    (dst.prepare("SELECT id, log_type FROM exercises WHERE is_builtin = 1 AND name = ? AND equipment = ?").get(name, eq) as { id: number; log_type: string } | undefined);
  const activityId = (name: string) => (dst.prepare("SELECT id FROM activity_types WHERE is_builtin = 1 AND name = ? COLLATE NOCASE").get(name) as { id: number } | undefined)?.id;

  const usedSets = src.prepare(`SELECT ws.weight, ws.reps, ws.duration_seconds FROM workout_sets ws JOIN workout_exercises we ON we.id = ws.workout_exercise_id
    JOIN workouts w ON w.id = we.workout_id WHERE we.exercise_id = ? AND w.user_id = ? AND ws.completed = 1`);

  function customCopy(userId: number, e: V1Exercise): Dest {
    const key = `${userId}:${e.id}:copy`;
    const hit = memo.get(key);
    if (hit) return hit;
    const known = ["barbell", "dumbbell", "cable", "machine", "smith", "bodyweight", "kettlebell", "band"];
    const eqRaw = (e.equipment ?? "").toLowerCase();
    const equipment = known.includes(eqRaw) ? eqRaw : e.category === "bodyweight" ? "bodyweight" : "other";
    const b = builtinId(e.name, equipment);
    let d: Dest;
    if (b) d = { kind: "lift", id: b.id, logType: b.log_type };
    else {
      const rows = usedSets.all(e.id, userId) as V1Set[];
      const logType = rows.some(s => (s.weight ?? 0) > 0) ? "weight_reps"
        : rows.some(s => (s.reps ?? 0) > 0) ? "reps"
        : rows.some(s => (s.duration_seconds ?? 0) > 0) ? "time"
        : e.category === "bodyweight" ? "reps" : e.category === "cardio" ? "time" : "weight_reps";
      const m = v1Muscles(e.muscle_groups);
      const id = Number(dst.prepare("INSERT INTO exercises (name, equipment, primary_muscles, secondary_muscles, log_type, is_builtin, created_by) VALUES (?, ?, ?, ?, ?, 0, ?)")
        .run(e.name, equipment, JSON.stringify(m.primary), JSON.stringify(m.secondary), logType, userId).lastInsertRowid);
      counts.exercises++;
      d = { kind: "lift", id, logType };
    }
    memo.set(key, d);
    return d;
  }

  const memo = new Map<string, Dest>();
  const customActivity = new Map<string, number>();

  function activityFor(userId: number, name: string, hasDistance: boolean) {
    const b = activityId(name);
    if (b) return b;
    const key = `${userId}:${name.toLowerCase()}`;
    let id = customActivity.get(key);
    if (!id) {
      id = Number(dst.prepare("INSERT INTO activity_types (name, has_distance, icon, is_builtin, created_by) VALUES (?, ?, 'other', 0, ?)").run(name, hasDistance ? 1 : 0, userId).lastInsertRowid);
      customActivity.set(key, id);
    }
    return id;
  }

  /** Where a v1 exercise goes. Cardio-like ones are activities only if they carry time or distance (or it's a template). */
  function destFor(userId: number, exId: number, cardioData: boolean): Dest | null {
    const e = v1Ex.get(exId);
    if (!e) return null;
    const cardioName = e.is_builtin ? CARDIO_EXERCISES[e.name] : e.category === "cardio" ? e.name : undefined;
    if (cardioName && cardioData) return { kind: "cardio", id: activityFor(userId, cardioName, activityId(cardioName) == null) };
    if (e.is_builtin && LIFTS[e.name]) {
      const b = builtinId(...LIFTS[e.name]);
      if (b) return { kind: "lift", id: b.id, logType: b.log_type };
    }
    return customCopy(userId, e);
  }

  // ── Templates → routines ──
  const routineIds = new Map<number, number>();
  const insRB = dst.prepare(`INSERT INTO routine_blocks (routine_id, kind, position, exercise_id, activity_type_id, sets_count, rep_min, rep_max, target_weight_kg, rest_s, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const t of src.prepare("SELECT * FROM templates ORDER BY id").all() as { id: number; user_id: number; name: string; description: string | null; created_at: string; updated_at: string }[]) {
    const rid = Number(dst.prepare("INSERT INTO routines (user_id, name, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
      .run(t.user_id, t.name, t.description, v1Iso(t.created_at) ?? now, v1Iso(t.updated_at) ?? now).lastInsertRowid);
    routineIds.set(t.id, rid);
    counts.routines++;
    const rows = src.prepare("SELECT * FROM template_exercises WHERE template_id = ? ORDER BY order_index, id").all(t.id) as
      { exercise_id: number; sets: number; target_reps: string | null; target_weight: number | null; rest_seconds: number; notes: string | null }[];
    let pos = 0;
    for (const r of rows) {
      const d = destFor(t.user_id, r.exercise_id, true);
      if (!d) continue;
      if (d.kind === "cardio") insRB.run(rid, "cardio", pos++, null, d.id, 1, null, null, null, null, r.notes);
      else {
        const [lo, hi] = v1Reps(r.target_reps);
        // A target like "AMRAP" has no range to store, so keep the text.
        const note = lo == null && r.target_reps?.trim() ? [r.target_reps.trim(), r.notes].filter(Boolean).join(" · ") : r.notes;
        insRB.run(rid, "lift", pos++, d.id, null, Math.min(20, Math.max(1, r.sets || 3)), lo, hi, r.target_weight ? toKg(r.target_weight, wu) : null, r.rest_seconds, note);
      }
    }
  }

  // ── Workouts → sessions ──
  const insS = dst.prepare("INSERT INTO sessions (user_id, routine_id, name, started_at, ended_at, notes, source, source_key) VALUES (?, ?, ?, ?, ?, ?, 'v1', ?)");
  const insLift = dst.prepare("INSERT INTO blocks (session_id, kind, position, exercise_id, notes) VALUES (?, 'lift', ?, ?, ?)");
  const insCB = dst.prepare("INSERT INTO blocks (session_id, kind, position, activity_type_id, notes) VALUES (?, 'cardio', ?, ?, ?)");
  const insSet = dst.prepare("INSERT INTO sets (block_id, position, kind, weight_kg, reps, duration_s, rpe, done, done_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)");
  const insC = dst.prepare("INSERT INTO cardio (block_id, duration_s, distance_m, elevation_m, route, done) VALUES (?, ?, ?, ?, ?, 1)");

  const workouts = src.prepare("SELECT * FROM workouts ORDER BY started_at, id").all() as
    { id: number; user_id: number; template_id: number | null; name: string; started_at: string; completed_at: string | null; duration_seconds: number | null; notes: string | null }[];
  const exOf = src.prepare("SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY order_index, id");
  const setsOf = src.prepare("SELECT * FROM workout_sets WHERE workout_exercise_id = ? ORDER BY set_number, id");

  for (const w of workouts) {
    const exs = (exOf.all(w.id) as { id: number; exercise_id: number; notes: string | null }[]).map(e => {
      const all = setsOf.all(e.id) as (V1Set & { completed: number })[];
      const sets = all.filter(s => s.completed);
      counts.droppedUnfinishedSets += all.length - sets.length;
      return { ...e, sets };
    }).filter(e => e.sets.length > 0);

    // v2 keeps only completed sets, so a workout without any has nothing to show.
    if (!exs.length) { counts.droppedEmptyWorkouts++; continue; }

    const started = v1Iso(w.started_at) ?? now;
    const lastSet = exs.flatMap(e => e.sets.map(s => v1Iso(s.completed_at))).filter(Boolean).sort().pop() ?? null;
    // Left open in v1 but has real sets: keep them, closed at the last set. v2 allows one open workout per user.
    if (!w.completed_at) counts.closedOpenWorkouts++;
    const ended = v1Iso(w.completed_at) ?? lastSet ?? started;
    const sid = Number(insS.run(w.user_id, w.template_id != null ? routineIds.get(w.template_id) ?? null : null, w.name, started, ended, w.notes, `workout:${w.id}`).lastInsertRowid);
    counts.workouts++;

    exs.forEach((e, pos) => {
      const hasCardioData = e.sets.some(s => (s.duration_seconds ?? 0) > 0 || (s.distance_km ?? 0) > 0);
      const d = destFor(w.user_id, e.exercise_id, hasCardioData);
      if (!d) return;
      if (d.kind === "cardio") {
        const bid = Number(insCB.run(sid, pos, d.id, e.notes).lastInsertRowid);
        const secs = e.sets.reduce((a, s) => a + (s.duration_seconds ?? 0), 0);
        const dist = e.sets.reduce((a, s) => a + (s.distance_km ?? 0), 0);
        insC.run(bid, secs || null, dist ? toM(dist, du) : null, null, null);
        return;
      }
      const bid = Number(insLift.run(sid, pos, d.id, e.notes).lastInsertRowid);
      e.sets.forEach((s, i) => {
        // v1's lift screen had no time field, so a Plank's seconds could only be typed into reps.
        let duration = s.duration_seconds ?? null;
        if (d.logType === "time" && duration == null && s.reps) { duration = s.reps; counts.repsReadAsSeconds++; }
        insSet.run(bid, i, s.is_warmup ? "warmup" : "normal", s.weight ? toKg(s.weight, wu) : null, s.reps ?? null, duration, s.rpe ?? null, v1Iso(s.completed_at) ?? ended);
      });
    });
  }

  // ── Cardio activities → cardio-only sessions ──
  for (const c of src.prepare("SELECT * FROM cardio_activities ORDER BY started_at, id").all() as
    { id: number; user_id: number; type: string; distance_km: number | null; duration_seconds: number; elevation_m: number | null; notes: string | null; gps_data: string | null; started_at: string; completed_at: string | null }[]) {
    const recorded = v1Iso(c.started_at) ?? now;
    const secs = c.duration_seconds ?? 0;
    // v1 saved cardio when it finished and let started_at default to that moment, so it's really the end time.
    const started = c.completed_at ? recorded : new Date(Date.parse(recorded) - secs * 1000).toISOString();
    const ended = v1Iso(c.completed_at) ?? recorded;
    const type = c.type?.trim() || "Other";
    const sid = Number(insS.run(c.user_id, null, type.slice(0, 100), started, ended, c.notes, `cardio:${c.id}`).lastInsertRowid);
    const bid = Number(insCB.run(sid, 0, activityFor(c.user_id, type, (c.distance_km ?? 0) > 0), null).lastInsertRowid);
    insC.run(bid, secs || null, c.distance_km ? toM(c.distance_km, du) : null, c.elevation_m ?? null, v1Route(c.gps_data));
    counts.cardio++;
  }

  return counts;
}

/** v1 stored [{lat, lon, ts, alt?}]; v2 stores [[lat, lon, t]]. A malformed route is dropped, keeping the activity. */
export function v1Route(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const pts = JSON.parse(raw);
    if (!Array.isArray(pts)) return null;
    const out = pts.filter(p => typeof p?.lat === "number" && typeof p?.lon === "number").map(p => [p.lat, p.lon, Number(p.ts) || 0]);
    return out.length ? JSON.stringify(out) : null;
  } catch { return null; }
}
