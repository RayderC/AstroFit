import { bad, numOrNull, route } from "@/lib/api";
import { cancelRestPush, scheduleRestPush } from "@/lib/push";

// POST { seconds, label?, sessionId? } starts the server's copy of the rest timer. DELETE cancels it.
export const POST = route(({ user, body }) => {
  const seconds = Number(body?.seconds);
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 3600) throw bad("Invalid rest time");
  const label = typeof body?.label === "string" ? body.label.slice(0, 100) : "";
  return { scheduled: scheduleRestPush(user.id, seconds, label, numOrNull(body?.sessionId)) };
});

export const DELETE = route(({ user }) => {
  cancelRestPush(user.id);
  return { ok: true };
});
