import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });
  const uid = session.user.id;

  const id = Number(req.query.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  const template = db.prepare("SELECT * FROM templates WHERE id = ? AND user_id = ?")
    .get(id, uid) as { id: number; name: string; description: string | null } | undefined;
  if (!template) return res.status(404).json({ message: "Not found" });

  if (req.method === "GET") {
    const exercises = db.prepare(`
      SELECT te.id, te.exercise_id, te.order_index, te.sets, te.target_reps,
             te.target_weight, te.rest_seconds,
             e.name as exercise_name, e.category, e.muscle_groups, e.equipment
      FROM template_exercises te
      JOIN exercises e ON e.id = te.exercise_id
      WHERE te.template_id = ?
      ORDER BY te.order_index
    `).all(id);
    return res.json({ ...template, exercises });
  }

  if (req.method === "PUT") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { name, description } = req.body as { name?: string; description?: string };
    if (name !== undefined && !name.trim()) return res.status(400).json({ message: "Name cannot be empty" });

    const setClauses: string[] = [];
    const params: any[] = [];
    if (name !== undefined) { setClauses.push("name = ?"); params.push(name.trim()); }
    if (description !== undefined) { setClauses.push("description = ?"); params.push(description.trim() || null); }
    if (setClauses.length === 0) return res.status(400).json({ message: "Nothing to update" });

    params.push(id);
    db.prepare(`UPDATE templates SET ${setClauses.join(", ")} WHERE id = ?`).run(...params);
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    db.prepare("DELETE FROM templates WHERE id = ?").run(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
