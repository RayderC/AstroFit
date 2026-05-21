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

  const goal = db.prepare("SELECT id FROM goals WHERE id = ? AND user_id = ?").get(id, userId);
  if (!goal) return res.status(404).json({ message: "Not found" });

  if (req.method === "PATCH") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { title, target_value, period_start, period_end, is_active, notes } = req.body ?? {};
    const updates: string[] = [];
    const values: unknown[] = [];
    if (title !== undefined) { updates.push("title = ?"); values.push(String(title).slice(0, 200)); }
    if (target_value !== undefined) { updates.push("target_value = ?"); values.push(Number(target_value)); }
    if (period_start !== undefined) { updates.push("period_start = ?"); values.push(period_start); }
    if (period_end !== undefined) { updates.push("period_end = ?"); values.push(period_end); }
    if (is_active !== undefined) { updates.push("is_active = ?"); values.push(is_active ? 1 : 0); }
    if (notes !== undefined) { updates.push("notes = ?"); values.push(String(notes).slice(0, 500)); }
    if (updates.length === 0) return res.status(400).json({ message: "Nothing to update" });
    values.push(id);
    db.prepare(`UPDATE goals SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    db.prepare("UPDATE goals SET is_active = 0 WHERE id = ? AND user_id = ?").run(id, userId);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
