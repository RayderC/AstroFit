import bcrypt from "bcryptjs";
import { route, bad, HttpError } from "@/lib/api";
import { db } from "@/lib/db";

export const POST = route(({ user, body }) => {
  const { current, next } = body ?? {};
  const row = db.prepare("SELECT password FROM users WHERE id = ?").get(user.id) as { password: string };
  if (!bcrypt.compareSync(String(current ?? ""), row.password)) throw new HttpError(403, "Current password is wrong");
  if (String(next ?? "").length < 8) throw bad("New password must be at least 8 characters");
  db.prepare("UPDATE users SET password = ? WHERE id = ?").run(bcrypt.hashSync(next, 12), user.id);
  return { ok: true };
});
