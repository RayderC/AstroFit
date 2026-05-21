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
    const rows = db.prepare(`
      SELECT * FROM body_metrics WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 100
    `).all(userId);
    return res.json(rows);
  }

  if (req.method === "POST") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });

    const { recorded_at, weight_kg, body_fat_pct, chest_cm, waist_cm, hips_cm, arms_cm, legs_cm, notes } = req.body ?? {};

    const result = db.prepare(`
      INSERT INTO body_metrics
        (user_id, recorded_at, weight_kg, body_fat_pct, chest_cm, waist_cm, hips_cm, arms_cm, legs_cm, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      userId,
      recorded_at ? new Date(recorded_at).toISOString() : new Date().toISOString(),
      weight_kg ? Number(weight_kg) : null,
      body_fat_pct ? Number(body_fat_pct) : null,
      chest_cm ? Number(chest_cm) : null,
      waist_cm ? Number(waist_cm) : null,
      hips_cm ? Number(hips_cm) : null,
      arms_cm ? Number(arms_cm) : null,
      legs_cm ? Number(legs_cm) : null,
      notes ? String(notes).slice(0, 500) : null,
    );

    return res.status(201).json({ id: result.lastInsertRowid });
  }

  if (req.method === "DELETE") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { id } = req.query;
    const rowId = parseInt(String(id), 10);
    if (isNaN(rowId)) return res.status(400).json({ message: "Invalid id" });
    db.prepare("DELETE FROM body_metrics WHERE id = ? AND user_id = ?").run(rowId, userId);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
