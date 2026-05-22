import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import { countUsers, createUser, getUserByUsername } from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    return res.json({ needsSetup: countUsers() === 0 });
  }

  if (req.method === "POST") {
    if (countUsers() > 0) {
      return res.status(403).json({ message: "Setup already complete" });
    }
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) return res.status(400).json({ message: "Missing fields" });
    if (username.length < 2) return res.status(400).json({ message: "Username too short" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const id = createUser(username.trim().toLowerCase(), password, true);
    const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
    session.user = { id, username: username.trim().toLowerCase(), isAdmin: true };
    await session.save();
    return res.json({ ok: true });
  }

  res.status(405).end();
}
