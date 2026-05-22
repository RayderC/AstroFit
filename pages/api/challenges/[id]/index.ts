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

  const challenge = db.prepare("SELECT * FROM challenges WHERE id = ?")
    .get(id) as { id: number; type: string } | undefined;
  if (!challenge) return res.status(404).json({ message: "Challenge not found" });

  if (req.method === "GET") {
    const progress = db.prepare(
      "SELECT progress, completed, completed_at FROM user_challenges WHERE user_id = ? AND challenge_id = ?"
    ).get(session.user.id, id);
    return res.json({ ...challenge, userProgress: progress ?? { progress: 0, completed: 0 } });
  }

  if (!session.user.isAdmin) return res.status(403).json({ message: "Forbidden" });

  if (req.method === "PUT") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { title, description, xpReward, endsAt } = req.body as {
      title?: string;
      description?: string;
      xpReward?: number;
      endsAt?: string;
    };

    const setClauses: string[] = [];
    const params: any[] = [];
    if (title !== undefined) { setClauses.push("title = ?"); params.push(title); }
    if (description !== undefined) { setClauses.push("description = ?"); params.push(description); }
    if (xpReward !== undefined) { setClauses.push("xp_reward = ?"); params.push(xpReward); }
    if (endsAt !== undefined) { setClauses.push("ends_at = ?"); params.push(endsAt); }

    if (setClauses.length === 0) return res.status(400).json({ message: "Nothing to update" });
    params.push(id);
    db.prepare(`UPDATE challenges SET ${setClauses.join(", ")} WHERE id = ?`).run(...params);
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    db.prepare("DELETE FROM challenges WHERE id = ?").run(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
