import { db, nowIso } from "../db";
import { bad, notFound, type UserRow } from "../api";
import { suggest } from "../progression";
import { e1rm } from "../units";
import { getActivity, getExerciseRow, getPrefs, setPrefs, toExerciseDTO, type ExerciseRow } from "./exercises";
import { exerciseDisplayName } from "../exerciseSeed";
import type {
  BlockDTO, CardioDTO, PrevSet, RecordHit, RoutineBlockDTO, SessionDTO, SessionSummary, SetDTO, SetKind,
} from "../types";

type SessionRow = {
  id: number; user_id: number; routine_id: number | null; name: string; started_at: string; ended_at: string | null;
  paused_s: number; paused_at: string | null; notes: string | null; source: string; source_key: string | null;
};
type BlockRow = {
  id: number; session_id: number; kind: "lift" | "cardio"; position: number; superset: number | null;
  exercise_id: number | null; activity_type_id: number | null; rep_min: number | null; rep_max: number | null;
  rest_s: number | null; notes: string | null;
};
type SetRow = {
  id: number; block_id: number; position: number; kind: SetKind; weight_kg: number | null; reps: number | null;
  duration_s: number | null; rpe: number | null; done: number; done_at: string | null;
};
type CardioRow = {
  block_id: number; duration_s: number | null; distance_m: number | null; elevation_m: number | null;
  avg_hr: number | null; calories: number | null; route: string | null; done: number;
};

const toSet = (s: SetRow): SetDTO => ({
  id: s.id, position: s.position, kind: s.kind, weightKg: s.weight_kg, reps: s.reps,
  durationS: s.duration_s, rpe: s.rpe, done: !!s.done,
});

const toCardio = (c: CardioRow | undefined): CardioDTO => ({
  durationS: c?.duration_s ?? null, distanceM: c?.distance_m ?? null, elevationM: c?.elevation_m ?? null,
  avgHr: c?.avg_hr ?? null, calories: c?.calories ?? null,
  route: c?.route ? JSON.parse(c.route) : null, done: !!c?.done,
});

// ── Ownership lookups ────────────────────────────────────────────────────────

export function ownSession(userId: number, id: number): SessionRow {
  const s = db.prepare("SELECT * FROM sessions WHERE id = ? AND user_id = ?").get(id, userId) as SessionRow | undefined;
  if (!s) throw notFound("Workout not found");
  return s;
}

export function ownBlock(userId: number, id: number): BlockRow & { user_id: number } {
  const b = db.prepare(`SELECT b.*, s.user_id FROM blocks b JOIN sessions s ON s.id = b.session_id WHERE b.id = ? AND s.user_id = ?`)
    .get(id, userId) as (BlockRow & { user_id: number }) | undefined;
  if (!b) throw notFound("Exercise not found in workout");
  return b;
}

export function ownSet(userId: number, id: number): SetRow & { session_id: number } {
  const s = db.prepare(`SELECT st.*, b.session_id FROM sets st JOIN blocks b ON b.id = st.block_id
    JOIN sessions se ON se.id = b.session_id WHERE st.id = ? AND se.user_id = ?`).get(id, userId) as (SetRow & { session_id: number }) | undefined;
  if (!s) throw notFound("Set not found");
  return s;
}

// ── History lookups ──────────────────────────────────────────────────────────

/** Sets from the last finished session that included this exercise (Strong's "Previous" column). */
export function previousSets(userId: number, exerciseId: number, excludeSessionId: number | null): PrevSet[] {
  const b = db.prepare(`SELECT b.id FROM blocks b JOIN sessions se ON se.id = b.session_id
    WHERE se.user_id = ? AND b.exercise_id = ? AND se.ended_at IS NOT NULL AND se.id IS NOT ?
      AND EXISTS (SELECT 1 FROM sets s WHERE s.block_id = b.id AND s.done = 1)
    ORDER BY se.started_at DESC LIMIT 1`).get(userId, exerciseId, excludeSessionId) as { id: number } | undefined;
  if (!b) return [];
  return (db.prepare("SELECT kind, weight_kg, reps, duration_s FROM sets WHERE block_id = ? AND done = 1 ORDER BY position").all(b.id) as SetRow[])
    .map(s => ({ kind: s.kind, weightKg: s.weight_kg, reps: s.reps, durationS: s.duration_s }));
}

