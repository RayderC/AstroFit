import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db, { createUser } from "@/lib/db";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user?.isAdmin) return res.status(403).json({ message: "Forbidden" });

  if (req.method === "GET") {
    const users = db.prepare(
      "SELECT id, username, is_admin, xp, level, streak_days, created_at FROM users ORDER BY created_at ASC"
    ).all();
    return res.json(users);
  }

  if (req.method === "POST") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { username, password, isAdmin = false } = req.body as {
      username: string;
      password: string;
      isAdmin?: boolean;
    };
    if (!username?.trim() || !password) return res.status(400).json({ message: "username and password required" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(username.trim().toLowerCase());
    if (existing) return res.status(409).json({ message: "Username already taken" });

    const id = createUser(username.trim().toLowerCase(), password, isAdmin);
    return res.status(201).json({ id });
  }

  res.status(405).end();
}
