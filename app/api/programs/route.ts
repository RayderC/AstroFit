import { route, bad } from "@/lib/api";
import { db } from "@/lib/db";
import { createRoutine } from "@/lib/repo/routines";
import type { RoutineBlockDTO } from "@/lib/types";

export const GET = route(({ user }) => {
  const programs = db.prepare("SELECT * FROM programs WHERE user_id = ? ORDER BY active DESC, id DESC").all(user.id) as
    { id: number; name: string; goal: string; config: string; active: number; created_at: string }[];
  return programs.map(p => ({
    id: p.id, name: p.name, goal: p.goal, active: !!p.active, createdAt: p.created_at, config: JSON.parse(p.config),
    days: db.prepare(`SELECT d.weekday, d.routine_id routineId, r.name FROM program_days d JOIN routines r ON r.id = d.routine_id
      WHERE d.program_id = ? ORDER BY (d.weekday + 6) % 7`).all(p.id),
  }));
});

// Save a (possibly edited) generated program: one routine per day, scheduled on weekdays.
export const POST = route(({ user, body }) => {
  const b = body ?? {};
  const days = b.days as { weekday: number; name: string; blocks: RoutineBlockDTO[] }[];
  if (!Array.isArray(days) || !days.length || days.length > 7) throw bad("Program needs 1–7 days");
  const seen = new Set<number>();
  for (const d of days) {
    if (!(d.weekday >= 0 && d.weekday <= 6) || seen.has(d.weekday)) throw bad("Each day needs its own weekday");
    seen.add(d.weekday);
  }
  const name = String(b.name ?? "My program").slice(0, 100);
  return db.transaction(() => {
    db.prepare("UPDATE programs SET active = 0 WHERE user_id = ?").run(user.id);
    const pid = Number(db.prepare("INSERT INTO programs (user_id, name, goal, config, active) VALUES (?, ?, ?, ?, 1)")
      .run(user.id, name, String(b.goal ?? "general"), JSON.stringify(b.config ?? {})).lastInsertRowid);
    for (const d of days) {
      const rid = createRoutine(user.id, `${name.split(" · ")[0]} — ${d.name}`, null, d.blocks, pid);
      db.prepare("INSERT INTO program_days (program_id, weekday, routine_id) VALUES (?, ?, ?)").run(pid, d.weekday, rid);
    }
    return { id: pid };
  })();
});
