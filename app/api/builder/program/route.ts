import { route } from "@/lib/api";
import { buildProgram, type Goal } from "@/lib/builder";
import { EQUIPMENT } from "@/lib/exerciseSeed";

export const POST = route(({ user, body }) => {
  const b = body ?? {};
  return buildProgram(user.id, {
    goal: ["strength", "muscle", "general"].includes(b.goal) ? (b.goal as Goal) : "muscle",
    days: Math.min(6, Math.max(2, Number(b.days) || 4)),
    split: typeof b.split === "string" ? b.split : undefined,
    weekdays: Array.isArray(b.weekdays) ? b.weekdays.map(Number).slice(0, 7) : undefined,
    seed: Math.max(0, Math.min(1000, Number(b.seed) || 0)),
    minutes: Math.min(120, Math.max(30, Number(b.minutes) || 60)),
    equipment: Array.isArray(b.equipment) ? b.equipment.filter((e: string) => EQUIPMENT.some(x => x.id === e)) : [],
    cardioDays: Math.min(4, Math.max(0, Number(b.cardioDays) || 0)),
    cardioMinutes: Math.min(90, Math.max(10, Number(b.cardioMinutes) || 30)),
    activityTypeId: b.activityTypeId ? Number(b.activityTypeId) : null,
  });
});
