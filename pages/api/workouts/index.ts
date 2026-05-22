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
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const workouts = db.prepare(`
      SELECT w.id, w.name, w.started_at, w.completed_at, w.duration_seconds, w.xp_earned,
             COUNT(DISTINCT we.exercise_id) as exercise_count,
             COUNT(CASE WHEN ws.completed = 1 THEN 1 END) as set_count
      FROM workouts w
      LEFT JOIN workout_exercises we ON we.workout_id = w.id
      LEFT JOIN workout_sets ws ON ws.workout_exercise_id = we.id
      WHERE w.user_id = ? AND w.completed_at IS NOT NULL
      GROUP BY w.id
      ORDER BY w.started_at DESC
      LIMIT ? OFFSET ?
    `).all(uid, limit, offset);
    return res.json(workouts);
  }

  if (req.method === "POST") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { name, templateId } = req.body as { name?: string; templateId?: number };

    // Check for an existing active (non-completed) workout
    const active = db.prepare(
      "SELECT id FROM workouts WHERE user_id = ? AND completed_at IS NULL"
    ).get(uid) as { id: number } | undefined;
    if (active) return res.status(409).json({ message: "You already have an active workout", id: active.id });

    const workoutName = name?.trim() || (templateId ? "Template Workout" : "Quick Workout");
    const result = db.prepare(
      "INSERT INTO workouts (user_id, template_id, name) VALUES (?, ?, ?)"
    ).run(uid, templateId ?? null, workoutName);

    const workoutId = result.lastInsertRowid as number;

    // If started from template, pre-populate exercises
    if (templateId) {
      const templateExs = db.prepare(
        "SELECT * FROM template_exercises WHERE template_id = ? ORDER BY order_index"
      ).all(templateId) as { exercise_id: number; sets: number; target_reps: string; target_weight: number; rest_seconds: number; order_index: number }[];

      for (const te of templateExs) {
        const weResult = db.prepare(
          "INSERT INTO workout_exercises (workout_id, exercise_id, order_index) VALUES (?, ?, ?)"
        ).run(workoutId, te.exercise_id, te.order_index);
        const weId = weResult.lastInsertRowid as number;

        for (let i = 1; i <= te.sets; i++) {
          db.prepare(
            "INSERT INTO workout_sets (workout_exercise_id, set_number, weight, reps) VALUES (?, ?, ?, ?)"
          ).run(weId, i, te.target_weight ?? null, te.target_reps ? parseInt(te.target_reps) : null);
        }
      }
    }

    return res.status(201).json({ id: workoutId });
  }

  res.status(405).end();
}
