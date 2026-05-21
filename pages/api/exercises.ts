import type { NextApiRequest, NextApiResponse } from "next";
import db from "../../lib/db";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../lib/session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Login required" });
  const userId = session.user.id;

  if (req.method !== "GET") return res.status(405).end();

  // Most recently used distinct exercises for this user, with last-used sets
  const recentExercises = db.prepare(`
    SELECT we.exercise_name, we.muscle_group, MAX(w.started_at) as last_used
    FROM workout_exercises we
    JOIN workouts w ON we.workout_id = w.id
    WHERE w.user_id = ?
    GROUP BY LOWER(we.exercise_name)
    ORDER BY last_used DESC
    LIMIT 30
  `).all(userId) as { exercise_name: string; muscle_group: string; last_used: string }[];

  // For each exercise, get the sets from the most recent workout that included it
  const result = recentExercises.map((ex) => {
    const lastSets = db.prepare(`
      SELECT es.set_number, es.reps, es.weight_kg, es.duration_seconds
      FROM exercise_sets es
      JOIN workout_exercises we ON es.workout_exercise_id = we.id
      JOIN workouts w ON we.workout_id = w.id
      WHERE w.user_id = ? AND LOWER(we.exercise_name) = LOWER(?)
      ORDER BY w.started_at DESC, es.set_number ASC
      LIMIT 8
    `).all(userId, ex.exercise_name) as {
      set_number: number; reps: number | null; weight_kg: number | null; duration_seconds: number | null;
    }[];
    return { ...ex, lastSets };
  });

  return res.json(result);
}
