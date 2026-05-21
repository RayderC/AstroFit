import type { NextApiRequest, NextApiResponse } from "next";
import db from "../../../lib/db";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../../lib/session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user?.isAdmin) return res.status(403).json({ message: "Forbidden" });

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users) as total_users,
      COUNT(*) as total_workouts,
      COUNT(CASE WHEN type='run' THEN 1 END) as total_runs,
      COALESCE(SUM(CASE WHEN type='run' THEN distance_meters END), 0) as total_distance_meters
    FROM workouts
  `).get() as {
    total_users: number; total_workouts: number; total_runs: number; total_distance_meters: number;
  };

  return res.json({ ...stats, active_today: 0 });
}
