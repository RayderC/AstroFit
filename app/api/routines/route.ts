import { route, int } from "@/lib/api";
import { createRoutine, listRoutines, routineFromSession } from "@/lib/repo/routines";

export const GET = route(({ user }) => listRoutines(user.id));

export const POST = route(({ user, body }) => {
  const b = body ?? {};
  if (b.fromSessionId) return { id: routineFromSession(user.id, int(b.fromSessionId, "session")) };
  return { id: createRoutine(user.id, String(b.name ?? "New routine"), b.notes ?? null, b.blocks ?? []) };
});
