import { route, int } from "@/lib/api";
import { addSet, getSession, ownBlock } from "@/lib/repo/sessions";
import type { SetKind } from "@/lib/types";

export const POST = route<{ id: string }>(({ user, params, body }) => {
  const id = int(params.id);
  const { session_id } = ownBlock(user.id, id);
  addSet(user.id, id, (body?.kind as SetKind) ?? "normal");
  return getSession(user, session_id);
});
