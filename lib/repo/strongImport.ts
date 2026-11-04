import crypto from "crypto";
import { db, nowIso } from "../db";
import { bad } from "../api";
import { EQUIPMENT } from "../exerciseSeed";
import { parseStrong, StrongFormatError, type StrongFile } from "../strong";
import { M_PER_MI, toKg, toM, type DistanceUnit, type WeightUnit } from "../units";
import type { ActivityDTO, ExerciseDTO } from "../types";
import { getActivity, getExerciseRow, listActivities, listExercises } from "./exercises";

/** Where a Strong exercise goes: `ex:<id>`, `act:<id>`, `new-ex`, `new-act` or `skip`. */
export type Target = string;

export type ExerciseMatch = {
  name: string; sets: number; workouts: number; shape: "lift" | "cardio"; target: Target; matched: boolean; hasWeightedDistance: boolean;
};

const norm = (s: string) => s.toLowerCase().replace(/biceps/g, "bicep").replace(/[^a-z0-9]/g, "").replace(/s$/, "");

const EQUIP_WORDS: Record<string, string> = {
  barbell: "barbell", dumbbell: "dumbbell", cable: "cable", machine: "machine", "smith machine": "smith", smith: "smith",
  bodyweight: "bodyweight", "weighted bodyweight": "bodyweight", "assisted bodyweight": "machine", kettlebell: "kettlebell",
  band: "band", "resistance band": "band", other: "other",
};

/** "Triceps Pushdown (Cable - Straight Bar)" → base + equipment id. */
export function splitName(name: string): { base: string; equipment: string | null } {
  const m = name.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (!m) return { base: name.trim(), equipment: null };
  const eq = EQUIP_WORDS[m[2].split(" - ")[0].trim().toLowerCase()];
  return eq ? { base: m[1].trim(), equipment: eq } : { base: name.trim(), equipment: null };
}

const EXERCISE_ALIASES: Record<string, string> = {
  "strict military press": "Overhead Press",
  "military press": "Overhead Press",
  "seated overhead press": "Overhead Press",
  "pull up assisted": "Pull Up (Assisted)",
  "sit up": "Crunch",
};

const ACTIVITY_ALIASES: Record<string, string> = {
  "running treadmill": "Treadmill", "treadmill running": "Treadmill", "cycling indoor": "Stationary Bike", "indoor cycling": "Stationary Bike",
  "rowing machine": "Rowing", "elliptical trainer": "Elliptical", "stair stepper": "Stair Climber", "climbing stair": "Stair Climber",
  "stairs": "Stair Climber", "run": "Running", "walk": "Walking", "bike": "Cycling", "swim": "Swimming", "row": "Rowing", "hike": "Hiking",
};

function matchExercise(name: string, lib: ExerciseDTO[]): ExerciseDTO | null {
  const lower = name.toLowerCase();
  const exact = lib.find(e => e.displayName.toLowerCase() === lower);
  if (exact) return exact;
  const { base, equipment } = splitName(name);
  const alias = EXERCISE_ALIASES[lower.replace(/[()]/g, "")] ?? EXERCISE_ALIASES[base.toLowerCase().replace(/[()-]/g, " ").replace(/\s+/g, " ").trim()];
  const n = norm(alias ?? base);
  const same = lib.filter(e => norm(e.name) === n);
  if (equipment) return same.find(e => e.equipment === equipment) ?? null;
  // No equipment named: only safe when the name alone is unambiguous.
  return same.length === 1 ? same[0] : same.find(e => e.equipment === "bodyweight") ?? null;
}

function matchActivity(name: string, acts: ActivityDTO[]): ActivityDTO | null {
  const key = name.toLowerCase().replace(/[()]/g, " ").replace(/\s+/g, " ").trim();
  const alias = ACTIVITY_ALIASES[key];
  const n = norm(alias ?? name);
  return acts.find(a => norm(a.name) === n) ?? null;
}

function analyse(file: StrongFile, lib: ExerciseDTO[], acts: ActivityDTO[]): ExerciseMatch[] {
  const stats = new Map<string, { sets: number; workouts: Set<string>; weight: boolean; reps: boolean; dist: boolean; secs: boolean; weightedDist: boolean }>();
  for (const w of file.workouts) for (const b of w.blocks) {
    let s = stats.get(b.exercise);
    if (!s) stats.set(b.exercise, (s = { sets: 0, workouts: new Set(), weight: false, reps: false, dist: false, secs: false, weightedDist: false }));
    s.workouts.add(w.key);
    for (const x of b.sets) {
      s.sets++;
      s.weight ||= x.weight != null; s.reps ||= x.reps != null; s.dist ||= x.distance != null; s.secs ||= x.seconds != null;
      s.weightedDist ||= x.distance != null && (x.weight != null || x.reps != null);
    }
  }
  return [...stats.entries()].map(([name, s]) => {
    const shape: "lift" | "cardio" = (s.dist || s.secs) && !s.weight && !s.reps ? "cardio" : "lift";
    const ex = matchExercise(name, lib);
    let target: Target, matched = true;
    if (shape === "cardio") {
      const act = matchActivity(name, acts);
      // Timed holds like Plank also have seconds and no weight, but they aren't cardio.
      if (act) target = `act:${act.id}`;
      else if (ex?.logType === "time") target = `ex:${ex.id}`;
      else { target = "new-act"; matched = false; }
    } else if (ex) target = `ex:${ex.id}`;
    else { target = "new-ex"; matched = false; }
    return { name, sets: s.sets, workouts: s.workouts.size, shape, target, matched, hasWeightedDistance: s.weightedDist };
  }).sort((a, b) => Number(a.matched) - Number(b.matched) || b.sets - a.sets);
}