function previousCardio(userId: number, activityId: number, excludeSessionId: number) {
  const r = db.prepare(`SELECT c.duration_s, c.distance_m, se.started_at FROM cardio c JOIN blocks b ON b.id = c.block_id
    JOIN sessions se ON se.id = b.session_id WHERE se.user_id = ? AND b.activity_type_id = ? AND se.ended_at IS NOT NULL
      AND se.id != ? AND c.done = 1 ORDER BY se.started_at DESC LIMIT 1`).get(userId, activityId, excludeSessionId) as
    { duration_s: number | null; distance_m: number | null; started_at: string } | undefined;
  return r ? { durationS: r.duration_s, distanceM: r.distance_m, date: r.started_at } : null;
}

// ── Reads ────────────────────────────────────────────────────────────────────

export function getSession(user: UserRow, id: number): SessionDTO {
  const s = ownSession(user.id, id);
  const blocks = db.prepare("SELECT * FROM blocks WHERE session_id = ? ORDER BY position, id").all(id) as BlockRow[];
  const exCache = new Map<number, ExerciseRow>();
  const out: BlockDTO[] = blocks.map(b => {
    if (b.kind === "lift") {
      const exRow = exCache.get(b.exercise_id!) ?? (db.prepare("SELECT * FROM exercises WHERE id = ?").get(b.exercise_id) as ExerciseRow);
      exCache.set(exRow.id, exRow);
      const prefs = getPrefs(user.id, exRow.id);
      const sets = (db.prepare("SELECT * FROM sets WHERE block_id = ? ORDER BY position, id").all(b.id) as SetRow[]).map(toSet);
      return {
        id: b.id, kind: "lift", position: b.position, superset: b.superset,
        exercise: toExerciseDTO(exRow),
        repMin: b.rep_min, repMax: b.rep_max,
        restS: b.rest_s ?? prefs.restS ?? user.rest_default,
        notes: b.notes, stickyNote: prefs.note,
        sets,
        previous: previousSets(user.id, exRow.id, id),
        suggestion: suggest(user.id, exRow.id, { repMin: b.rep_min, repMax: b.rep_max, excludeSessionId: id, unit: user.weight_unit }),
      };
    }
    const c = db.prepare("SELECT * FROM cardio WHERE block_id = ?").get(b.id) as CardioRow | undefined;
    return {
      id: b.id, kind: "cardio", position: b.position, superset: null,
      activity: getActivity(user.id, b.activity_type_id!),
      notes: b.notes, cardio: toCardio(c),
      previous: previousCardio(user.id, b.activity_type_id!, id),
    };
  });
  return {
    id: s.id, name: s.name, routineId: s.routine_id, startedAt: s.started_at, endedAt: s.ended_at,
    pausedS: s.paused_s, pausedAt: s.paused_at, notes: s.notes, source: s.source, blocks: out,
  };
}

export function activeSession(userId: number) {
  return db.prepare("SELECT id, name, started_at FROM sessions WHERE user_id = ? AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1")
    .get(userId) as { id: number; name: string; started_at: string } | undefined;
}

export function durationOf(s: { started_at: string; ended_at: string | null; paused_s: number; paused_at?: string | null }) {
  const end = s.ended_at ? Date.parse(s.ended_at) : Date.now();
  let paused = s.paused_s;
  if (!s.ended_at && s.paused_at) paused += (Date.now() - Date.parse(s.paused_at)) / 1000;
  return Math.max(0, Math.round((end - Date.parse(s.started_at)) / 1000 - paused));
}

