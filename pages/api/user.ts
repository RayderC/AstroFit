import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../lib/session";
import db from "../../lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") { res.status(405).end(); return; }
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (session.user) {
    const xpRow = db.prepare("SELECT level FROM user_xp WHERE user_id = ?").get(session.user.id) as { level: number } | undefined;
    res.json({ ...session.user, level: xpRow?.level ?? 1 });
  } else {
    res.status(401).json({ user: null });
  }
}