function parse(csv: unknown, tz: string) {
  if (typeof csv !== "string" || !csv.trim()) throw bad("Choose a CSV file first");
  if (csv.length > 50_000_000) throw bad("That file is too large");
  try { return parseStrong(csv, tz); }
  catch (e) { if (e instanceof StrongFormatError) throw bad(e.message); throw e; }
}

const hashOf = (csv: string) => crypto.createHash("sha256").update(csv).digest("hex");

function existingKeys(userId: number) {
  return new Set((db.prepare("SELECT source_key k FROM sessions WHERE user_id = ? AND source = 'strong' AND source_key IS NOT NULL").all(userId) as { k: string }[]).map(r => r.k));
}

export function previewStrong(userId: number, csv: unknown, tz: string) {
  const file = parse(csv, tz);
  if (!file.workouts.length) throw bad("No workouts found in that file");
  const known = existingKeys(userId);
  const lib = listExercises(userId);
  const fresh = file.workouts.filter(w => !known.has(w.key));
  const weights = file.workouts.flatMap(w => w.blocks.flatMap(b => b.sets.map(s => s.weight ?? 0)));
  const setCount = file.workouts.reduce((n, w) => n + w.blocks.reduce((k, b) => k + b.sets.length, 0), 0);
  return {
    delimiter: file.delimiter === "\t" ? "tab" : file.delimiter,
    rows: file.dataRows, sets: setCount, workouts: file.workouts.length, newWorkouts: fresh.length, duplicates: file.workouts.length - fresh.length,
    from: file.workouts[0].startedAt, to: file.workouts[file.workouts.length - 1].startedAt,
    restRows: file.restRows, emptySets: file.emptySets, ignoredRows: file.ignoredRows, badDates: file.badDates,
    heaviest: Math.max(0, ...weights),
    weightUnit: file.weightUnit, distanceUnit: file.distanceUnit,
    sameFileImported: !!db.prepare("SELECT 1 FROM imports WHERE user_id = ? AND source = 'strong' AND file_hash = ?").get(userId, hashOf(csv as string)),
    exercises: analyse(file, lib, listActivities(userId)),
  };
}

