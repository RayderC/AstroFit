import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });

  const id = Number(req.query.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  const workout = db.prepare("SELECT * FROM workouts WHERE id = ? AND user_id = ?")
    .get(id, session.user.id) as { id: number; name: string; user_id: number; completed_at: string | null } | undefined;
  if (!workout) return res.status(404).json({ message: "Not found" });

  if (req.method === "GET") {
    const exercises = db.prepare(`
      SELECT we.id, we.exercise_id, we.order_index, we.notes,
             e.name as exercise_name, e.category, e.muscle_groups, e.equipment
      FROM workout_exercises we
      JOIN exercises e ON e.id = we.exercise_id
      WHERE we.workout_id = ?
      ORDER BY we.order_index
    `).all(id) as { id: number; exercise_id: number; order_index: number; exercise_name: string; category: string; muscle_groups: string }[];

    const sets = db.prepare(`
      SELECT ws.*
      FROM workout_sets ws
      JOIN workout_exercises we ON we.id = ws.workout_exercise_id
      WHERE we.workout_id = ?
      ORDER BY ws.workout_exercise_id, ws.set_number
    `).all(id);

    return res.json({ ...workout, exercises, sets });
  }

  if (req.method === "DELETE") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    if (workout.completed_at) return res.status(400).json({ message: "Cannot delete a completed workout" });
    db.prepare("DELETE FROM workouts WHERE id = ?").run(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
