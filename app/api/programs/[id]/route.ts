import { route, int, notFound } from "@/lib/api";
import { db } from "@/lib/db";

type P = { id: string };
const own = (userId: number, id: number) => {
  const p = db.prepare("SELECT id FROM programs WHERE id = ? AND user_id = ?").get(id, userId);
  if (!p) throw notFound("Program not found");
};

// { active: boolean } — only one program is active at a time
export const PATCH = route<P>(({ user, params, body }) => {
  const id = int(params.id);
  own(user.id, id);
  db.transaction(() => {
    if (body?.active) db.prepare("UPDATE programs SET active = 0 WHERE user_id = ?").run(user.id);
    db.prepare("UPDATE programs SET active = ? WHERE id = ?").run(body?.active ? 1 : 0, id);
  })();
  return { ok: true };
});

// Deleting a program removes its routines; logged workouts stay in history.
export const DELETE = route<P>(({ user, params }) => {
  const id = int(params.id);
  own(user.id, id);
  db.prepare("DELETE FROM programs WHERE id = ?").run(id);
  return { ok: true };
});
