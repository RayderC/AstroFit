import { route, int, bad } from "@/lib/api";
import { db } from "@/lib/db";
import { finishSession, getSession, ownSession, pauseSession, updateSessionMeta } from "@/lib/repo/sessions";

type P = { id: string };

export const GET = route<P>(({ user, params }) => getSession(user, int(params.id)));

// PATCH { action?: 'pause'|'resume'|'finish', name?, notes?, startedAt?, endedAt? }
export const PATCH = route<P>(({ user, params, body }) => {
  const id = int(params.id);
  const b = body ?? {};
  if (b.action === "pause") pauseSession(user.id, id, true);
  else if (b.action === "resume") pauseSession(user.id, id, false);
  else if (b.action === "finish") return finishSession(user, id);
  else if (b.action) throw bad("Unknown action");
  updateSessionMeta(user.id, id, { name: b.name, notes: b.notes, startedAt: b.startedAt, endedAt: b.endedAt });
  return getSession(user, id);
});

export const DELETE = route<P>(({ user, params }) => {
  const s = ownSession(user.id, int(params.id));
  db.prepare("DELETE FROM sessions WHERE id = ?").run(s.id);
  return { ok: true };
});
