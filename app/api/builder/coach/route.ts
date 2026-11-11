import { HttpError, route } from "@/lib/api";
import { coachProfile } from "@/lib/coach";
import { coachNotes, type PlanSummary } from "@/lib/coachAi";
import { checkRateLimit } from "@/lib/rateLimit";

const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Optional AI notes on a personal plan. The plan summary only names days and exercises. */
export const POST = route(async ({ user, body }) => {
  // The free tier allows only a few requests a day, so one person can't burn through them.
  if (!checkRateLimit(`coach:${user.id}`, 6, 60 * 60 * 1000)) throw new HttpError(429, "That's a lot of coach notes for one hour. Try again later.");
  const b = body ?? {};
  const today = typeof b.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.today) ? b.today : new Date().toISOString().slice(0, 10);
  const plan: PlanSummary | null = b.plan && Array.isArray(b.plan.days) ? {
    name: text(b.plan.name, 120),
    days: b.plan.days.slice(0, 7).map((d: any) => ({
      weekday: text(d?.weekday, 12), name: text(d?.name, 60),
      exercises: Array.isArray(d?.exercises) ? d.exercises.slice(0, 12).map((e: unknown) => text(e, 80)) : [],
    })),
  } : null;
  return { tips: await coachNotes(coachProfile(user.id, today), plan, user.weight_unit) };
});
