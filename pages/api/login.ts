import type { NextApiRequest, NextApiResponse } from "next";
import db from "../../lib/db";
import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../lib/session";
import { verifyWerkzeugHash } from "../../lib/legacyPassword";
import { checkRateLimit } from "../../lib/rateLimit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }

  // 10 attempts per minute per IP
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0].trim()
    || req.socket.remoteAddress
    || "unknown";
  if (!checkRateLimit(`login:${ip}`, 10, 60_000)) {
    res.status(429).json({ message: "Too many login attempts. Try again in a minute." });
    return;
  }

  const { username, password } = req.body ?? {};
  if (!username || !password) {
    res.status(400).json({ message: "Missing field(s)" });
    return;
  }

  const row = db
    .prepare("SELECT id, username, password, legacy_password, is_admin FROM users WHERE LOWER(username) = ?")
    .get(String(username).toLowerCase()) as
    | { id: number; username: string; password: string; legacy_password: string; is_admin: number }
    | undefined;

  if (!row) {
    res.status(400).json({ message: "Invalid credentials" });
    return;
  }

  let authed = false;

  if (row.password && bcrypt.compareSync(password, row.password)) {
    authed = true;
  } else if (row.legacy_password && verifyWerkzeugHash(row.legacy_password, password)) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password = ?, legacy_password = '' WHERE id = ?").run(hash, row.id);
    authed = true;
  }

  if (!authed) {
    res.status(400).json({ message: "Invalid credentials" });
    return;
  }

  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  session.user = { id: row.id, username: row.username, isAdmin: row.is_admin === 1 };
  await session.save();

  res.json({ ok: true, user: session.user });
}
