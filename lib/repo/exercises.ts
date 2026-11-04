import { db } from "../db";
import { exerciseDisplayName } from "../exerciseSeed";
import { notFound } from "../api";
import type { ActivityDTO, ExerciseDTO, LogType } from "../types";

export type ExerciseRow = {
  id: number; name: string; equipment: string; primary_muscles: string; secondary_muscles: string;
  pattern: string | null; log_type: string; rank: number; is_builtin: number; created_by: number | null; archived: number;
};

export function toExerciseDTO(r: ExerciseRow): ExerciseDTO {
  return {
    id: r.id,
    name: r.name,
    equipment: r.equipment,
    displayName: exerciseDisplayName(r.name, r.equipment),
    primary: JSON.parse(r.primary_muscles || "[]"),
    secondary: JSON.parse(r.secondary_muscles || "[]"),
    pattern: r.pattern,
    logType: r.log_type as LogType,
    isBuiltin: !!r.is_builtin,
  };
}

/** Exercises visible to a user: built-ins + their own custom ones. */
export function listExercises(userId: number): ExerciseDTO[] {
  const rows = db.prepare(`SELECT * FROM exercises
    WHERE archived = 0 AND (is_builtin = 1 OR created_by = ?)
    ORDER BY name COLLATE NOCASE, equipment`).all(userId) as ExerciseRow[];
  return rows.map(toExerciseDTO);
}

export function getExerciseRow(userId: number, id: number): ExerciseRow {
  const r = db.prepare(`SELECT * FROM exercises WHERE id = ? AND (is_builtin = 1 OR created_by = ?)`).get(id, userId) as ExerciseRow | undefined;
  if (!r) throw notFound("Exercise not found");
  return r;
}

export type ExercisePrefs = { restS: number | null; incrementKg: number | null; note: string | null };

export function getPrefs(userId: number, exerciseId: number): ExercisePrefs {
  const r = db.prepare("SELECT rest_s, increment_kg, note FROM exercise_prefs WHERE user_id = ? AND exercise_id = ?")
    .get(userId, exerciseId) as { rest_s: number | null; increment_kg: number | null; note: string | null } | undefined;
  return { restS: r?.rest_s ?? null, incrementKg: r?.increment_kg ?? null, note: r?.note ?? null };
}

export function setPrefs(userId: number, exerciseId: number, p: Partial<ExercisePrefs>) {
  const cur = getPrefs(userId, exerciseId);
  const next = { ...cur, ...p };
  db.prepare(`INSERT INTO exercise_prefs (user_id, exercise_id, rest_s, increment_kg, note) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, exercise_id) DO UPDATE SET rest_s = excluded.rest_s, increment_kg = excluded.increment_kg, note = excluded.note`)
    .run(userId, exerciseId, next.restS, next.incrementKg, next.note);
}

type ActivityRow = { id: number; name: string; has_distance: number; icon: string; is_builtin: number };
export const toActivityDTO = (r: ActivityRow): ActivityDTO => ({
  id: r.id, name: r.name, hasDistance: !!r.has_distance, icon: r.icon, isBuiltin: !!r.is_builtin,
});

export function listActivities(userId: number): ActivityDTO[] {
  return (db.prepare("SELECT * FROM activity_types WHERE is_builtin = 1 OR created_by = ? ORDER BY is_builtin DESC, id").all(userId) as ActivityRow[]).map(toActivityDTO);
}

export function getActivity(userId: number, id: number): ActivityDTO {
  const r = db.prepare("SELECT * FROM activity_types WHERE id = ? AND (is_builtin = 1 OR created_by = ?)").get(id, userId) as ActivityRow | undefined;
  if (!r) throw notFound("Activity not found");
  return toActivityDTO(r);
}
