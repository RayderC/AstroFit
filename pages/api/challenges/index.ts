import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db, { ensureWeeklyChallenges, getActiveWeekChallenges } from "@/lib/db";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });

  if (req.method === "GET") {
    ensureWeeklyChallenges();
    const challenges = getActiveWeekChallenges(session.user.id);
    return res.json(challenges);
  }

  // POST — admin creates a special challenge
  if (req.method === "POST") {
    if (!session.user.isAdmin) return res.status(403).json({ message: "Forbidden" });
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });

    const body = req.body as {
      title: string; description?: string; category?: string;
      targetType?: string; target_type?: string;
      targetValue?: number; target_value?: number;
      xpReward?: number; xp_reward?: number;
      startsAt?: string; starts_at?: string;
      endsAt?: string; ends_at?: string;
    };

    const title = body.title;
    const description = body.description;
    const category = body.category || "wildcard";
    const target_type = body.targetType ?? body.target_type;
    const target_value = body.targetValue ?? body.target_value;
    const xp_reward = body.xpReward ?? body.xp_reward ?? 100;
    const starts_at = body.startsAt ?? body.starts_at;
    const ends_at = body.endsAt ?? body.ends_at;

    if (!title || !target_type || !target_value || !starts_at || !ends_at) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const result = db.prepare(`
      INSERT INTO challenges (type, category, title, description, target_type, target_value, xp_reward, starts_at, ends_at, created_by)
      VALUES ('special', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      category, title, description ?? null,
      target_type, target_value, xp_reward,
      starts_at, ends_at, session.user.id
    );

    return res.status(201).json({ id: result.lastInsertRowid });
  }

  res.status(405).end();
}
