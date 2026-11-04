import { db } from "./db";
import { exerciseDisplayName } from "./exerciseSeed";
import { listBody } from "./repo/body";
import { listRoutines } from "./repo/routines";
import { durationOf } from "./repo/sessions";
import type { UserRow } from "./api";
import { localStamp } from "./tz";
import { kgTo, mTo, trim } from "./units";

const CSV_HEADER = ["Date", "Workout Name", "Duration", "Exercise Name", "Set Order", "Weight", "Reps", "Distance", "Seconds", "Notes", "Workout Notes", "RPE"];

function cell(v: string | number | null | undefined) {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Strong writes durations like "1h 5m". */
function strongDuration(totalS: number) {
  const h = Math.floor(totalS / 3600);
  const m = Math.round((totalS % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

/**
 * One row per completed set of each finished workout, in Strong's column layout. Weights and distances
 * are in the user's units, since Strong's layout has no unit columns; the file name records them.
 */
export function exportCsv(user: UserRow, tz: string) {
  const sessions = db.prepare("SELECT * FROM sessions WHERE user_id = ? AND ended_at IS NOT NULL ORDER BY started_at").all(user.id) as
    { id: number; name: string; started_at: string; ended_at: string; paused_s: number; notes: string | null }[];
  const blocksOf = db.prepare(`SELECT b.id, b.kind, b.notes, e.name ename, e.equipment, a.name aname
    FROM blocks b LEFT JOIN exercises e ON e.id = b.exercise_id LEFT JOIN activity_types a ON a.id = b.activity_type_id
    WHERE b.session_id = ? ORDER BY b.position, b.id`);
  const setsOf = db.prepare("SELECT kind, weight_kg, reps, duration_s, rpe FROM sets WHERE block_id = ? AND done = 1 ORDER BY position, id");
  const cardioOf = db.prepare("SELECT duration_s, distance_m FROM cardio WHERE block_id = ? AND done = 1");

  const lines = [CSV_HEADER.join(",")];
  for (const s of sessions) {
    const common = [localStamp(s.started_at, tz), s.name, strongDuration(durationOf(s))];
    for (const b of blocksOf.all(s.id) as { id: number; kind: string; notes: string | null; ename: string | null; equipment: string | null; aname: string | null }[]) {
      if (b.kind === "cardio") {
        const c = cardioOf.get(b.id) as { duration_s: number | null; distance_m: number | null } | undefined;
        if (!c) continue;
        lines.push([...common, b.aname, 1, null, null, c.distance_m != null ? trim(mTo(c.distance_m, user.distance_unit), 3) : null, c.duration_s, b.notes, s.notes, null].map(cell).join(","));
        continue;
      }
      let n = 0;
      for (const st of setsOf.all(b.id) as { kind: string; weight_kg: number | null; reps: number | null; duration_s: number | null; rpe: number | null }[]) {
        const order = st.kind === "warmup" ? "W" : st.kind === "drop" ? "D" : st.kind === "failure" ? "F" : ++n;
        const weight = st.weight_kg != null ? trim(kgTo(st.weight_kg, user.weight_unit), 2) : null;
        lines.push([...common, exerciseDisplayName(b.ename!, b.equipment), order, weight, st.reps, null, st.duration_s, b.notes, s.notes, st.rpe].map(cell).join(","));
      }
    }
  }
  return lines.join("\r\n") + "\r\n";
}

/** Everything belonging to the user, in stored units (kg, meters, seconds, UTC). Password hash excluded. */
export function exportJson(user: UserRow) {
  const sessions = db.prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY started_at").all(user.id) as { id: number }[];
  const blocksOf = db.prepare("SELECT * FROM blocks WHERE session_id = ? ORDER BY position, id");
  const setsOf = db.prepare("SELECT * FROM sets WHERE block_id = ? ORDER BY position, id");
  const cardioOf = db.prepare("SELECT * FROM cardio WHERE block_id = ?");
  const programs = db.prepare("SELECT * FROM programs WHERE user_id = ? ORDER BY id").all(user.id) as { id: number; config: string }[];
  const parseMuscles = <T extends { primary_muscles: string; secondary_muscles: string }>(e: T) =>
    ({ ...e, primary_muscles: JSON.parse(e.primary_muscles), secondary_muscles: JSON.parse(e.secondary_muscles) });

  return {
    format: "astrofit-export",
    version: 2,
    exportedAt: new Date().toISOString(),
    units: { weight: "kg", distance: "m", time: "s" },
    user: { username: user.username, weightUnit: user.weight_unit, distanceUnit: user.distance_unit, restDefault: user.rest_default, createdAt: user.created_at },
    customExercises: (db.prepare("SELECT * FROM exercises WHERE created_by = ?").all(user.id) as { primary_muscles: string; secondary_muscles: string }[]).map(parseMuscles),
    customActivities: db.prepare("SELECT * FROM activity_types WHERE created_by = ?").all(user.id),
    exercisePrefs: db.prepare("SELECT * FROM exercise_prefs WHERE user_id = ?").all(user.id),
    routines: listRoutines(user.id),
    programs: programs.map(p => ({ ...p, config: JSON.parse(p.config), days: db.prepare("SELECT weekday, routine_id FROM program_days WHERE program_id = ?").all(p.id) })),
    sessions: sessions.map(s => ({
      ...s,
      blocks: (blocksOf.all(s.id) as { id: number; kind: string }[]).map(b => {
        if (b.kind === "lift") return { ...b, sets: setsOf.all(b.id) };
        const c = cardioOf.get(b.id) as { route: string | null } | undefined;
        return { ...b, cardio: c ? { ...c, route: c.route ? JSON.parse(c.route) : null } : null };
      }),
    })),
    body: listBody(user.id),
    imports: db.prepare("SELECT source, file_hash, sessions, skipped, imported_at FROM imports WHERE user_id = ?").all(user.id),
  };
}
