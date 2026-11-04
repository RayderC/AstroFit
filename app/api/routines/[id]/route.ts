import { route, int } from "@/lib/api";
import { db } from "@/lib/db";
import { getRoutine, updateRoutine } from "@/lib/repo/routines";

type P = { id: string };

export const GET = route<P>(({ user, params }) => getRoutine(user.id, int(params.id)));

export const PUT = route<P>(({ user, params, body }) => {
  const id = int(params.id);
  updateRoutine(user.id, id, { name: body?.name, notes: body?.notes, blocks: body?.blocks });
  return getRoutine(user.id, id);
});

export const DELETE = route<P>(({ user, params }) => {
  const r = getRoutine(user.id, int(params.id));
  db.prepare("DELETE FROM routines WHERE id = ?").run(r.id);
  return { ok: true };
});
