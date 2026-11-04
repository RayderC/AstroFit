import { route, bad } from "@/lib/api";
import { db } from "@/lib/db";

export const GET = route(({ user }) => ({
  id: user.id,
  username: user.username,
  isAdmin: !!user.is_admin,
  weightUnit: user.weight_unit,
  distanceUnit: user.distance_unit,
  restDefault: user.rest_default,
}));

export const PATCH = route(({ user, body }) => {
  const b = body ?? {};
  if (b.weightUnit !== undefined) {
    if (!["lb", "kg"].includes(b.weightUnit)) throw bad("Invalid unit");
    db.prepare("UPDATE users SET weight_unit = ? WHERE id = ?").run(b.weightUnit, user.id);
  }
  if (b.distanceUnit !== undefined) {
    if (!["mi", "km"].includes(b.distanceUnit)) throw bad("Invalid unit");
    db.prepare("UPDATE users SET distance_unit = ? WHERE id = ?").run(b.distanceUnit, user.id);
  }
  if (b.restDefault !== undefined) {
    const r = Math.round(Number(b.restDefault));
    if (!(r >= 0 && r <= 900)) throw bad("Rest must be 0–900 seconds");
    db.prepare("UPDATE users SET rest_default = ? WHERE id = ?").run(r, user.id);
  }
  return { ok: true };
});
