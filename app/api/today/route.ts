import { route, bad } from "@/lib/api";
import { db } from "@/lib/db";
import { listSessions } from "@/lib/repo/sessions";
import { listRoutines } from "@/lib/repo/routines";
import { readyToIncrease } from "@/lib/progression";
import { muscleSets } from "@/lib/stats";
import { exerciseDisplayName } from "@/lib/exerciseSeed";

// GET /api/today?weekStart=ISO&weekday=0-6  (both computed in the viewer's time zone)
export const GET = route(({ req, user }) => {
  const q = req.nextUrl.searchParams;
  const weekStart = q.get("weekStart") ?? "";
  const weekday = Number(q.get("weekday"));
  if (isNaN(Date.parse(weekStart)) || !(weekday >= 0 && weekday <= 6)) throw bad("weekStart and weekday required");

  const week = listSessions(user.id, { from: weekStart });
  const recent = listSessions(user.id, { limit: 5 });

  const ready = readyToIncrease(user.id, user.weight_unit).slice(0, 8).map(r => {
    const e = db.prepare("SELECT name, equipment FROM exercises WHERE id = ?").get(r.exerciseId) as { name: string; equipment: string };
    return { exerciseId: r.exerciseId, name: exerciseDisplayName(e.name, e.equipment), ...r.suggestion };
  });

  const program = db.prepare("SELECT id, name, goal FROM programs WHERE user_id = ? AND active = 1 ORDER BY id DESC LIMIT 1").get(user.id) as
    { id: number; name: string; goal: string } | undefined;
  let schedule: { weekday: number; routineId: number; name: string; hasCardio: boolean; hasLift: boolean }[] = [];
  let todayRoutine = null;
  if (program) {
    const routines = new Map(listRoutines(user.id).map(r => [r.id, r]));
    schedule = (db.prepare("SELECT weekday, routine_id FROM program_days WHERE program_id = ? ORDER BY weekday").all(program.id) as { weekday: number; routine_id: number }[])
      .map(d => {
        const r = routines.get(d.routine_id);
        return { weekday: d.weekday, routineId: d.routine_id, name: r?.name ?? "?", hasCardio: !!r?.blocks.some(b => b.kind === "cardio"), hasLift: !!r?.blocks.some(b => b.kind === "lift") };
      });
    const t = schedule.find(d => d.weekday === weekday);
    if (t) todayRoutine = routines.get(t.routineId) ?? null;
  }

  const body = db.prepare("SELECT date, weight_kg FROM body_entries WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY date DESC LIMIT 2").all(user.id) as { date: string; weight_kg: number }[];

  return {
    week, recent, ready,
    program: program ? { ...program, schedule } : null,
    todayRoutine,
    muscles: muscleSets(user.id, new Date(Date.now() - 7 * 86400_000).toISOString()),
    body,
  };
});
