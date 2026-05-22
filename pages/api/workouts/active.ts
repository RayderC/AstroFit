import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });

  const active = db.prepare(
    "SELECT id, name, started_at FROM workouts WHERE user_id = ? AND completed_at IS NULL"
  ).get(session.user.id);

  if (!active) return res.status(404).json({ message: "No active workout" });
  return res.json(active);
}
