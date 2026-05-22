import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });
  const uid = session.user.id;

  if (req.method === "GET") {
    const templates = db.prepare(`
      SELECT t.id, t.name, t.description, t.created_at,
             COUNT(DISTINCT te.exercise_id) as exercise_count,
             COALESCE(SUM(te.sets), 0) as total_sets
      FROM templates t
      LEFT JOIN template_exercises te ON te.template_id = t.id
      WHERE t.user_id = ?
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `).all(uid);
    return res.json(templates);
  }

  if (req.method === "POST") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { name, description } = req.body as { name: string; description?: string };
    if (!name?.trim()) return res.status(400).json({ message: "Name required" });

    const result = db.prepare(
      "INSERT INTO templates (user_id, name, description) VALUES (?, ?, ?)"
    ).run(uid, name.trim(), description?.trim() ?? null);

    return res.status(201).json({ id: result.lastInsertRowid });
  }

  res.status(405).end();
}
