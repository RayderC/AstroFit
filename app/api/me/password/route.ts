import bcrypt from "bcryptjs";
import { getSession, route, HttpError } from "@/lib/api";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { setPassword } from "@/lib/repo/users";

export const POST = route(async ({ user, body }) => {
  if (!checkRateLimit(`pwchange:${user.id}`, 10, 60_000)) throw new HttpError(429, "Too many attempts. Try again in a minute.");
  const { current, next } = body ?? {};
  const row = db.prepare("SELECT password FROM users WHERE id = ?").get(user.id) as { password: string };
  if (!(await bcrypt.compare(String(current ?? ""), row.password))) throw new HttpError(403, "Current password is wrong");
  setPassword(user.id, next);
  // Other devices get signed out. Keep this one signed in with the new version.
  const session = await getSession();
  session.user = { id: user.id, username: user.username, v: user.token_version + 1 };
  await session.save();
  return { ok: true };
});
