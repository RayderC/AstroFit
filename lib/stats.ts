import { db } from "./db";
import { e1rm } from "./units";

type Row = { session_id: number; started_at: string; name: string; kind: string; weight_kg: number | null; reps: number | null; duration_s: number | null; rpe: number | null };

/** Everything needed for an exercise's History / Charts / Records tabs. */
export function exerciseDetail(userId: number, exerciseId: number) {
  const rows = db.prepare(`
    SELECT se.id session_id, se.started_at, se.name, st.kind, st.weight_kg, st.reps, st.duration_s, st.rpe
    FROM sets st JOIN blocks b ON b.id = st.block_id JOIN sessions se ON se.id = b.session_id
    WHERE se.user_id = ? AND b.exercise_id = ? AND se.ended_at IS NOT NULL AND st.done = 1
    ORDER BY se.started_at DESC, b.position, st.position`).all(userId, exerciseId) as Row[];

  const bySession = new Map<number, { sessionId: number; date: string; name: string; sets: Row[] }>();
  for (const r of rows) {
    let s = bySession.get(r.session_id);
    if (!s) bySession.set(r.session_id, (s = { sessionId: r.session_id, date: r.started_at, name: r.name, sets: [] }));
    s.sets.push(r);
  }
  const history = [...bySession.values()];

  const chart = history.map(h => {
    const work = h.sets.filter(s => s.kind !== "warmup");
    const top = Math.max(0, ...work.map(s => s.weight_kg ?? 0));
    const best1 = Math.max(0, ...work.map(s => e1rm(s.weight_kg ?? 0, s.reps ?? 0)));
    const vol = work.reduce((a, s) => a + (s.weight_kg ?? 0) * (s.reps ?? 0), 0);
    const reps = Math.max(0, ...work.map(s => s.reps ?? 0));
    const totalReps = work.reduce((a, s) => a + (s.reps ?? 0), 0);
    const dur = Math.max(0, ...work.map(s => s.duration_s ?? 0));
    return { date: h.date, topKg: top, e1rmKg: best1, volumeKg: vol, maxReps: reps, totalReps, maxDurationS: dur };
  }).reverse();

  const work = rows.filter(r => r.kind !== "warmup");
  const best = <T,>(arr: T[], f: (x: T) => number) => arr.reduce<{ v: number; x: T | null }>((a, x) => (f(x) > a.v ? { v: f(x), x } : a), { v: 0, x: null });
  const heaviest = best(work, s => s.weight_kg ?? 0);
  const best1rm = best(work, s => e1rm(s.weight_kg ?? 0, s.reps ?? 0));
  const bestSetVol = best(work, s => (s.weight_kg ?? 0) * (s.reps ?? 0));
  const bestSession = best(chart, c => c.volumeKg);
  const mostReps = best(work, s => s.reps ?? 0);
  const longest = best(work, s => s.duration_s ?? 0);

  const repRecords: { reps: number; weightKg: number; date: string }[] = [];
  for (let n = 1; n <= 12; n++) {
    const b = best(work.filter(s => (s.reps ?? 0) >= n), s => s.weight_kg ?? 0);
    if (b.x && b.v > 0) repRecords.push({ reps: n, weightKg: b.v, date: b.x.started_at });
  }

  return {
    history: history.map(h => ({
      sessionId: h.sessionId, date: h.date, name: h.name,
      sets: h.sets.map(s => ({ kind: s.kind, weightKg: s.weight_kg, reps: s.reps, durationS: s.duration_s, rpe: s.rpe })),
    })),
    chart,
    records: {
      heaviest: heaviest.x ? { weightKg: heaviest.v, reps: heaviest.x.reps, date: heaviest.x.started_at } : null,
      e1rm: best1rm.x ? { valueKg: best1rm.v, weightKg: best1rm.x.weight_kg, reps: best1rm.x.reps, date: best1rm.x.started_at } : null,
      setVolume: bestSetVol.x ? { valueKg: bestSetVol.v, weightKg: bestSetVol.x.weight_kg, reps: bestSetVol.x.reps, date: bestSetVol.x.started_at } : null,
      sessionVolume: bestSession.x ? { valueKg: bestSession.v, date: bestSession.x.date } : null,
      mostReps: mostReps.x ? { reps: mostReps.v, weightKg: mostReps.x.weight_kg, date: mostReps.x.started_at } : null,
      longest: longest.x ? { durationS: longest.v, date: longest.x.started_at } : null,
      repRecords,
    },
    totalSessions: history.length,
  };
}

/** Sets per muscle in a window. Primary muscles count 1, secondary 0.5. */
export function muscleSets(userId: number, fromIso: string, toIso?: string) {
  const rows = db.prepare(`
    SELECT e.primary_muscles p, e.secondary_muscles s, COUNT(st.id) n
    FROM sets st JOIN blocks b ON b.id = st.block_id JOIN sessions se ON se.id = b.session_id JOIN exercises e ON e.id = b.exercise_id
    WHERE se.user_id = ? AND se.started_at >= ? AND se.started_at < ? AND st.done = 1 AND st.kind != 'warmup'
    GROUP BY e.id`).all(userId, fromIso, toIso ?? "9999") as { p: string; s: string; n: number }[];
  const out: Record<string, number> = {};
  for (const r of rows) {
    for (const m of JSON.parse(r.p)) out[m] = (out[m] ?? 0) + r.n;
    for (const m of JSON.parse(r.s)) out[m] = (out[m] ?? 0) + r.n * 0.5;
  }
  return out;
}
