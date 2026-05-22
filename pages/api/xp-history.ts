import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const events = db.prepare(`
    SELECT id, amount, reason, ref_type, created_at
    FROM xp_events
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `).all(session.user.id, limit);

  return res.json(events);
}
