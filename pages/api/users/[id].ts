import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";
import bcrypt from "bcryptjs";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user?.isAdmin) return res.status(403).json({ message: "Forbidden" });

  const id = Number(req.query.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  const user = db.prepare(
    "SELECT id, username, is_admin, xp, level, streak_days, created_at FROM users WHERE id = ?"
  ).get(id) as { id: number; username: string; is_admin: number } | undefined;
  if (!user) return res.status(404).json({ message: "User not found" });

  if (req.method === "GET") {
    return res.json(user);
  }

  if (req.method === "PATCH") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { isAdmin, newPassword } = req.body as { isAdmin?: boolean; newPassword?: string };

    if (id === session.user.id && isAdmin === false) {
      return res.status(400).json({ message: "Cannot remove your own admin status" });
    }

    const setClauses: string[] = [];
    const params: any[] = [];

    if (isAdmin !== undefined) { setClauses.push("is_admin = ?"); params.push(isAdmin ? 1 : 0); }
    if (newPassword) {
      if (newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
      const hash = bcrypt.hashSync(newPassword, 12);
      setClauses.push("password = ?");
      params.push(hash);
    }

    if (setClauses.length === 0) return res.status(400).json({ message: "Nothing to update" });
    params.push(id);
    db.prepare(`UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`).run(...params);
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    if (id === session.user.id) return res.status(400).json({ message: "Cannot delete your own account" });
    db.prepare("DELETE FROM users WHERE id = ?").run(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
