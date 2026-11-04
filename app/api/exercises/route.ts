import { route, bad, str } from "@/lib/api";
import { db } from "@/lib/db";
import { listExercises, toExerciseDTO, type ExerciseRow } from "@/lib/repo/exercises";
import { EQUIPMENT, MUSCLES } from "@/lib/exerciseSeed";

export const GET = route(({ user }) => {
  const list = listExercises(user.id);
  // usage counts so pickers can show "frequently used" first
  const usage = db.prepare(`SELECT b.exercise_id id, COUNT(DISTINCT b.session_id) n, MAX(se.started_at) last
    FROM blocks b JOIN sessions se ON se.id = b.session_id WHERE se.user_id = ? AND b.kind = 'lift' GROUP BY b.exercise_id`)
    .all(user.id) as { id: number; n: number; last: string }[];
  const U = new Map(usage.map(u => [u.id, u]));
  return list.map(e => ({ ...e, timesDone: U.get(e.id)?.n ?? 0, lastDone: U.get(e.id)?.last ?? null }));
});

// Create a custom exercise
export const POST = route(({ user, body }) => {
  const b = body ?? {};
  const name = str(b.name, 80).trim();
  if (!name) throw bad("Name required");
  const equipment = EQUIPMENT.some(e => e.id === b.equipment) ? b.equipment : "other";
  const valid = (a: unknown) => (Array.isArray(a) ? a.filter(m => MUSCLES.some(x => x.id === m)) : []);
  const logType = ["weight_reps", "reps", "time"].includes(b.logType) ? b.logType : "weight_reps";
  const dup = db.prepare(`SELECT id FROM exercises WHERE name = ? COLLATE NOCASE AND equipment = ? AND archived = 0 AND (is_builtin = 1 OR created_by = ?)`)
    .get(name, equipment, user.id);
  if (dup) throw bad("You already have that exercise");
  const info = db.prepare(`INSERT INTO exercises (name, equipment, primary_muscles, secondary_muscles, pattern, log_type, is_builtin, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)`).run(name, equipment, JSON.stringify(valid(b.primary)), JSON.stringify(valid(b.secondary)),
    typeof b.pattern === "string" ? b.pattern : null, logType, user.id);
  return toExerciseDTO(db.prepare("SELECT * FROM exercises WHERE id = ?").get(info.lastInsertRowid) as ExerciseRow);
});
