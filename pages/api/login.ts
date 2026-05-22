import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import bcrypt from "bcryptjs";
import { sessionOptions, User } from "@/lib/session";
import { getUserByUsername } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
  if (!checkRateLimit(`login:${ip}`, 10, 60_000)) {
    return res.status(429).json({ message: "Too many attempts. Try again in a minute." });
  }

  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) return res.status(400).json({ message: "Missing credentials" });

  const user = getUserByUsername(username.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: "Invalid username or password" });
  }

  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  session.user = { id: user.id, username: user.username, isAdmin: user.is_admin === 1 };
  await session.save();
  res.json({ ok: true });
}
