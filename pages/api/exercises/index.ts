import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });

  if (req.method === "GET") {
    const { q, category, limit: limitQ } = req.query as { q?: string; category?: string; limit?: string };
    const limit = Math.min(Number(limitQ) || 200, 500);
    let sql = `
      SELECT id, name, category, muscle_groups, equipment, is_builtin, created_by
      FROM exercises
      WHERE (is_builtin = 1 OR created_by = ?)
    `;
    const params: (string | number)[] = [session.user.id];
    if (q) { sql += " AND name LIKE ?"; params.push(`%${q}%`); }
    if (category && category !== "All" && category !== "all") { sql += " AND category = ?"; params.push(category); }
    sql += ` ORDER BY is_builtin DESC, name ASC LIMIT ${limit}`;
    const exercises = db.prepare(sql).all(...params);
    return res.json(exercises);
  }

  if (req.method === "POST") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const body = req.body as {
      name: string; category: string;
      muscleGroups?: string | string[]; muscle_groups?: string | string[];
      equipment?: string;
    };
    const { name, category, equipment } = body;
    if (!name || !category) return res.status(400).json({ message: "Name and category required" });

    const rawGroups = body.muscleGroups ?? body.muscle_groups;
    let muscleGroups: string[];
    if (Array.isArray(rawGroups)) {
      muscleGroups = rawGroups;
    } else if (typeof rawGroups === "string" && rawGroups) {
      muscleGroups = rawGroups.split(",").map(s => s.trim()).filter(Boolean);
    } else {
      muscleGroups = [];
    }

    const result = db.prepare(`
      INSERT INTO exercises (name, category, muscle_groups, equipment, is_builtin, created_by)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(name.trim(), category, JSON.stringify(muscleGroups), equipment ?? null, session.user.id);

    return res.status(201).json({ id: result.lastInsertRowid });
  }

  res.status(405).end();
}
