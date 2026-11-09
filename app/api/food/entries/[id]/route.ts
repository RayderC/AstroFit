import { int, route } from "@/lib/api";
import { deleteEntry, updateEntry } from "@/lib/repo/food";

type P = { id: string };

export const PATCH = route<P>(({ user, params, body }) => updateEntry(user.id, int(params.id), body ?? {}));

export const DELETE = route<P>(({ user, params }) => {
  deleteEntry(user.id, int(params.id));
  return { ok: true };
});
