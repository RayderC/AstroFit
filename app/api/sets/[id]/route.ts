import { route, int, numOrNull, bad } from "@/lib/api";
import { deleteSet, updateSet } from "@/lib/repo/sessions";

type P = { id: string };

export const PATCH = route<P>(({ user, params, body }) => {
  const b = body ?? {};
  const p: Parameters<typeof updateSet>[2] = {};
  if (b.kind !== undefined) p.kind = b.kind;
  for (const k of ["weightKg", "reps", "durationS", "rpe"] as const) {
    if (b[k] !== undefined) {
      const v = numOrNull(b[k]);
      if (v != null && v < 0) throw bad("Values can't be negative");
      p[k] = v;
    }
  }
  if (b.done !== undefined) p.done = !!b.done;
  updateSet(user.id, int(params.id), p);
  return { ok: true };
});

export const DELETE = route<P>(({ user, params }) => {
  deleteSet(user.id, int(params.id));
  return { ok: true };
});
