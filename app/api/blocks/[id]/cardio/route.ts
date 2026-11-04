import { route, int, numOrNull, bad } from "@/lib/api";
import { updateCardio } from "@/lib/repo/sessions";
import type { CardioDTO } from "@/lib/types";

export const PATCH = route<{ id: string }>(({ user, params, body }) => {
  const b = body ?? {};
  const p: Partial<CardioDTO> = {};
  for (const k of ["durationS", "distanceM", "elevationM", "avgHr", "calories"] as const) {
    if (b[k] !== undefined) {
      const v = numOrNull(b[k]);
      if (v != null && v < 0) throw bad("Values can't be negative");
      p[k] = v;
    }
  }
  if (b.route !== undefined) p.route = b.route;
  if (b.done !== undefined) p.done = !!b.done;
  updateCardio(user.id, int(params.id), p);
  return { ok: true };
});
