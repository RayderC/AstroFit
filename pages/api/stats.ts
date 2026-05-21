import type { NextApiRequest, NextApiResponse } from "next";
import db from "../../lib/db";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../lib/session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Login required" });
  const userId = session.user.id;

  // Last 12 weeks of weekly volume
  const weeklyRuns = db.prepare(`
    SELECT
      strftime('%Y-W%W', started_at) as week,
      COUNT(*) as count,
      COALESCE(SUM(distance_meters), 0) as distance_meters,
      COALESCE(SUM(duration_seconds), 0) as duration_seconds
    FROM workouts
    WHERE user_id = ? AND type = 'run'
      AND started_at >= datetime('now', '-84 days')
    GROUP BY week ORDER BY week
  `).all(userId) as { week: string; count: number; distance_meters: number; duration_seconds: number }[];

  const weeklyStrength = db.prepare(`
    SELECT
      strftime('%Y-W%W', started_at) as week,
      COUNT(*) as count,
      COALESCE(SUM(duration_seconds), 0) as duration_seconds
    FROM workouts
    WHERE user_id = ? AND type = 'strength'
      AND started_at >= datetime('now', '-84 days')
    GROUP BY week ORDER BY week
  `).all(userId) as { week: string; count: number; duration_seconds: number }[];

  // Monthly distance trend (last 6 months)
  const monthlyDistance = db.prepare(`
    SELECT
      strftime('%Y-%m', started_at) as month,
      COALESCE(SUM(distance_meters), 0) as distance_meters
    FROM workouts
    WHERE user_id = ? AND type = 'run'
      AND started_at >= datetime('now', '-180 days')
    GROUP BY month ORDER BY month
  `).all(userId) as { month: string; distance_meters: number }[];

  // Recent pace trend (last 20 runs with pace)
  const paceTrend = db.prepare(`
    SELECT started_at, avg_pace_seconds_per_km, distance_meters
    FROM workouts
    WHERE user_id = ? AND type = 'run' AND avg_pace_seconds_per_km IS NOT NULL
    ORDER BY started_at DESC LIMIT 20
  `).all(userId) as { started_at: string; avg_pace_seconds_per_km: number; distance_meters: number }[];

  // All-time totals
  const totals = db.prepare(`
    SELECT
      COUNT(*) as total_workouts,
      COUNT(CASE WHEN type='run' THEN 1 END) as total_runs,
      COUNT(CASE WHEN type='strength' THEN 1 END) as total_strength,
      COALESCE(SUM(CASE WHEN type='run' THEN distance_meters END), 0) as total_distance_meters,
      COALESCE(SUM(duration_seconds), 0) as total_duration_seconds,
      COALESCE(SUM(calories), 0) as total_calories
    FROM workouts WHERE user_id = ?
  `).get(userId) as {
    total_workouts: number; total_runs: number; total_strength: number;
    total_distance_meters: number; total_duration_seconds: number; total_calories: number;
  };

  // Personal records
  const prs = db.prepare(`
    SELECT pr.record_type, pr.value, pr.achieved_at, w.title, w.started_at
    FROM personal_records pr
    LEFT JOIN workouts w ON w.id = pr.workout_id
    WHERE pr.user_id = ?
    ORDER BY pr.record_type
  `).all(userId) as { record_type: string; value: number; achieved_at: string; title: string; started_at: string }[];

  // XP & level
  const xpRow = db.prepare("SELECT total_xp, level FROM user_xp WHERE user_id = ?").get(userId) as
    | { total_xp: number; level: number } | undefined;

  return res.json({ weeklyRuns, weeklyStrength, monthlyDistance, paceTrend, totals, prs, xp: xpRow ?? { total_xp: 0, level: 1 } });
}