/** Compact list rows for history/today. */
export function listSessions(userId: number, opts: { from?: string; to?: string; limit?: number; finishedOnly?: boolean } = {}): SessionSummary[] {
  const where = ["se.user_id = ?"];
  const args: unknown[] = [userId];
  if (opts.finishedOnly !== false) where.push("se.ended_at IS NOT NULL");
  if (opts.from) { where.push("se.started_at >= ?"); args.push(opts.from); }
  if (opts.to) { where.push("se.started_at < ?"); args.push(opts.to); }
  const rows = db.prepare(`SELECT se.* FROM sessions se WHERE ${where.join(" AND ")} ORDER BY se.started_at DESC ${opts.limit ? "LIMIT " + Number(opts.limit) : ""}`)
    .all(...args) as SessionRow[];
  if (!rows.length) return [];
  const ids = rows.map(r => r.id);
  const ph = ids.map(() => "?").join(",");
  const lift = db.prepare(`SELECT b.session_id, COUNT(st.id) n, COALESCE(SUM(st.weight_kg * st.reps), 0) vol
    FROM blocks b JOIN sets st ON st.block_id = b.id
    WHERE b.session_id IN (${ph}) AND st.done = 1 AND st.kind != 'warmup' GROUP BY b.session_id`).all(...ids) as { session_id: number; n: number; vol: number }[];
  const cardio = db.prepare(`SELECT b.session_id, COALESCE(SUM(c.duration_s),0) s, COALESCE(SUM(c.distance_m),0) m, COUNT(*) n
    FROM blocks b JOIN cardio c ON c.block_id = b.id WHERE b.session_id IN (${ph}) AND c.done = 1 GROUP BY b.session_id`).all(...ids) as { session_id: number; s: number; m: number; n: number }[];
  const names = db.prepare(`SELECT b.session_id, b.position, e.name ename, e.equipment, a.name aname
    FROM blocks b LEFT JOIN exercises e ON e.id = b.exercise_id LEFT JOIN activity_types a ON a.id = b.activity_type_id
    WHERE b.session_id IN (${ph}) ORDER BY b.session_id, b.position`).all(...ids) as { session_id: number; ename: string | null; equipment: string | null; aname: string | null }[];
  const L = new Map(lift.map(x => [x.session_id, x]));
  const C = new Map(cardio.map(x => [x.session_id, x]));
  const N = new Map<number, string[]>();
  for (const n of names) {
    const a = N.get(n.session_id) ?? [];
    a.push(n.ename ? exerciseDisplayName(n.ename, n.equipment) : n.aname ?? "?");
    N.set(n.session_id, a);
  }
  return rows.map(r => ({
    id: r.id, name: r.name, startedAt: r.started_at, endedAt: r.ended_at,
    durationS: durationOf(r),
    liftSets: L.get(r.id)?.n ?? 0, volumeKg: L.get(r.id)?.vol ?? 0,
    cardioS: C.get(r.id)?.s ?? 0, cardioM: C.get(r.id)?.m ?? 0,
    exercises: N.get(r.id) ?? [],
    hasLift: (L.get(r.id)?.n ?? 0) > 0,
    hasCardio: (C.get(r.id)?.n ?? 0) > 0,
  }));
}

// ── Writes ───────────────────────────────────────────────────────────────────

function defaultName(d = new Date()) {
  const h = d.getHours();
  return h < 11 ? "Morning Workout" : h < 16 ? "Afternoon Workout" : "Evening Workout";
}

export function createSession(user: UserRow, opts: { name?: string; routineId?: number | null; startedAt?: string; endedAt?: string } = {}) {
  if (!opts.endedAt) {
    const act = activeSession(user.id);
    if (act) throw bad("You already have a workout in progress");
  }
  const info = db.prepare("INSERT INTO sessions (user_id, routine_id, name, started_at, ended_at) VALUES (?, ?, ?, ?, ?)")
    .run(user.id, opts.routineId ?? null, (opts.name?.trim() || defaultName()).slice(0, 100), opts.startedAt ?? nowIso(), opts.endedAt ?? null);
  return Number(info.lastInsertRowid);
}

function nextPosition(sessionId: number) {
  return ((db.prepare("SELECT MAX(position) p FROM blocks WHERE session_id = ?").get(sessionId) as { p: number | null }).p ?? -1) + 1;
}

