import { db } from "./db";
import { exerciseDisplayName } from "./exerciseSeed";
import { muscleSets } from "./stats";
import { addDays, dayStartUtc, localDay, mondayOf } from "./tz";
import { e1rm } from "./units";
import { bestEfforts, EFFORTS, type RoutePoint } from "./geo";

// Everything here is in kg / meters / seconds. The page converts for display.

/** Below this a pace is usually a GPS glitch or a mis-tap, so it can't be a "fastest" record. */
const MIN_PACE_DISTANCE_M = 400;

function weekList(first: string, last: string) {
  const out: string[] = [];
  for (let w = first; w <= last; w = addDays(w, 7)) out.push(w);
  return out;
}

/** weeks = number of calendar weeks to chart, 0 for all time. */
export function progress(userId: number, tz: string, weeks: number) {
  const now = new Date().toISOString();
  const thisWeek = mondayOf(localDay(now, tz));

  let firstWeek = addDays(thisWeek, -(Math.max(1, weeks) - 1) * 7);
  if (weeks === 0) {
    const first = db.prepare("SELECT MIN(started_at) m FROM sessions WHERE user_id = ? AND ended_at IS NOT NULL").get(userId) as { m: string | null };
    firstWeek = first.m ? mondayOf(localDay(first.m, tz)) : thisWeek;
  }
  const fromIso = dayStartUtc(firstWeek, tz);
  const list = weekList(firstWeek, thisWeek);

  // ── Lifting ──
  const sets = db.prepare(`
    SELECT se.id sid, se.started_at, st.weight_kg w, st.reps r
    FROM sets st JOIN blocks b ON b.id = st.block_id JOIN sessions se ON se.id = b.session_id
    WHERE se.user_id = ? AND se.ended_at IS NOT NULL AND se.started_at >= ? AND st.done = 1 AND st.kind != 'warmup'`)
    .all(userId, fromIso) as { sid: number; started_at: string; w: number | null; r: number | null }[];

  const lift = new Map(list.map(w => [w, { week: w, volumeKg: 0, sets: 0, sessions: new Set<number>() }]));
  for (const s of sets) {
    const b = lift.get(mondayOf(localDay(s.started_at, tz)));
    if (!b) continue;
    b.volumeKg += (s.w ?? 0) * (s.r ?? 0);
    b.sets += 1;
    b.sessions.add(s.sid);
  }

  const best = db.prepare(`
    SELECT e.id, e.name, e.equipment, se.started_at date, st.weight_kg w, st.reps r
    FROM sets st JOIN blocks b ON b.id = st.block_id JOIN sessions se ON se.id = b.session_id JOIN exercises e ON e.id = b.exercise_id
    WHERE se.user_id = ? AND se.ended_at IS NOT NULL AND st.done = 1 AND st.kind != 'warmup' AND st.weight_kg > 0 AND st.reps > 0`)
    .all(userId) as { id: number; name: string; equipment: string; date: string; w: number; r: number }[];
  const bestBy = new Map<number, { exerciseId: number; name: string; e1rmKg: number; weightKg: number; reps: number; date: string; heaviestKg: number }>();
  for (const s of best) {
    const v = e1rm(s.w, s.r);
    const cur = bestBy.get(s.id);
    if (!cur) bestBy.set(s.id, { exerciseId: s.id, name: exerciseDisplayName(s.name, s.equipment), e1rmKg: v, weightKg: s.w, reps: s.r, date: s.date, heaviestKg: s.w });
    else {
      cur.heaviestKg = Math.max(cur.heaviestKg, s.w);
      if (v > cur.e1rmKg) Object.assign(cur, { e1rmKg: v, weightKg: s.w, reps: s.r, date: s.date });
    }
  }

  // ── Cardio ──
  const cardio = db.prepare(`
    SELECT a.id, a.name, a.has_distance, se.id sid, se.started_at date, c.duration_s, c.distance_m, c.route
    FROM cardio c JOIN blocks b ON b.id = c.block_id JOIN sessions se ON se.id = b.session_id JOIN activity_types a ON a.id = b.activity_type_id
    WHERE se.user_id = ? AND se.ended_at IS NOT NULL AND c.done = 1 ORDER BY se.started_at`)
    .all(userId) as { id: number; name: string; has_distance: number; sid: number; date: string; duration_s: number | null; distance_m: number | null; route: string | null }[];

  const cw = new Map(list.map(w => [w, { week: w, durationS: 0, distanceM: 0, sessions: new Set<number>() }]));
  type Act = {
    id: number; name: string; hasDistance: boolean; count: number;
    points: { date: string; durationS: number; distanceM: number }[];
    longestDistance: { distanceM: number; durationS: number | null; date: string } | null;
    longestTime: { durationS: number; distanceM: number | null; date: string } | null;
    fastest: { distanceM: number; durationS: number; date: string } | null;
    efforts: { label: string; meters: number; timeS: number; date: string; fromGps: boolean }[];
  };
  const acts = new Map<number, Act>();
  for (const c of cardio) {
    if (c.date >= fromIso) {
      const w = cw.get(mondayOf(localDay(c.date, tz)));
      if (w) { w.durationS += c.duration_s ?? 0; w.distanceM += c.distance_m ?? 0; w.sessions.add(c.sid); }
    }
    let a = acts.get(c.id);
    if (!a) acts.set(c.id, (a = { id: c.id, name: c.name, hasDistance: !!c.has_distance, count: 0, points: [], longestDistance: null, longestTime: null, fastest: null, efforts: [] }));
    a.count++;
    const dur = c.duration_s ?? 0, dist = c.distance_m ?? 0;
    if (dist > 0 && (!a.longestDistance || dist > a.longestDistance.distanceM)) a.longestDistance = { distanceM: dist, durationS: c.duration_s, date: c.date };
    if (dur > 0 && (!a.longestTime || dur > a.longestTime.durationS)) a.longestTime = { durationS: dur, distanceM: c.distance_m, date: c.date };
    if (dist > 0 && dur > 0) {
      if (c.date >= fromIso) a.points.push({ date: c.date, durationS: dur, distanceM: dist });
      if (dist >= MIN_PACE_DISTANCE_M && (!a.fastest || dur / dist < a.fastest.durationS / a.fastest.distanceM)) a.fastest = { distanceM: dist, durationS: dur, date: c.date };
      // With a GPS track, the fastest stretch of each distance inside it. Without one, the whole
      // effort's average pace held over the distance.
      let gps: Map<string, number> | null = null;
      if (c.route) { try { gps = bestEfforts(JSON.parse(c.route) as RoutePoint[]); } catch { gps = null; } }
      for (const e of EFFORTS) {
        if (dist < e.m) continue;
        const fromGps = gps?.has(e.label) ?? false;
        const t = fromGps ? gps!.get(e.label)! : (dur / dist) * e.m;
        const cur = a.efforts.find(x => x.label === e.label);
        if (!cur) a.efforts.push({ label: e.label, meters: e.m, timeS: t, date: c.date, fromGps });
        else if (t < cur.timeS) Object.assign(cur, { timeS: t, date: c.date, fromGps });
      }
    }
  }

  return {
    weeks: list.length,
    lifting: {
      weekly: [...lift.values()].map(w => ({ week: w.week, volumeKg: w.volumeKg, sets: w.sets, sessions: w.sessions.size })),
      muscles: muscleSets(userId, fromIso),
      best: [...bestBy.values()].sort((a, b) => b.e1rmKg - a.e1rmKg).slice(0, 12),
    },
    cardio: {
      weekly: [...cw.values()].map(w => ({ week: w.week, durationS: w.durationS, distanceM: w.distanceM, sessions: w.sessions.size })),
      activities: [...acts.values()].sort((a, b) => b.count - a.count),
    },
    heatmap: muscleSets(userId, new Date(Date.now() - 7 * 86400_000).toISOString()),
  };
}
