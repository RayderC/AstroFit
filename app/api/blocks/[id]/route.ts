import { route, int, numOrNull } from "@/lib/api";
import { deleteBlock, getSession, moveBlock, ownBlock, toggleSuperset, updateBlock } from "@/lib/repo/sessions";

type P = { id: string };

// PATCH { move?: 'up'|'down', superset?: true, restS?, saveRestDefault?, notes?, repMin?, repMax?, exerciseId? }
export const PATCH = route<P>(({ user, params, body }) => {
  const id = int(params.id);
  const b = body ?? {};
  const { session_id } = ownBlock(user.id, id);
  if (b.move === "up" || b.move === "down") moveBlock(user.id, id, b.move);
  if (b.superset) toggleSuperset(user.id, id);
  updateBlock(user, id, {
    restS: b.restS !== undefined ? numOrNull(b.restS) : undefined,
    saveRestDefault: !!b.saveRestDefault,
    notes: b.notes !== undefined ? (b.notes ? String(b.notes).slice(0, 1000) : null) : undefined,
    repMin: b.repMin !== undefined ? numOrNull(b.repMin) : undefined,
    repMax: b.repMax !== undefined ? numOrNull(b.repMax) : undefined,
    exerciseId: b.exerciseId !== undefined ? int(b.exerciseId, "exercise") : undefined,
  });
  return getSession(user, session_id);
});

export const DELETE = route<P>(({ user, params }) => {
  const id = int(params.id);
  const { session_id } = ownBlock(user.id, id);
  deleteBlock(user.id, id);
  return getSession(user, session_id);
});