/** Build the starting sets for an exercise: copy last time's sets, apply progression, or use routine targets. */
function seedSets(user: UserRow, blockId: number, exerciseId: number, sessionId: number,
  o: { count?: number | null; repMin?: number | null; repMax?: number | null; targetWeightKg?: number | null }) {
  const prev = previousSets(user.id, exerciseId, sessionId);
  const sug = suggest(user.id, exerciseId, { repMin: o.repMin, repMax: o.repMax, excludeSessionId: sessionId, unit: user.weight_unit });
  const ins = db.prepare("INSERT INTO sets (block_id, position, kind, weight_kg, reps, duration_s) VALUES (?, ?, ?, ?, ?, ?)");

  let plan: { kind: SetKind; w: number | null; r: number | null; d: number | null }[];
  if (prev.length) {
    plan = prev.map(p => ({ kind: p.kind, w: p.weightKg, r: p.reps, d: p.durationS }));
    if (o.count && o.count > plan.filter(p => p.kind !== "warmup").length) {
      const last = plan[plan.length - 1];
      while (plan.filter(p => p.kind !== "warmup").length < o.count) plan.push({ ...last, kind: "normal" });
    }
    if (sug?.status === "increase") {
      plan = plan.map(p => p.kind === "normal" || p.kind === "failure"
        ? (Math.abs((p.w ?? 0) - sug.lastWeightKg) < 0.01 ? { ...p, w: sug.nextWeightKg, r: sug.repMin } : p)
        : p);
    }
  } else {
    const n = o.count ?? 3;
    plan = Array.from({ length: n }, () => ({ kind: "normal" as SetKind, w: o.targetWeightKg ?? null, r: o.repMin ?? null, d: null }));
  }
  plan.forEach((p, i) => ins.run(blockId, i, p.kind, p.w, p.r, p.d));
}

export function addLiftBlock(user: UserRow, sessionId: number, exerciseId: number,
  o: { setsCount?: number | null; repMin?: number | null; repMax?: number | null; restS?: number | null; targetWeightKg?: number | null; superset?: number | null; notes?: string | null } = {}) {
  ownSession(user.id, sessionId);
  getExerciseRow(user.id, exerciseId);
  if (o.repMin == null && o.repMax == null) {
    // keep the rep range you used last time
    const last = db.prepare(`SELECT b.rep_min, b.rep_max FROM blocks b JOIN sessions se ON se.id = b.session_id
      WHERE se.user_id = ? AND b.exercise_id = ? AND b.rep_min IS NOT NULL AND se.id != ? ORDER BY se.started_at DESC LIMIT 1`)
      .get(user.id, exerciseId, sessionId) as { rep_min: number; rep_max: number } | undefined;
    if (last) o = { ...o, repMin: last.rep_min, repMax: last.rep_max };
  }
  const info = db.prepare(`INSERT INTO blocks (session_id, kind, position, superset, exercise_id, rep_min, rep_max, rest_s, notes)
    VALUES (?, 'lift', ?, ?, ?, ?, ?, ?, ?)`).run(sessionId, nextPosition(sessionId), o.superset ?? null, exerciseId,
    o.repMin ?? null, o.repMax ?? null, o.restS ?? null, o.notes ?? null);
  const blockId = Number(info.lastInsertRowid);
  seedSets(user, blockId, exerciseId, sessionId, { count: o.setsCount, repMin: o.repMin, repMax: o.repMax, targetWeightKg: o.targetWeightKg });
  return blockId;
}

export function addCardioBlock(user: UserRow, sessionId: number, activityTypeId: number,
  o: { durationS?: number | null; distanceM?: number | null; notes?: string | null } = {}) {
  ownSession(user.id, sessionId);
  getActivity(user.id, activityTypeId);
  const info = db.prepare(`INSERT INTO blocks (session_id, kind, position, activity_type_id, notes) VALUES (?, 'cardio', ?, ?, ?)`)
    .run(sessionId, nextPosition(sessionId), activityTypeId, o.notes ?? null);
  const blockId = Number(info.lastInsertRowid);
  db.prepare("INSERT INTO cardio (block_id, duration_s, distance_m) VALUES (?, ?, ?)").run(blockId, o.durationS ?? null, o.distanceM ?? null);
  return blockId;
}

