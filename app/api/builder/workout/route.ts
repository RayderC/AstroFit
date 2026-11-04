import { route, bad } from "@/lib/api";
import { buildWorkout, type Goal } from "@/lib/builder";
import { EQUIPMENT } from "@/lib/exerciseSeed";

export const POST = route(({ user, body }) => {
  const b = body ?? {};
  const equipment = Array.isArray(b.equipment) ? b.equipment.filter((e: string) => EQUIPMENT.some(x => x.id === e)) : [];
  const minutes = Math.min(120, Math.max(20, Number(b.minutes) || 60));
  const goal: Goal = ["strength", "muscle", "general"].includes(b.goal) ? b.goal : "muscle";
  if (typeof b.focus !== "string") throw bad("Pick a focus");
  const cardio = b.cardio?.activityTypeId ? { activityTypeId: Number(b.cardio.activityTypeId), minutes: Math.min(60, Math.max(5, Number(b.cardio.minutes) || 15)) } : null;
  return buildWorkout(user.id, { focus: b.focus, minutes, equipment, goal, seed: Number(b.seed) || 0, cardio });
});
