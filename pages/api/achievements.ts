import type { NextApiRequest, NextApiResponse } from "next";
import db from "../../lib/db";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../lib/session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Login required" });
  const userId = session.user.id;

  const all = db.prepare("SELECT * FROM achievements ORDER BY category, xp_reward").all() as {
    id: number; code: string; name: string; description: string; icon: string; xp_reward: number; category: string;
  }[];

  const earned = db.prepare(`
    SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ?
  `).all(userId) as { achievement_id: number; earned_at: string }[];

  const earnedSet = new Map(earned.map((e) => [e.achievement_id, e.earned_at]));

  const prs = db.prepare(`
    SELECT pr.record_type, pr.value, pr.achieved_at, w.title
    FROM personal_records pr LEFT JOIN workouts w ON w.id = pr.workout_id
    WHERE pr.user_id = ? ORDER BY pr.record_type
  `).all(userId) as { record_type: string; value: number; achieved_at: string; title: string }[];

  const xp = db.prepare("SELECT total_xp, level FROM user_xp WHERE user_id = ?").get(userId) as
    | { total_xp: number; level: number } | undefined;

  return res.json({
    achievements: all.map((a) => ({
      ...a,
      earned: earnedSet.has(a.id),
      earned_at: earnedSet.get(a.id) ?? null,
    })),
    personal_records: prs,
    xp: xp ?? { total_xp: 0, level: 1 },
  });
}
