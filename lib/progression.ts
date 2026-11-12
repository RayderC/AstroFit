import { db } from "./db";
import { isUpperPattern } from "./exerciseSeed";
import { defaultIncrementKg, roundLoadable, type WeightUnit } from "./units";
import type { Suggestion } from "./types";

// Double progression: work within a rep range; once every working set at your top weight
// reaches the top of the range, add weight next session.

type WorkSet = { weight_kg: number; reps: number };

const WORKING = `s.done = 1 AND s.kind IN ('normal','failure') AND s.weight_kg > 0 AND s.reps > 0`;

/** Most recent finished session's working sets for an exercise (excluding a session). */
function lastWorkingSets(userId: number, exerciseId: number, excludeSessionId: number | null) {
  const block = db.prepare(`
    SELECT b.id, b.rep_min, b.rep_max, se.started_at
    FROM blocks b JOIN sessions se ON se.id = b.session_id
    WHERE se.user_id = ? AND b.exercise_id = ? AND se.ended_at IS NOT NULL AND se.id IS NOT ?
      AND EXISTS (SELECT 1 FROM sets s WHERE s.block_id = b.id AND ${WORKING})
    ORDER BY se.started_at DESC LIMIT 1`).get(userId, exerciseId, excludeSessionId) as
    { id: number; rep_min: number | null; rep_max: number | null; started_at: string } | undefined;
  if (!block) return null;
  const sets = db.prepare(`SELECT weight_kg, reps FROM sets s WHERE s.block_id = ? AND ${WORKING} ORDER BY position`).all(block.id) as WorkSet[];
  return { block, sets };
}

/**
 * How many sessions since your best on this lift, newest first. `bests` are each session's best estimated max.
 * A best within half a percent counts, so a tiny wobble isn't a new record or a miss.
 */
export function sessionsSinceBest(bests: number[]): number {
  if (!bests.length) return 0;
  const top = Math.max(...bests);
  return bests.findIndex(b => b >= top * 0.995);
}

const STALL_SESSIONS = 3;
const RECENT_DAYS = 60;

/** Each recent finished session's best estimated max (Epley) on this lift, newest first. */
function recentBests(userId: number, exerciseId: number, excludeSessionId: number | null): number[] {
  const since = new Date(Date.now() - RECENT_DAYS * 86400_000).toISOString();
  return (db.prepare(`
    SELECT MAX(s.weight_kg * (1 + s.reps / 30.0)) AS best
    FROM sets s JOIN blocks b ON b.id = s.block_id JOIN sessions se ON se.id = b.session_id
    WHERE se.user_id = ? AND b.exercise_id = ? AND se.ended_at IS NOT NULL AND se.id IS NOT ? AND se.started_at >= ? AND ${WORKING}
    GROUP BY se.id ORDER BY se.started_at DESC LIMIT 8`).all(userId, exerciseId, excludeSessionId, since) as { best: number }[]).map(r => r.best);
}

/** Infer a rep range from the reps you usually do on this exercise. */
export function inferRange(userId: number, exerciseId: number): [number, number] | null {
  const reps = (db.prepare(`
    SELECT s.reps FROM sets s JOIN blocks b ON b.id = s.block_id JOIN sessions se ON se.id = b.session_id
    WHERE se.user_id = ? AND b.exercise_id = ? AND se.ended_at IS NOT NULL AND ${WORKING}
    ORDER BY se.started_at DESC LIMIT 15`).all(userId, exerciseId) as { reps: number }[]).map(r => r.reps).sort((a, b) => a - b);
  if (!reps.length) return null;
  const median = reps[Math.floor(reps.length / 2)];
  return rangeAround(median);
}

export function rangeAround(reps: number): [number, number] {
  if (reps <= 5) return [3, 5];
  if (reps <= 8) return [5, 8];
  if (reps <= 12) return [8, 12];
  if (reps <= 15) return [12, 15];
  return [15, 20];
}

export function incrementFor(userId: number, exerciseId: number, unit: WeightUnit): number {
  const ex = db.prepare("SELECT pattern FROM exercises WHERE id = ?").get(exerciseId) as { pattern: string | null } | undefined;
  const pref = db.prepare("SELECT increment_kg FROM exercise_prefs WHERE user_id = ? AND exercise_id = ?").get(userId, exerciseId) as { increment_kg: number | null } | undefined;
  return pref?.increment_kg ?? defaultIncrementKg(isUpperPattern(ex?.pattern), unit);
}

export function suggest(
  userId: number,
  exerciseId: number,
  opts: { repMin?: number | null; repMax?: number | null; excludeSessionId?: number | null; unit: WeightUnit },
): Suggestion | null {
  const ex = db.prepare("SELECT log_type FROM exercises WHERE id = ?").get(exerciseId) as { log_type: string } | undefined;
  if (!ex || ex.log_type !== "weight_reps") return null;

  const last = lastWorkingSets(userId, exerciseId, opts.excludeSessionId ?? null);
  if (!last || !last.sets.length) return null;

  let repMin = opts.repMin ?? last.block.rep_min ?? null;
  let repMax = opts.repMax ?? last.block.rep_max ?? null;
  let inferred = false;
  if (repMin == null || repMax == null) {
    const r = inferRange(userId, exerciseId);
    if (!r) return null;
    [repMin, repMax] = [repMin ?? r[0], repMax ?? r[1]];
    inferred = true;
  }
  if (repMax < repMin) repMax = repMin;

  const top = Math.max(...last.sets.map(s => s.weight_kg));
  const atTop = last.sets.filter(s => Math.abs(s.weight_kg - top) < 0.01);

  let status: Suggestion["status"] = "build";
  if (atTop.every(s => s.reps >= repMax!)) status = "increase";
  else if (atTop.some(s => s.reps < repMin!)) status = "hold";

  const inc = incrementFor(userId, exerciseId, opts.unit);
  // Stuck: three sessions or more without a new best, and not about to add weight anyway. Resetting about 10%
  // lighter and building back up usually gets a lift moving again.
  const since = status === "increase" ? 0 : sessionsSinceBest(recentBests(userId, exerciseId, opts.excludeSessionId ?? null));
  const stalled = since >= STALL_SESSIONS ? { sessions: since, resetWeightKg: roundLoadable(top * 0.9, opts.unit) } : null;
  return {
    stalled,
    status,
    repMin,
    repMax,
    inferred,
    lastWeightKg: top,
    nextWeightKg: status === "increase" ? roundLoadable(top + inc, opts.unit) : top,
    lastDate: last.block.started_at,
  };
}

/** Exercises from recent training that are due for more weight. */
export function readyToIncrease(userId: number, unit: WeightUnit, days = 45) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = db.prepare(`
    SELECT b.exercise_id AS id, MAX(se.started_at) AS last
    FROM blocks b JOIN sessions se ON se.id = b.session_id
    WHERE se.user_id = ? AND se.ended_at IS NOT NULL AND se.started_at >= ? AND b.kind = 'lift'
    GROUP BY b.exercise_id ORDER BY last DESC`).all(userId, since) as { id: number; last: string }[];
  const out: { exerciseId: number; suggestion: Suggestion }[] = [];
  for (const r of rows) {
    const s = suggest(userId, r.id, { unit });
    if (s?.status === "increase") out.push({ exerciseId: r.id, suggestion: s });
  }
  return out;
}
