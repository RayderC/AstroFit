import { int, route } from "@/lib/api";
import { deleteFood, updateFood } from "@/lib/repo/food";

type P = { id: string };

export const PATCH = route<P>(({ user, params, body }) => updateFood(user.id, int(params.id), body ?? {}));

export const DELETE = route<P>(({ user, params }) => {
  deleteFood(user.id, int(params.id));
  return { ok: true };
});
