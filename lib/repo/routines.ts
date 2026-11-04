import { db, nowIso } from "../db";
import { bad, notFound } from "../api";
import { getActivity, getExerciseRow, listActivities, listExercises } from "./exercises";
import { ownSession } from "./sessions";
import type { RoutineBlockDTO, RoutineDTO } from "../types";

type RB = {
  id: number; routine_id: number; kind: "lift" | "cardio"; position: number; superset: number | null;
  exercise_id: number | null; activity_type_id: number | null; sets_count: number; rep_min: number | null; rep_max: number | null;
  target_weight_kg: number | null; rest_s: number | null; target_duration_s: number | null; target_distance_m: number | null; notes: string | null;
};

export function listRoutines(userId: number): RoutineDTO[] {
  const rows = db.prepare(`SELECT r.*, p.name pname,
      (SELECT MAX(started_at) FROM sessions s WHERE s.routine_id = r.id AND s.ended_at IS NOT NULL) last
    FROM routines r LEFT JOIN programs p ON p.id = r.program_id
    WHERE r.user_id = ? ORDER BY r.program_id IS NOT NULL, r.updated_at DESC`).all(userId) as
    { id: number; name: string; notes: string | null; program_id: number | null; pname: string | null; updated_at: string; last: string | null }[];
  const ex = new Map(listExercises(userId).map(e => [e.id, e]));
  const ac = new Map(listActivities(userId).map(a => [a.id, a]));
  return rows.map(r => ({
    id: r.id, name: r.name, notes: r.notes, programId: r.program_id, programName: r.pname, updatedAt: r.updated_at, lastDone: r.last,
    blocks: (db.prepare("SELECT * FROM routine_blocks WHERE routine_id = ? ORDER BY position, id").all(r.id) as RB[]).map(b => toDTO(b, ex, ac)),
  }));
}

function toDTO(b: RB, ex: Map<number, any>, ac: Map<number, any>): RoutineBlockDTO {
  return {
    id: b.id, kind: b.kind, superset: b.superset, exerciseId: b.exercise_id, activityTypeId: b.activity_type_id,
    exercise: b.exercise_id ? ex.get(b.exercise_id) ?? null : null,
    activity: b.activity_type_id ? ac.get(b.activity_type_id) ?? null : null,
    setsCount: b.sets_count, repMin: b.rep_min, repMax: b.rep_max, targetWeightKg: b.target_weight_kg, restS: b.rest_s,
    targetDurationS: b.target_duration_s, targetDistanceM: b.target_distance_m, notes: b.notes,
  };
}

export function getRoutine(userId: number, id: number): RoutineDTO {
  const r = listRoutines(userId).find(x => x.id === id);
  if (!r) throw notFound("Routine not found");
  return r;
}

const n = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

export function writeBlocks(userId: number, routineId: number, blocks: RoutineBlockDTO[]) {
  if (!Array.isArray(blocks) || blocks.length > 60) throw bad("Invalid blocks");
  db.prepare("DELETE FROM routine_blocks WHERE routine_id = ?").run(routineId);
  const ins = db.prepare(`INSERT INTO routine_blocks (routine_id, kind, position, superset, exercise_id, activity_type_id, sets_count,
    rep_min, rep_max, target_weight_kg, rest_s, target_duration_s, target_distance_m, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  blocks.forEach((b, i) => {
    if (b.kind === "lift") {
      if (!b.exerciseId) throw bad("Exercise missing");
      getExerciseRow(userId, Number(b.exerciseId));
      const sets = Math.min(20, Math.max(1, Number(b.setsCount) || 3));
      const lo = n(b.repMin), hi = n(b.repMax);
      if (lo != null && hi != null && hi < lo) throw bad("Rep range top must be ≥ bottom");
      ins.run(routineId, "lift", i, b.superset ?? null, b.exerciseId, null, sets, lo, hi, n(b.targetWeightKg), n(b.restS), null, null, b.notes ?? null);
    } else if (b.kind === "cardio") {
      if (!b.activityTypeId) throw bad("Activity missing");
      getActivity(userId, Number(b.activityTypeId));
      ins.run(routineId, "cardio", i, null, null, b.activityTypeId, 1, null, null, null, null, n(b.targetDurationS), n(b.targetDistanceM), b.notes ?? null);
    } else throw bad("Invalid block kind");
  });
}

export function createRoutine(userId: number, name: string, notes: string | null, blocks: RoutineBlockDTO[], programId: number | null = null) {
  return db.transaction(() => {
    const info = db.prepare("INSERT INTO routines (user_id, program_id, name, notes) VALUES (?, ?, ?, ?)")
      .run(userId, programId, name.trim().slice(0, 100) || "Routine", notes);
    const id = Number(info.lastInsertRowid);
    writeBlocks(userId, id, blocks);
    return id;
  })();
}

export function updateRoutine(userId: number, id: number, p: { name?: string; notes?: string | null; blocks?: RoutineBlockDTO[] }) {
  const r = db.prepare("SELECT id FROM routines WHERE id = ? AND user_id = ?").get(id, userId);
  if (!r) throw notFound("Routine not found");
  db.transaction(() => {
    if (p.name !== undefined) db.prepare("UPDATE routines SET name = ? WHERE id = ?").run(p.name.trim().slice(0, 100) || "Routine", id);
    if (p.notes !== undefined) db.prepare("UPDATE routines SET notes = ? WHERE id = ?").run(p.notes, id);
    if (p.blocks) writeBlocks(userId, id, p.blocks);
    db.prepare("UPDATE routines SET updated_at = ? WHERE id = ?").run(nowIso(), id);
  })();
}

/** Turn a logged workout into a routine (sets count, rep ranges, rest, supersets). */
export function routineFromSession(userId: number, sessionId: number) {
  const s = ownSession(userId, sessionId);
  const blocks = db.prepare("SELECT * FROM blocks WHERE session_id = ? ORDER BY position, id").all(sessionId) as {
    id: number; kind: "lift" | "cardio"; superset: number | null; exercise_id: number | null; activity_type_id: number | null;
    rep_min: number | null; rep_max: number | null; rest_s: number | null; notes: string | null;
  }[];
  const out: RoutineBlockDTO[] = blocks.map(b => {
    if (b.kind === "lift") {
      const c = (db.prepare("SELECT COUNT(*) c FROM sets WHERE block_id = ? AND kind != 'warmup'").get(b.id) as { c: number }).c;
      return { kind: "lift", superset: b.superset, exerciseId: b.exercise_id, activityTypeId: null, setsCount: c || 3, repMin: b.rep_min, repMax: b.rep_max,
        targetWeightKg: null, restS: b.rest_s, targetDurationS: null, targetDistanceM: null, notes: b.notes };
    }
    const c = db.prepare("SELECT duration_s, distance_m FROM cardio WHERE block_id = ?").get(b.id) as { duration_s: number | null; distance_m: number | null } | undefined;
    return { kind: "cardio", superset: null, exerciseId: null, activityTypeId: b.activity_type_id, setsCount: 1, repMin: null, repMax: null,
      targetWeightKg: null, restS: null, targetDurationS: c?.duration_s ?? null, targetDistanceM: c?.distance_m ?? null, notes: b.notes };
  });
  return createRoutine(userId, s.name, null, out);
}
