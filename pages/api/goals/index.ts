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
    const goals = db.prepare(`
      SELECT * FROM goals WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC
    `).all(userId);
    return res.json(goals);
  }

  if (req.method === "POST") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });

    const { type, title, target_value, unit, period_start, period_end, is_recurring, notes } = req.body ?? {};
    if (!type || !title || target_value == null) {
      return res.status(400).json({ message: "type, title, and target_value are required" });
    }

    const result = db.prepare(`
      INSERT INTO goals (user_id, type, title, target_value, unit, period_start, period_end, is_recurring, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      String(type).slice(0, 50),
      String(title).slice(0, 200),
      Number(target_value),
      unit ? String(unit).slice(0, 20) : null,
      period_start ? String(period_start) : null,
      period_end ? String(period_end) : null,
      is_recurring ? 1 : 0,
      notes ? String(notes).slice(0, 500) : null,
    );

    return res.status(201).json({ id: result.lastInsertRowid });
  }

  res.status(405).end();
}
