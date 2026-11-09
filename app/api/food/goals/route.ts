import { route } from "@/lib/api";
import { setGoals } from "@/lib/repo/food";

export const PATCH = route(({ user, body }) => {
  setGoals(user.id, body ?? {});
  return { ok: true };
});