/** Start a session pre-filled from a routine. */
export function startFromRoutine(user: UserRow, routineId: number) {
  const r = db.prepare("SELECT * FROM routines WHERE id = ? AND user_id = ?").get(routineId, user.id) as { id: number; name: string } | undefined;
  if (!r) throw notFound("Routine not found");
  const blocks = db.prepare("SELECT * FROM routine_blocks WHERE routine_id = ? ORDER BY position, id").all(routineId) as {
    kind: string; superset: number | null; exercise_id: number | null; activity_type_id: number | null; sets_count: number;
    rep_min: number | null; rep_max: number | null; target_weight_kg: number | null; rest_s: number | null;
    target_duration_s: number | null; target_distance_m: number | null; notes: string | null;
  }[];
  return db.transaction(() => {
    const sid = createSession(user, { name: r.name, routineId });
    for (const b of blocks) {
      if (b.kind === "lift" && b.exercise_id) {
        addLiftBlock(user, sid, b.exercise_id, {
          setsCount: b.sets_count, repMin: b.rep_min, repMax: b.rep_max, restS: b.rest_s,
          targetWeightKg: b.target_weight_kg, superset: b.superset, notes: b.notes,
        });
      } else if (b.kind === "cardio" && b.activity_type_id) {
        addCardioBlock(user, sid, b.activity_type_id, { durationS: b.target_duration_s, distanceM: b.target_distance_m, notes: b.notes });
      }
    }
    return sid;
  })();
}

/** Start a session straight from a generated plan, without saving a routine. */
export function startFromBlocks(user: UserRow, name: string, blocks: RoutineBlockDTO[]) {
  if (!Array.isArray(blocks) || !blocks.length || blocks.length > 60) throw bad("Nothing to start");
  return db.transaction(() => {
    const sid = createSession(user, { name });
    for (const b of blocks) {
      if (b.kind === "lift" && b.exerciseId) {
        addLiftBlock(user, sid, Number(b.exerciseId), {
          setsCount: b.setsCount, repMin: b.repMin, repMax: b.repMax, restS: b.restS,
          targetWeightKg: b.targetWeightKg, superset: b.superset, notes: b.notes,
        });
      } else if (b.kind === "cardio" && b.activityTypeId) {
        addCardioBlock(user, sid, Number(b.activityTypeId), { durationS: b.targetDurationS, distanceM: b.targetDistanceM, notes: b.notes });
      } else throw bad("Invalid block");
    }
    return sid;
  })();
}

export function addSet(userId: number, blockId: number, kind: SetKind = "normal") {
  const b = ownBlock(userId, blockId);
  if (b.kind !== "lift") throw bad("Not a lifting block");
  const last = db.prepare("SELECT * FROM sets WHERE block_id = ? ORDER BY position DESC, id DESC LIMIT 1").get(blockId) as SetRow | undefined;
  const pos = (last?.position ?? -1) + 1;
  const info = db.prepare("INSERT INTO sets (block_id, position, kind, weight_kg, reps, duration_s) VALUES (?, ?, ?, ?, ?, ?)")
    .run(blockId, pos, kind, last?.weight_kg ?? null, last?.reps ?? null, last?.duration_s ?? null);
  return Number(info.lastInsertRowid);
}

export function updateSet(userId: number, setId: number, p: Partial<{ kind: SetKind; weightKg: number | null; reps: number | null; durationS: number | null; rpe: number | null; done: boolean }>) {
  const s = ownSet(userId, setId);
  const kind = p.kind ?? s.kind;
  if (!["normal", "warmup", "drop", "failure"].includes(kind)) throw bad("Invalid set type");
  const done = p.done === undefined ? s.done : p.done ? 1 : 0;
  db.prepare(`UPDATE sets SET kind = ?, weight_kg = ?, reps = ?, duration_s = ?, rpe = ?, done = ?, done_at = ? WHERE id = ?`).run(
    kind,
    p.weightKg !== undefined ? p.weightKg : s.weight_kg,
    p.reps !== undefined ? (p.reps == null ? null : Math.round(p.reps)) : s.reps,
    p.durationS !== undefined ? p.durationS : s.duration_s,
    p.rpe !== undefined ? p.rpe : s.rpe,
    done,
    done ? (s.done_at ?? nowIso()) : null,
    setId,
  );
}

