import type { NextApiRequest, NextApiResponse } from "next";
import db, { adminCount } from "../../../lib/db";
import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../../lib/session";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user?.isAdmin) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const id = Number(req.query.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ message: "Invalid id" });
    return;
  }

  if (req.method === "DELETE") {
    // Atomic check-then-delete so two parallel requests can't both remove the last admin.
    const result = db.transaction(() => {
      const target = db.prepare("SELECT is_admin FROM users WHERE id = ?").get(id) as { is_admin: number } | undefined;
      if (!target) return "not_found";
      if (target.is_admin === 1 && adminCount() <= 1) return "last_admin";
      db.prepare("DELETE FROM users WHERE id = ?").run(id);
      return "ok";
    })();

    if (result === "not_found") { res.status(404).json({ message: "User not found" }); return; }
    if (result === "last_admin") { res.status(400).json({ message: "Cannot delete the last remaining admin" }); return; }
    res.json({ ok: true });
    return;
  }

  if (req.method === "PATCH") {
    const { username, password, isAdmin } = req.body ?? {};

    // Validate and prepare values before entering the transaction (bcrypt is slow).
    let cleanUsername: string | undefined;
    let hashedPassword: string | undefined;

    if (username && typeof username === "string") {
      cleanUsername = username.trim().toLowerCase();
      if (cleanUsername.length < 2 || cleanUsername.length > 50) {
        res.status(400).json({ message: "Username must be 2–50 characters" });
        return;
      }
    }

    if (password && typeof password === "string") {
      if (password.length < 5 || password.length > 200) {
        res.status(400).json({ message: "Password must be 5–200 characters" });
        return;
      }
      hashedPassword = bcrypt.hashSync(password, 10);
    }

    if (cleanUsername === undefined && hashedPassword === undefined && typeof isAdmin !== "boolean") {
      res.status(400).json({ message: "Nothing to update" });
      return;
    }

    // Atomic check-then-update so two parallel requests can't both demote the last admin.
    const result = db.transaction(() => {
      const target = db.prepare("SELECT id, is_admin FROM users WHERE id = ?").get(id) as
        | { id: number; is_admin: number }
        | undefined;
      if (!target) return "not_found";

      if (typeof isAdmin === "boolean" && !isAdmin && target.is_admin === 1 && adminCount() <= 1) {
        return "last_admin";
      }

      // Column names are hardcoded literals, not user input — safe to interpolate.
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (cleanUsername !== undefined) { sets.push("username = ?"); vals.push(cleanUsername); }
      if (hashedPassword !== undefined) { sets.push("password = ?"); vals.push(hashedPassword); }
      if (typeof isAdmin === "boolean") { sets.push("is_admin = ?"); vals.push(isAdmin ? 1 : 0); }

      db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).run(...vals, id);
      return "ok";
    })();

    if (result === "not_found") { res.status(404).json({ message: "User not found" }); return; }
    if (result === "last_admin") { res.status(400).json({ message: "Cannot remove admin from the last remaining admin" }); return; }

    try {
      res.json({ ok: true });
    } catch {
      res.status(400).json({ message: "Username already taken" });
    }
    return;
  }

  res.status(405).end();
}
