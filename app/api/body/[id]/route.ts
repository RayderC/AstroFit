import { route, int } from "@/lib/api";
import { deleteBody } from "@/lib/repo/body";

export const DELETE = route<{ id: string }>(({ user, params }) => {
  deleteBody(user.id, int(params.id));
  return { ok: true };
});