export function deleteSet(userId: number, setId: number) {
  const s = ownSet(userId, setId);
  db.prepare("DELETE FROM sets WHERE id = ?").run(setId);
  // keep positions compact
  const rest = db.prepare("SELECT id FROM sets WHERE block_id = ? ORDER BY position, id").all(s.block_id) as { id: number }[];
  const up = db.prepare("UPDATE sets SET position = ? WHERE id = ?");
  rest.forEach((r, i) => up.run(i, r.id));
}

function renumber(sessionId: number, orderedIds: number[]) {
  const up = db.prepare("UPDATE blocks SET position = ? WHERE id = ?");
  orderedIds.forEach((id, i) => up.run(i, id));
  void sessionId;
}

export function moveBlock(userId: number, blockId: number, dir: "up" | "down") {
  const b = ownBlock(userId, blockId);
  const ids = (db.prepare("SELECT id FROM blocks WHERE session_id = ? ORDER BY position, id").all(b.session_id) as { id: number }[]).map(x => x.id);
  const i = ids.indexOf(blockId);
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  renumber(b.session_id, ids);
}

/** Link this block with the next one into a superset (or unlink it). */
export function toggleSuperset(userId: number, blockId: number) {
  const b = ownBlock(userId, blockId);
  const blocks = db.prepare("SELECT id, kind, superset FROM blocks WHERE session_id = ? ORDER BY position, id").all(b.session_id) as { id: number; kind: string; superset: number | null }[];
  const i = blocks.findIndex(x => x.id === blockId);
  const next = blocks[i + 1];
  if (b.superset != null && next?.superset === b.superset) {
    // unlink from the next block: everything after this point gets a new group (or none)
    const tail = blocks.slice(i + 1).filter(x => x.superset === b.superset);
    const newGroup = tail.length > 1 ? Date.now() % 1_000_000 : null;
    for (const t of tail) db.prepare("UPDATE blocks SET superset = ? WHERE id = ?").run(newGroup, t.id);
    const head = blocks.slice(0, i + 1).filter(x => x.superset === b.superset);
    if (head.length < 2) for (const h of head) db.prepare("UPDATE blocks SET superset = NULL WHERE id = ?").run(h.id);
    return;
  }
  if (!next || next.kind !== "lift" || b.kind !== "lift") throw bad("Add another exercise below to superset with");
  const group = b.superset ?? next.superset ?? (Date.now() % 1_000_000);
  const oldNext = next.superset;
  db.prepare("UPDATE blocks SET superset = ? WHERE id IN (?, ?)").run(group, blockId, next.id);
  if (oldNext != null && oldNext !== group) db.prepare("UPDATE blocks SET superset = ? WHERE session_id = ? AND superset = ?").run(group, b.session_id, oldNext);
}

export function updateBlock(user: UserRow, blockId: number, p: { restS?: number | null; notes?: string | null; repMin?: number | null; repMax?: number | null; exerciseId?: number; saveRestDefault?: boolean }) {
  const b = ownBlock(user.id, blockId);
  if (p.exerciseId !== undefined && p.exerciseId !== b.exercise_id) {
    // swap exercise: reset sets from the new exercise's history
    getExerciseRow(user.id, p.exerciseId);
    const count = (db.prepare("SELECT COUNT(*) c FROM sets WHERE block_id = ? AND kind != 'warmup'").get(blockId) as { c: number }).c;
    db.prepare("DELETE FROM sets WHERE block_id = ?").run(blockId);
    db.prepare("UPDATE blocks SET exercise_id = ?, rest_s = NULL WHERE id = ?").run(p.exerciseId, blockId);
    seedSets(user, blockId, p.exerciseId, b.session_id, { count: count || 3, repMin: b.rep_min, repMax: b.rep_max });
  }
  if (p.restS !== undefined) {
    db.prepare("UPDATE blocks SET rest_s = ? WHERE id = ?").run(p.restS, blockId);
    if (p.saveRestDefault && b.exercise_id) {
      setPrefs(user.id, b.exercise_id, { restS: p.restS });
    }
  }
  if (p.notes !== undefined) db.prepare("UPDATE blocks SET notes = ? WHERE id = ?").run(p.notes, blockId);
  if (p.repMin !== undefined || p.repMax !== undefined) {
    const lo = p.repMin !== undefined ? p.repMin : b.rep_min;
    const hi = p.repMax !== undefined ? p.repMax : b.rep_max;
    if (lo != null && hi != null && hi < lo) throw bad("Rep range top must be ≥ bottom");
    db.prepare("UPDATE blocks SET rep_min = ?, rep_max = ? WHERE id = ?").run(lo, hi, blockId);
  }
}

