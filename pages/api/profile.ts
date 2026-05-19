import type { NextApiRequest, NextApiResponse } from "next";
import db from "../../lib/db";
import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../lib/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_PROFILE_FIELDS = new Set(["email", "password"]);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) {
    res.status(401).json({ message: "Login required" });
    return;
  }
  const userId = session.user.id;

  if (req.method === "GET") {
    const row = db.prepare("SELECT username, email FROM users WHERE id = ?").get(userId) as
      | { username: string; email: string }
      | undefined;
    if (!row) { res.status(404).json({ message: "User not found" }); return; }
    res.json(row);
    return;
  }

  if (req.method === "PATCH") {
    const { password, email } = req.body ?? {};
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (email !== undefined) {
      if (typeof email !== "string") {
        res.status(400).json({ message: "Invalid email" });
        return;
      }
      const trimmed = email.trim();
      if (trimmed !== "" && !EMAIL_RE.test(trimmed)) {
        res.status(400).json({ message: "Invalid email format" });
        return;
      }
      if (trimmed.length > 254) {
        res.status(400).json({ message: "Email must be under 254 characters" });
        return;
      }
      sets.push("email = ?");
      vals.push(trimmed);
    }

    if (password !== undefined) {
      if (typeof password !== "string" || password.length < 8) {
        res.status(400).json({ message: "Password must be at least 8 characters" });
        return;
      }
      if (password.length > 200) {
        res.status(400).json({ message: "Password must be under 200 characters" });
        return;
      }
      sets.push("password = ?");
      vals.push(bcrypt.hashSync(password, 10));
    }

    if (sets.length === 0) { res.status(400).json({ message: "Nothing to update" }); return; }

    // Verify only whitelisted columns are being set (defense-in-depth)
    const colNames = sets.map((s) => s.split(" ")[0]);
    if (colNames.some((c) => !ALLOWED_PROFILE_FIELDS.has(c))) {
      res.status(400).json({ message: "Invalid field" });
      return;
    }

    db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals, userId);
    res.json({ ok: true });
    return;
  }

  res.status(405).end();
}