export function commitStrong(userId: number, b: { csv: unknown; tz: string; weightUnit: unknown; distanceUnit: unknown; mapping: unknown }) {
  const file = parse(b.csv, b.tz);
  if (b.weightUnit !== "lb" && b.weightUnit !== "kg") throw bad("Choose lb or kg");
  if (b.distanceUnit !== "mi" && b.distanceUnit !== "km") throw bad("Choose mi or km");
  const wu: WeightUnit = b.weightUnit;
  const du: DistanceUnit = b.distanceUnit;
  const mapping = (b.mapping && typeof b.mapping === "object" ? b.mapping : {}) as Record<string, Target>;
  const auto = analyse(file, listExercises(userId), listActivities(userId));
  const targetFor = new Map(auto.map(m => [m.name, mapping[m.name] ?? m.target]));

  const toKgRow = (v: number | null, u: "lb" | "kg" | null) => (v == null ? null : toKg(v, u ?? wu));
  const toMRow = (v: number, u: "mi" | "km" | "m" | null) => (u === "m" ? v : u === "mi" ? v * M_PER_MI : u === "km" ? v * 1000 : toM(v, du));

  return db.transaction(() => {
    // Resolve every target first, creating what's new, so a bad mapping fails before anything is written.
    const dest = new Map<string, { kind: "lift"; id: number; timed: boolean } | { kind: "cardio"; id: number } | { kind: "skip" }>();
    let createdExercises = 0, createdActivities = 0;
    for (const m of auto) {
      const t = targetFor.get(m.name)!;
      if (t === "skip") dest.set(m.name, { kind: "skip" });
      else if (t.startsWith("ex:")) {
        const row = getExerciseRow(userId, Number(t.slice(3)));
        dest.set(m.name, { kind: "lift", id: row.id, timed: row.log_type === "time" });
      } else if (t.startsWith("act:")) dest.set(m.name, { kind: "cardio", id: getActivity(userId, Number(t.slice(4))).id });
      else if (t === "new-ex") {
        const { base, equipment } = splitName(m.name);
        const eq = equipment && EQUIPMENT.some(e => e.id === equipment) ? equipment : "other";
        const blocks = file.workouts.flatMap(w => w.blocks.filter(x => x.exercise === m.name));
        const sets = blocks.flatMap(x => x.sets);
        const logType = sets.some(s => s.weight != null) ? "weight_reps" : sets.some(s => s.reps != null) ? "reps" : sets.some(s => s.seconds != null) ? "time" : "weight_reps";
        const found = db.prepare("SELECT id, log_type FROM exercises WHERE name = ? COLLATE NOCASE AND equipment = ? AND created_by = ?").get(base, eq, userId) as { id: number; log_type: string } | undefined;
        let id = found?.id;
        if (!id) {
          id = Number(db.prepare("INSERT INTO exercises (name, equipment, log_type, is_builtin, created_by) VALUES (?, ?, ?, 0, ?)").run(base, eq, logType, userId).lastInsertRowid);
          createdExercises++;
        }
        dest.set(m.name, { kind: "lift", id, timed: (found?.log_type ?? logType) === "time" });
      } else if (t === "new-act") {
        const name = m.name.slice(0, 80);
        const found = db.prepare("SELECT id FROM activity_types WHERE name = ? COLLATE NOCASE AND (is_builtin = 1 OR created_by = ?)").get(name, userId) as { id: number } | undefined;
        let id = found?.id;
        if (!id) {
          const hasDist = file.workouts.some(w => w.blocks.some(x => x.exercise === m.name && x.sets.some(s => s.distance != null)));
          id = Number(db.prepare("INSERT INTO activity_types (name, has_distance, icon, is_builtin, created_by) VALUES (?, ?, 'other', 0, ?)").run(name, hasDist ? 1 : 0, userId).lastInsertRowid);
          createdActivities++;
        }
        dest.set(m.name, { kind: "cardio", id });
      } else throw bad(`Unknown mapping for ${m.name}`);
    }

    const known = existingKeys(userId);
    const insSession = db.prepare("INSERT INTO sessions (user_id, name, started_at, ended_at, notes, source, source_key) VALUES (?, ?, ?, ?, ?, 'strong', ?)");
    const insLift = db.prepare("INSERT INTO blocks (session_id, kind, position, exercise_id, rest_s, notes) VALUES (?, 'lift', ?, ?, ?, ?)");
    const insCardioBlock = db.prepare("INSERT INTO blocks (session_id, kind, position, activity_type_id, notes) VALUES (?, 'cardio', ?, ?, ?)");
    const insSet = db.prepare("INSERT INTO sets (block_id, position, kind, weight_kg, reps, duration_s, rpe, done, done_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)");
    const insCardio = db.prepare("INSERT INTO cardio (block_id, duration_s, distance_m, done) VALUES (?, ?, ?, 1)");

    let imported = 0, skipped = 0, skippedEmpty = 0, sets = 0, cardio = 0, distanceDropped = 0;
    for (const w of file.workouts) {
      if (known.has(w.key)) { skipped++; continue; }
      const blocks = w.blocks.filter(x => dest.get(x.exercise)?.kind !== "skip");
      if (!blocks.length) { skippedEmpty++; continue; }
      const ended = new Date(Date.parse(w.startedAt) + w.durationS * 1000).toISOString();
      const sid = Number(insSession.run(userId, w.name, w.startedAt, ended, w.notes, w.key).lastInsertRowid);
      known.add(w.key); // two workouts with the same date and name in one file count once
      blocks.forEach((x, pos) => {
        const d = dest.get(x.exercise)!;
        if (d.kind === "lift") {
          const bid = Number(insLift.run(sid, pos, d.id, x.restS, x.notes).lastInsertRowid);
          x.sets.forEach((s, i) => {
            insSet.run(bid, i, s.kind, toKgRow(s.weight, s.weightUnit), s.reps != null ? Math.round(s.reps) : null, s.seconds != null ? Math.round(s.seconds) : null, s.rpe, ended);
            sets++;
            if (s.distance != null) distanceDropped++;
          });
        } else if (d.kind === "cardio") {
          const bid = Number(insCardioBlock.run(sid, pos, d.id, x.notes).lastInsertRowid);
          // A cardio block holds one entry, so repeated rows (intervals) add up.
          const secs = x.sets.reduce((a, s) => a + (s.seconds ?? 0), 0);
          const dist = x.sets.reduce((a, s) => a + (s.distance != null ? toMRow(s.distance, s.distanceUnit) : 0), 0);
          insCardio.run(bid, secs ? Math.round(secs) : null, dist || null);
          cardio++;
        }
      });
      imported++;
    }

    db.prepare("INSERT INTO imports (user_id, source, file_hash, sessions, skipped, imported_at) VALUES (?, 'strong', ?, ?, ?, ?)")
      .run(userId, hashOf(b.csv as string), imported, skipped, nowIso());
    return { imported, skipped, skippedEmpty, sets, cardio, createdExercises, createdActivities, distanceDropped };
  })();
}
