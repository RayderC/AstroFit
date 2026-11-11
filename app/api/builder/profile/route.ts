import { route } from "@/lib/api";
import { coachProfile, saveAbout } from "@/lib/coach";
import { aiEnabled } from "@/lib/coachAi";

const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : new Date().toISOString().slice(0, 10));

/** What the builder knows about you and your training, and the plan it recommends. */
export const GET = route(({ req, user }) => ({ ...coachProfile(user.id, day(req.nextUrl.searchParams.get("today"))), aiEnabled: aiEnabled() }));

/** Save height, sex and birth year, plus weight and body fat for today when they changed. */
export const PUT = route(({ user, body }) => {
  const b = body ?? {};
  const today = day(b.today);
  saveAbout(user.id, b, today);
  return { ...coachProfile(user.id, today), aiEnabled: aiEnabled() };
});
