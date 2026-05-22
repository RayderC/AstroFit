import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });

  const prs = db.prepare(`
    SELECT pr.*, e.name as exercise_name, e.category, e.muscle_groups
    FROM personal_records pr
    JOIN exercises e ON e.id = pr.exercise_id
    WHERE pr.user_id = ?
    ORDER BY pr.achieved_at DESC
  `).all(session.user.id);

  return res.json(prs);
}
