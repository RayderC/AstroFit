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
  const workout = db.prepare("SELECT * FROM workouts WHERE id = ? AND user_id = ? AND completed_at IS NULL")
    .get(workoutId, session.user.id);
  if (!workout) return res.status(404).json({ message: "Active workout not found" });

  const { exerciseId, sets = 3 } = req.body as { exerciseId: number; sets?: number };
  if (!exerciseId) return res.status(400).json({ message: "exerciseId required" });

  const maxOrder = (db.prepare("SELECT MAX(order_index) as m FROM workout_exercises WHERE workout_id = ?")
    .get(workoutId) as { m: number | null }).m ?? -1;

  const result = db.prepare(
    "INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, ?)"
  ).run(workoutId, exerciseId, maxOrder + 1);
  const weId = result.lastInsertRowid as number;

  // Pre-populate empty sets
  for (let i = 1; i <= (sets || 1); i++) {
    db.prepare("INSERT INTO workout_sets (workout_exercise_id, set_number) VALUES (?, ?)").run(weId, i);
  }

  res.status(201).json({ id: weId });
}
