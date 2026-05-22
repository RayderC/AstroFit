import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db, { countUsers, createUser, getUserByUsername } from "@/lib/db";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });

  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user?.isAdmin) return res.status(403).json({ message: "Forbidden" });

  const { username, password, isAdmin } = req.body as {
    username?: string; password?: string; isAdmin?: boolean;
  };
  if (!username || !password) return res.status(400).json({ message: "Missing fields" });
  if (username.length < 2) return res.status(400).json({ message: "Username too short" });
  if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

  if (getUserByUsername(username.trim().toLowerCase())) {
    return res.status(409).json({ message: "Username already taken" });
  }

  createUser(username.trim().toLowerCase(), password, !!isAdmin);
  res.json({ ok: true });
}