export function deleteBlock(userId: number, blockId: number) {
  const b = ownBlock(userId, blockId);
  db.prepare("DELETE FROM blocks WHERE id = ?").run(blockId);
  if (b.superset != null) {
    const left = db.prepare("SELECT id FROM blocks WHERE session_id = ? AND superset = ?").all(b.session_id, b.superset) as { id: number }[];
    if (left.length < 2) db.prepare("UPDATE blocks SET superset = NULL WHERE session_id = ? AND superset = ?").run(b.session_id, b.superset);
  }
  const ids = (db.prepare("SELECT id FROM blocks WHERE session_id = ? ORDER BY position, id").all(b.session_id) as { id: number }[]).map(x => x.id);
  renumber(b.session_id, ids);
}

export function updateCardio(userId: number, blockId: number, p: Partial<CardioDTO>) {
  const b = ownBlock(userId, blockId);
  if (b.kind !== "cardio") throw bad("Not a cardio block");
  const cur = toCardio(db.prepare("SELECT * FROM cardio WHERE block_id = ?").get(blockId) as CardioRow | undefined);
  const n = { ...cur, ...p };
  if (n.route && (!Array.isArray(n.route) || n.route.length > 50_000)) throw bad("Route too large");
  db.prepare(`INSERT INTO cardio (block_id, duration_s, distance_m, elevation_m, avg_hr, calories, route, done) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(block_id) DO UPDATE SET duration_s = excluded.duration_s, distance_m = excluded.distance_m, elevation_m = excluded.elevation_m,
      avg_hr = excluded.avg_hr, calories = excluded.calories, route = excluded.route, done = excluded.done`)
    .run(blockId, n.durationS, n.distanceM, n.elevationM, n.avgHr, n.calories, n.route ? JSON.stringify(n.route) : null, n.done ? 1 : 0);
}

export function pauseSession(userId: number, id: number, pause: boolean) {
  const s = ownSession(userId, id);
  if (s.ended_at) throw bad("Workout already finished");
  if (pause && !s.paused_at) db.prepare("UPDATE sessions SET paused_at = ? WHERE id = ?").run(nowIso(), id);
  if (!pause && s.paused_at) {
    const add = Math.round((Date.now() - Date.parse(s.paused_at)) / 1000);
    db.prepare("UPDATE sessions SET paused_at = NULL, paused_s = paused_s + ? WHERE id = ?").run(add, id);
  }
}

