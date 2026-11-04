import { route, int, bad, numOrNull, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { getExerciseRow, getPrefs, setPrefs, toExerciseDTO } from "@/lib/repo/exercises";
import { exerciseDetail } from "@/lib/stats";
import { incrementFor, suggest } from "@/lib/progression";
import { MUSCLES } from "@/lib/exerciseSeed";

type P = { id: string };

export const GET = route<P>(({ user, params }) => {
  const row = getExerciseRow(user.id, int(params.id));
  return {
    exercise: toExerciseDTO(row),
    prefs: { ...getPrefs(user.id, row.id), effectiveIncrementKg: incrementFor(user.id, row.id, user.weight_unit) },
    suggestion: suggest(user.id, row.id, { unit: user.weight_unit }),
    ...exerciseDetail(user.id, row.id),
  };
});

// PATCH { prefs?: {restS, incrementKg, note}, name?, primary?, secondary?, logType? (custom only) }
export const PATCH = route<P>(({ user, params, body }) => {
  const row = getExerciseRow(user.id, int(params.id));
  const b = body ?? {};
  if (b.prefs) {
    const p: Parameters<typeof setPrefs>[2] = {};
    if (b.prefs.restS !== undefined) p.restS = numOrNull(b.prefs.restS);
    if (b.prefs.incrementKg !== undefined) {
      p.incrementKg = numOrNull(b.prefs.incrementKg);
      if (p.incrementKg != null && !(p.incrementKg > 0 && p.incrementKg < 100)) throw bad("Increment out of range");
    }
    if (b.prefs.note !== undefined) p.note = b.prefs.note ? String(b.prefs.note).slice(0, 500) : null;
    setPrefs(user.id, row.id, p);
  }
  if (b.name !== undefined || b.primary !== undefined || b.secondary !== undefined || b.logType !== undefined) {
    if (row.is_builtin) throw new HttpError(403, "Built-in exercises can't be edited");
    const valid = (a: unknown) => (Array.isArray(a) ? a.filter(m => MUSCLES.some(x => x.id === m)) : []);
    db.prepare("UPDATE exercises SET name = ?, primary_muscles = ?, secondary_muscles = ?, log_type = ? WHERE id = ?").run(
      b.name !== undefined ? String(b.name).trim().slice(0, 80) || row.name : row.name,
      b.primary !== undefined ? JSON.stringify(valid(b.primary)) : row.primary_muscles,
      b.secondary !== undefined ? JSON.stringify(valid(b.secondary)) : row.secondary_muscles,
      ["weight_reps", "reps", "time"].includes(b.logType) ? b.logType : row.log_type,
      row.id,
    );
  }
  return { ok: true };
});

// Custom exercises are archived (history keeps working), built-ins can't be removed.
export const DELETE = route<P>(({ user, params }) => {
  const row = getExerciseRow(user.id, int(params.id));
  if (row.is_builtin) throw new HttpError(403, "Built-in exercises can't be deleted");
  db.prepare("UPDATE exercises SET archived = 1 WHERE id = ?").run(row.id);
  return { ok: true };
});
