export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Navigation from "../components/Navigation";
import GoalsClient from "./GoalsClient";

export default async function GoalsPage() {
  const session = await getIronSession<{ user?: { id: number } }>(await cookies(), sessionOptions);
  if (!session.user) redirect("/login");
  const userId = session.user.id;

  const unit = (db.prepare("SELECT unit_preference FROM users WHERE id = ?").get(userId) as { unit_preference: string } | undefined)?.unit_preference ?? "km";

  const goals = db.prepare(`
    SELECT * FROM goals WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC
  `).all(userId) as {
    id: number; type: string; title: string; target_value: number; unit: string | null;
    period_start: string | null; period_end: string | null; is_recurring: number; notes: string | null;
  }[];

  // Compute progress for each goal
  const goalsWithProgress = goals.map((g) => {
    let current = 0;
    if (g.type === "weekly_distance") {
      const row = db.prepare(`
        SELECT COALESCE(SUM(distance_meters),0) as total
        FROM workouts WHERE user_id = ? AND type = 'run'
          AND started_at >= datetime('now', 'weekday 0', '-7 days')
          AND started_at < datetime('now', 'weekday 0')
      `).get(userId) as { total: number };
      current = (row.total ?? 0) / 1000;
    } else if (g.type === "weekly_workouts") {
      const row = db.prepare(`
        SELECT COUNT(*) as c FROM workouts WHERE user_id = ?
          AND started_at >= datetime('now', 'weekday 0', '-7 days')
          AND started_at < datetime('now', 'weekday 0')
      `).get(userId) as { c: number };
      current = row.c ?? 0;
    } else if (g.type === "monthly_distance") {
      const row = db.prepare(`
        SELECT COALESCE(SUM(distance_meters),0) as total
        FROM workouts WHERE user_id = ? AND type = 'run'
          AND strftime('%Y-%m', started_at) = strftime('%Y-%m', 'now')
      `).get(userId) as { total: number };
      current = (row.total ?? 0) / 1000;
    }
    const pct = Math.min(100, g.target_value > 0 ? Math.round((current / g.target_value) * 100) : 0);
    return { ...g, current, pct };
  });

  return (
    <div>
      <Navigation />
      <GoalsClient goals={goalsWithProgress} unit={unit} />
    </div>
  );
}
