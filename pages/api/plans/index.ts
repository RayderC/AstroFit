import type { NextApiRequest, NextApiResponse } from "next";
import db from "../../../lib/db";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../../lib/session";
import { checkCsrf } from "../../../lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Login required" });
  const userId = session.user.id;

  if (req.method === "GET") {
    const plans = db.prepare("SELECT * FROM training_plans WHERE user_id = ? ORDER BY created_at DESC").all(userId);
    return res.json(plans);
  }

  if (req.method === "POST") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { name, description, goal_type, goal_date, weeks_duration, start_date } = req.body ?? {};
    if (!name?.trim()) return res.status(400).json({ message: "name is required" });

    const result = db.prepare(`
      INSERT INTO training_plans (user_id, name, description, goal_type, goal_date, weeks_duration, start_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      String(name).slice(0, 200).trim(),
      description ? String(description).slice(0, 1000) : null,
      goal_type ? String(goal_type).slice(0, 50) : null,
      goal_date ? String(goal_date) : null,
      weeks_duration ? parseInt(weeks_duration) : null,
      start_date ? String(start_date) : null,
    );
    return res.status(201).json({ id: result.lastInsertRowid });
  }

  res.status(405).end();
}
