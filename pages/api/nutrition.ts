import type { NextApiRequest, NextApiResponse } from "next";
import db from "../../lib/db";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../lib/session";
import { checkCsrf } from "../../lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Login required" });
  const userId = session.user.id;

  if (req.method === "GET") {
    const { date } = req.query;
    if (date) {
      // Return single day's logs + goals
      const logs = db.prepare(`
        SELECT * FROM nutrition_logs WHERE user_id = ? AND logged_date = ? ORDER BY created_at
      `).all(userId, String(date));
      const goals = db.prepare("SELECT * FROM nutrition_goals WHERE user_id = ?").get(userId);
      return res.json({ logs, goals });
    }
    // Return last 30 days of daily summaries
    const summaries = db.prepare(`
      SELECT
        logged_date,
        ROUND(SUM(calories)) as calories,
        ROUND(SUM(protein_g), 1) as protein_g,
        ROUND(SUM(carbs_g), 1) as carbs_g,
        ROUND(SUM(fat_g), 1) as fat_g,
        COUNT(*) as entries
      FROM nutrition_logs
      WHERE user_id = ? AND logged_date >= date('now', '-30 days')
      GROUP BY logged_date ORDER BY logged_date DESC
    `).all(userId);
    const goals = db.prepare("SELECT * FROM nutrition_goals WHERE user_id = ?").get(userId);
    return res.json({ summaries, goals });
  }

  if (req.method === "POST") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { logged_date, meal_type, food_name, calories, protein_g, carbs_g, fat_g, amount_g, notes } = req.body ?? {};

    if (!food_name || !logged_date) {
      return res.status(400).json({ message: "food_name and logged_date are required" });
    }

    const result = db.prepare(`
      INSERT INTO nutrition_logs (user_id, logged_date, meal_type, food_name, calories, protein_g, carbs_g, fat_g, amount_g, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      String(logged_date),
      meal_type ? String(meal_type) : "snack",
      String(food_name).slice(0, 200),
      calories ? Number(calories) : null,
      protein_g ? Number(protein_g) : null,
      carbs_g ? Number(carbs_g) : null,
      fat_g ? Number(fat_g) : null,
      amount_g ? Number(amount_g) : null,
      notes ? String(notes).slice(0, 300) : null,
    );
    return res.status(201).json({ id: result.lastInsertRowid });
  }

  if (req.method === "PATCH") {
    // Update nutrition goals
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { calories, protein_g, carbs_g, fat_g } = req.body ?? {};
    db.prepare(`
      INSERT INTO nutrition_goals (user_id, calories, protein_g, carbs_g, fat_g, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        calories = ?, protein_g = ?, carbs_g = ?, fat_g = ?, updated_at = datetime('now')
    `).run(
      userId, calories ?? null, protein_g ?? null, carbs_g ?? null, fat_g ?? null,
      calories ?? null, protein_g ?? null, carbs_g ?? null, fat_g ?? null,
    );
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { id } = req.query;
    const rowId = parseInt(String(id), 10);
    if (isNaN(rowId)) return res.status(400).json({ message: "Invalid id" });
    db.prepare("DELETE FROM nutrition_logs WHERE id = ? AND user_id = ?").run(rowId, userId);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
