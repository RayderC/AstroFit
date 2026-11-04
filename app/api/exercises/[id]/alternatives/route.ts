import { route, int } from "@/lib/api";
import { getExerciseRow, listExercises } from "@/lib/repo/exercises";

// Same movement pattern first, then anything hitting the same primary muscle.
export const GET = route<{ id: string }>(({ user, params }) => {
  const ex = getExerciseRow(user.id, int(params.id));
  const prim: string[] = JSON.parse(ex.primary_muscles);
  const all = listExercises(user.id).filter(e => e.id !== ex.id);
  const same = all.filter(e => ex.pattern && e.pattern === ex.pattern);
  const muscle = all.filter(e => !same.includes(e) && e.primary.some(m => prim.includes(m)));
  return [...same, ...muscle].slice(0, 40);
});
