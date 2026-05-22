import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });

  const exerciseId = Number(req.query.id);
  if (isNaN(exerciseId)) return res.status(400).json({ message: "Invalid id" });

  // Last 30 sessions for this exercise
  const sets = db.prepare(`
    SELECT ws.weight, ws.reps, ws.completed_at,
           w.started_at as workout_date,
           we.id as workout_exercise_id
    FROM workout_sets ws
    JOIN workout_exercises we ON we.id = ws.workout_exercise_id
    JOIN workouts w ON w.id = we.workout_id
    WHERE w.user_id = ? AND we.exercise_id = ?
      AND ws.completed = 1 AND ws.weight IS NOT NULL AND ws.reps IS NOT NULL
    ORDER BY w.started_at DESC
    LIMIT 200
  `).all(session.user.id, exerciseId);

  const pr = db.prepare(
    "SELECT * FROM personal_records WHERE user_id = ? AND exercise_id = ?"
  ).get(session.user.id, exerciseId);

  res.json({ sets, pr });
}
