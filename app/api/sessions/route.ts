import { route, bad, int } from "@/lib/api";
import { createSession, getSession, listSessions, startFromRoutine, addCardioBlock } from "@/lib/repo/sessions";
import { db } from "@/lib/db";

// GET /api/sessions?from=ISO&to=ISO&limit=N
export const GET = route(({ req, user }) => {
  const q = req.nextUrl.searchParams;
  return listSessions(user.id, {
    from: q.get("from") ?? undefined,
    to: q.get("to") ?? undefined,
    limit: q.get("limit") ? Math.min(500, int(q.get("limit"), "limit")) : undefined,
  });
});

// POST { routineId? , name?, past?: {startedAt, endedAt}, cardio?: {activityTypeId, durationS, distanceM} }
export const POST = route(({ user, body }) => {
  const b = body ?? {};
  if (b.routineId) return { id: startFromRoutine(user, int(b.routineId, "routine")) };
  if (b.past) {
    // logging a workout after the fact
    const { startedAt, endedAt } = b.past;
    if (isNaN(Date.parse(startedAt)) || isNaN(Date.parse(endedAt)) || Date.parse(endedAt) < Date.parse(startedAt)) throw bad("Invalid times");
    return { id: createSession(user, { name: b.name, startedAt: new Date(startedAt).toISOString(), endedAt: new Date(endedAt).toISOString() }) };
  }
  if (b.cardio) {
    // quick cardio log: one finished cardio block
    const { activityTypeId, durationS, distanceM, startedAt } = b.cardio;
    const dur = Number(durationS);
    if (!(dur > 0)) throw bad("Duration required");
    const start = startedAt && !isNaN(Date.parse(startedAt)) ? new Date(startedAt) : new Date(Date.now() - dur * 1000);
    return db.transaction(() => {
      const id = createSession(user, { name: b.name, startedAt: start.toISOString(), endedAt: new Date(start.getTime() + dur * 1000).toISOString() });
      const blockId = addCardioBlock(user, id, int(activityTypeId, "activity"), { durationS: dur, distanceM: distanceM ?? null });
      db.prepare("UPDATE cardio SET done = 1 WHERE block_id = ?").run(blockId);
      return { id, session: getSession(user, id) };
    })();
  }
  return { id: createSession(user, { name: b.name }) };
});
