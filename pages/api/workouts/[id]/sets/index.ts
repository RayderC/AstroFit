import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });

  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });

  const workoutId = Number(req.query.id);

  const workout = db.prepare(
    "SELECT id FROM workouts WHERE id = ? AND user_id = ? AND completed_at IS NULL"
  ).get(workoutId, session.user.id);
  if (!workout) return res.status(404).json({ message: "Active workout not found" });

  const { workoutExerciseId } = req.body as { workoutExerciseId: number };
  if (!workoutExerciseId) return res.status(400).json({ message: "workoutExerciseId required" });

  const we = db.prepare(
    "SELECT id FROM workout_exercises WHERE id = ? AND workout_id = ?"
  ).get(workoutExerciseId, workoutId);
  if (!we) return res.status(404).json({ message: "Exercise not in this workout" });

  const maxSet = (db.prepare(
    "SELECT MAX(set_number) as m FROM workout_sets WHERE workout_exercise_id = ?"
  ).get(workoutExerciseId) as { m: number | null }).m ?? 0;

  const result = db.prepare(
    "INSERT INTO workout_sets (workout_exercise_id, set_number) VALUES (?, ?)"
  ).run(workoutExerciseId, maxSet + 1);

  const newSet = db.prepare("SELECT * FROM workout_sets WHERE id = ?").get(result.lastInsertRowid);
  return res.status(201).json(newSet);
}
