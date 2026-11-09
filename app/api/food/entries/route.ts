import { route } from "@/lib/api";
import { addEntry, addQuickEntry, copyDay, day, MEALS } from "@/lib/repo/food";
import type { Meal } from "@/lib/types";

export const POST = route(({ user, body }) => {
  const b = body ?? {};
  if (b.copyFrom) return { copied: copyDay(user.id, b.copyFrom, day(b.day), MEALS.includes(b.meal) ? (b.meal as Meal) : undefined) };
  return b.foodId ? addEntry(user.id, b) : addQuickEntry(user.id, b);
});
