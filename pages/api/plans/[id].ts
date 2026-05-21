import type { NextApiRequest, NextApiResponse } from "next";
import db from "../../../lib/db";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../../lib/session";
import { checkCsrf } from "../../../lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Login required" });
  const userId = session.user.id;
  const id = parseInt(String(req.query.id), 10);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  const plan = db.prepare("SELECT id FROM training_plans WHERE id = ? AND user_id = ?").get(id, userId);
  if (!plan) return res.status(404).json({ message: "Not found" });

  if (req.method === "PATCH") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { name, is_active, goal_date, start_date } = req.body ?? {};
    const updates: string[] = [];
    const values: unknown[] = [];
    if (name !== undefined) { updates.push("name = ?"); values.push(String(name).slice(0, 200)); }
    if (is_active !== undefined) {
      if (is_active) {
        db.prepare("UPDATE training_plans SET is_active = 0 WHERE user_id = ?").run(userId);
      }
      updates.push("is_active = ?"); values.push(is_active ? 1 : 0);
    }
    if (goal_date !== undefined) { updates.push("goal_date = ?"); values.push(goal_date); }
    if (start_date !== undefined) { updates.push("start_date = ?"); values.push(start_date); }
    if (updates.length === 0) return res.status(400).json({ message: "Nothing to update" });
    values.push(id);
    db.prepare(`UPDATE training_plans SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    db.prepare("DELETE FROM training_plans WHERE id = ? AND user_id = ?").run(id, userId);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
