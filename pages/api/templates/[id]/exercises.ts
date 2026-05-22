import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!["POST", "DELETE"].includes(req.method ?? "")) return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });

  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });
  const uid = session.user.id;

  const templateId = Number(req.query.id);
  const template = db.prepare("SELECT id FROM templates WHERE id = ? AND user_id = ?")
    .get(templateId, uid);
  if (!template) return res.status(404).json({ message: "Template not found" });

  if (req.method === "POST") {
    const { exerciseId, sets = 3, targetReps, targetWeight, restSeconds = 90 } = req.body as {
      exerciseId: number;
      sets?: number;
      targetReps?: string;
      targetWeight?: number;
      restSeconds?: number;
    };
    if (!exerciseId) return res.status(400).json({ message: "exerciseId required" });

    const exercise = db.prepare("SELECT id FROM exercises WHERE id = ?").get(exerciseId);
    if (!exercise) return res.status(404).json({ message: "Exercise not found" });

    const maxOrder = (db.prepare(
      "SELECT MAX(order_index) as m FROM template_exercises WHERE template_id = ?"
    ).get(templateId) as { m: number | null }).m ?? -1;

    const result = db.prepare(`
      INSERT INTO template_exercises (template_id, exercise_id, order_index, sets, target_reps, target_weight, rest_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(templateId, exerciseId, maxOrder + 1, sets, targetReps ?? null, targetWeight ?? null, restSeconds);

    return res.status(201).json({ id: result.lastInsertRowid });
  }

  if (req.method === "DELETE") {
    const { templateExerciseId } = req.body as { templateExerciseId: number };
    if (!templateExerciseId) return res.status(400).json({ message: "templateExerciseId required" });

    const te = db.prepare(
      "SELECT id FROM template_exercises WHERE id = ? AND template_id = ?"
    ).get(templateExerciseId, templateId);
    if (!te) return res.status(404).json({ message: "Exercise not in template" });

    db.prepare("DELETE FROM template_exercises WHERE id = ?").run(templateExerciseId);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
