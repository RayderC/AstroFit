import { route, int, bad } from "@/lib/api";
import { addCardioBlock, addLiftBlock, getSession } from "@/lib/repo/sessions";

// POST { exerciseIds?: number[], activityTypeId?: number, supersetIds?: boolean }
export const POST = route<{ id: string }>(({ user, params, body }) => {
  const sid = int(params.id);
  const b = body ?? {};
  if (Array.isArray(b.exerciseIds) && b.exerciseIds.length) {
    const group = b.superset && b.exerciseIds.length > 1 ? Date.now() % 1_000_000 : null;
    for (const e of b.exerciseIds) addLiftBlock(user, sid, int(e, "exercise"), { superset: group });
  } else if (b.activityTypeId) {
    addCardioBlock(user, sid, int(b.activityTypeId, "activity"));
  } else throw bad("Pick an exercise or activity");
  return getSession(user, sid);
});
