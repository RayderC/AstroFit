import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import { getUserById } from "@/lib/db";
import { xpToNextLevel } from "@/lib/xp";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });

  const user = getUserById(session.user.id);
  if (!user) return res.status(404).json({ message: "Not found" });

  const lvl = xpToNextLevel(user.xp);
  res.json({
    id: user.id,
    username: user.username,
    isAdmin: user.is_admin === 1,
    xp: user.xp,
    level: user.level,
    streakDays: user.streak_days,
    lastActivityDate: user.last_activity_date,
    createdAt: user.created_at,
    xpProgress: lvl,
  });
}