/** Records set in this session compared to everything before it. */
export function recordsIn(userId: number, sessionId: number): RecordHit[] {
  const s = ownSession(userId, sessionId);
  const blocks = db.prepare(`SELECT DISTINCT b.exercise_id id, e.name, e.equipment FROM blocks b JOIN exercises e ON e.id = b.exercise_id
    WHERE b.session_id = ? AND b.kind = 'lift' AND e.log_type = 'weight_reps'`).all(sessionId) as { id: number; name: string; equipment: string }[];
  const hits: RecordHit[] = [];
  for (const b of blocks) {
    const before = db.prepare(`SELECT st.weight_kg w, st.reps r FROM sets st JOIN blocks bl ON bl.id = st.block_id JOIN sessions se ON se.id = bl.session_id
      WHERE se.user_id = ? AND bl.exercise_id = ? AND se.ended_at IS NOT NULL AND se.started_at < ? AND se.id != ?
        AND st.done = 1 AND st.kind != 'warmup' AND st.weight_kg > 0 AND st.reps > 0`).all(userId, b.id, s.started_at, sessionId) as { w: number; r: number }[];
    if (!before.length) continue; // first time doing it isn't a record
    const now = db.prepare(`SELECT st.weight_kg w, st.reps r FROM sets st JOIN blocks bl ON bl.id = st.block_id
      WHERE bl.session_id = ? AND bl.exercise_id = ? AND st.done = 1 AND st.kind != 'warmup' AND st.weight_kg > 0 AND st.reps > 0`).all(sessionId, b.id) as { w: number; r: number }[];
    if (!now.length) continue;
    const name = exerciseDisplayName(b.name, b.equipment);
    const maxW = (a: { w: number }[]) => Math.max(...a.map(x => x.w));
    const max1 = (a: { w: number; r: number }[]) => Math.max(...a.map(x => e1rm(x.w, x.r)));
    const maxV = (a: { w: number; r: number }[]) => Math.max(...a.map(x => x.w * x.r));
    if (maxW(now) > maxW(before) + 1e-6) hits.push({ exercise: name, label: "Heaviest weight", value: `${maxW(now)}` });
    if (max1(now) > max1(before) + 1e-6) hits.push({ exercise: name, label: "Best est. 1RM", value: `${max1(now)}` });
    if (maxV(now) > maxV(before) + 1e-6) hits.push({ exercise: name, label: "Best set volume", value: `${maxV(now)}` });
  }
  return hits;
}

export function finishSession(user: UserRow, id: number) {
  const s = ownSession(user.id, id);
  if (s.ended_at) throw bad("Already finished");
  return db.transaction(() => {
    if (s.paused_at) pauseSession(user.id, id, false);
    // Drop unfinished sets / cardio and any blocks left empty, like Strong.
    db.prepare("DELETE FROM sets WHERE done = 0 AND block_id IN (SELECT id FROM blocks WHERE session_id = ?)").run(id);
    db.prepare(`DELETE FROM blocks WHERE session_id = ? AND (
      (kind = 'lift' AND NOT EXISTS (SELECT 1 FROM sets WHERE block_id = blocks.id)) OR
      (kind = 'cardio' AND NOT EXISTS (SELECT 1 FROM cardio WHERE block_id = blocks.id AND done = 1)))`).run(id);
    const remaining = (db.prepare("SELECT COUNT(*) c FROM blocks WHERE session_id = ?").get(id) as { c: number }).c;
    if (!remaining) throw bad("Nothing logged yet — complete at least one set or cardio entry, or discard the workout");
    db.prepare("UPDATE sessions SET ended_at = ? WHERE id = ?").run(nowIso(), id);
    const summary = listSessions(user.id, { finishedOnly: true }).find(x => x.id === id)!;
    return { summary, records: recordsIn(user.id, id) };
  })();
}

export function updateSessionMeta(userId: number, id: number, p: { name?: string; notes?: string | null; startedAt?: string; endedAt?: string }) {
  const s = ownSession(userId, id);
  if (p.name !== undefined) db.prepare("UPDATE sessions SET name = ? WHERE id = ?").run(p.name.trim().slice(0, 100) || s.name, id);
  if (p.notes !== undefined) db.prepare("UPDATE sessions SET notes = ? WHERE id = ?").run(p.notes, id);
  if (p.startedAt !== undefined || p.endedAt !== undefined) {
    const st = p.startedAt ?? s.started_at;
    const en = p.endedAt ?? s.ended_at;
    if (isNaN(Date.parse(st)) || (en && isNaN(Date.parse(en)))) throw bad("Invalid date");
    if (en && Date.parse(en) < Date.parse(st)) throw bad("End must be after start");
    db.prepare("UPDATE sessions SET started_at = ?, ended_at = ? WHERE id = ?").run(new Date(st).toISOString(), en ? new Date(en).toISOString() : null, id);
  }
}
