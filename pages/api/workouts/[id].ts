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

  const workout = db.prepare("SELECT * FROM workouts WHERE id = ? AND user_id = ?").get(id, userId) as
    | { id: number; type: string; [key: string]: unknown } | undefined;
  if (!workout) return res.status(404).json({ message: "Not found" });

  if (req.method === "GET") {
    const exercises = db.prepare(`
      SELECT we.id, we.exercise_name, we.muscle_group, we.order_index, we.notes
      FROM workout_exercises we WHERE we.workout_id = ? ORDER BY we.order_index
    `).all(id);

    const sets = db.prepare(`
      SELECT es.*, we.id as exercise_id
      FROM exercise_sets es
      JOIN workout_exercises we ON we.id = es.workout_exercise_id
      WHERE we.workout_id = ?
      ORDER BY es.workout_exercise_id, es.set_number
    `).all(id);

    const splits = db.prepare(`
      SELECT * FROM run_splits WHERE workout_id = ? ORDER BY split_number
    `).all(id);

    return res.json({ ...workout, exercises, sets, splits });
  }

  if (req.method === "PATCH") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });

    const allowed = [
      "title", "notes", "started_at", "duration_seconds",
      "distance_meters", "avg_pace_seconds_per_km", "avg_heart_rate",
      "elevation_gain_meters", "calories",
    ];

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const field of allowed) {
      if (req.body?.[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) return res.status(400).json({ message: "Nothing to update" });

    values.push(id);
    db.prepare(`UPDATE workouts SET ${updates.join(", ")} WHERE id = ?`).run(...values);
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    db.prepare("DELETE FROM workouts WHERE id = ? AND user_id = ?").run(id, userId);
    return res.json({ ok: true });
  }

  // Handle form-based DELETE via _method override
  if (req.method === "POST" && req.body?._method === "DELETE") {
    db.prepare("DELETE FROM workouts WHERE id = ? AND user_id = ?").run(id, userId);
    res.writeHead(303, { Location: "/workouts" });
    return res.end();
  }

  res.status(405).end();
}
