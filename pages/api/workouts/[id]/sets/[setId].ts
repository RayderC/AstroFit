import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PATCH" && req.method !== "DELETE") return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });

  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });

  const workoutId = Number(req.query.id);
  const setId = Number(req.query.setId);

  const workout = db.prepare(
    "SELECT id FROM workouts WHERE id = ? AND user_id = ? AND completed_at IS NULL"
  ).get(workoutId, session.user.id);
  if (!workout) return res.status(404).json({ message: "Active workout not found" });

  const exists = db.prepare(`
    SELECT ws.id FROM workout_sets ws
    JOIN workout_exercises we ON we.id = ws.workout_exercise_id
    WHERE ws.id = ? AND we.workout_id = ?
  `).get(setId, workoutId);
  if (!exists) return res.status(404).json({ message: "Set not found" });

  if (req.method === "DELETE") {
    db.prepare("DELETE FROM workout_sets WHERE id = ?").run(setId);
    return res.json({ ok: true });
  }

  const { weight, reps, completed, is_warmup, rpe } = req.body as {
    weight?: number | null;
    reps?: number | null;
    completed?: boolean;
    is_warmup?: boolean;
    rpe?: number | null;
  };

  const setClauses: string[] = [];
  const params: any[] = [];

  if (weight !== undefined) { setClauses.push("weight = ?"); params.push(weight ?? null); }
  if (reps !== undefined) { setClauses.push("reps = ?"); params.push(reps ?? null); }
  if (rpe !== undefined) { setClauses.push("rpe = ?"); params.push(rpe ?? null); }
  if (is_warmup !== undefined) { setClauses.push("is_warmup = ?"); params.push(is_warmup ? 1 : 0); }
  if (completed !== undefined) {
    setClauses.push("completed = ?");
    params.push(completed ? 1 : 0);
    if (completed) {
      setClauses.push("completed_at = datetime('now')");
    } else {
      setClauses.push("completed_at = NULL");
    }
  }

  if (setClauses.length === 0) return res.status(400).json({ message: "Nothing to update" });

  params.push(setId);
  db.prepare(`UPDATE workout_sets SET ${setClauses.join(", ")} WHERE id = ?`).run(...params);

  const updated = db.prepare("SELECT * FROM workout_sets WHERE id = ?").get(setId);
  return res.json(updated);
}
