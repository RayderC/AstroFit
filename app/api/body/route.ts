import { route } from "@/lib/api";
import { listBody, saveBody } from "@/lib/repo/body";

export const GET = route(({ user }) => listBody(user.id));

// POST { date, weightKg?, bodyFatPct?, measurements?: { waist: meters, ... }, notes? }
export const POST = route(({ user, body }) => ({ entry: saveBody(user.id, body ?? {}) }));
