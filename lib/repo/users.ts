import bcrypt from "bcryptjs";
import { db } from "../db";
import { bad, HttpError, notFound } from "../api";

export type AdminUser = {
  id: number; username: string; isAdmin: boolean; disabled: boolean; createdAt: string; sessions: number; lastWorkout: string | null;
};

export function listUsers(): AdminUser[] {
  const rows = db.prepare(`SELECT u.id, u.username, u.is_admin, u.disabled, u.created_at,
      (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.ended_at IS NOT NULL) n,
      (SELECT MAX(started_at) FROM sessions s WHERE s.user_id = u.id AND s.ended_at IS NOT NULL) last
    FROM users u ORDER BY u.id`).all() as { id: number; username: string; is_admin: number; disabled: number; created_at: string; n: number; last: string | null }[];
  return rows.map(r => ({ id: r.id, username: r.username, isAdmin: !!r.is_admin, disabled: !!r.disabled, createdAt: r.created_at, sessions: r.n, lastWorkout: r.last }));
}

function checkPassword(p: unknown): string {
  if (typeof p !== "string" || p.length < 8) throw bad("Password must be at least 8 characters");
  if (p.length > 72) throw bad("Password must be 72 characters or fewer"); // bcrypt ignores anything past 72 bytes
  return p;
}

export function setPassword(id: number, password: unknown) {
  // Bumping the version signs out every existing session for this user.
  db.prepare("UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?").run(bcrypt.hashSync(checkPassword(password), 12), id);
}

function checkUsername(username: unknown, exceptId?: number): string {
  const name = String(username ?? "").trim().toLowerCase();
  if (name.length < 2 || name.length > 40 || !/^[a-z0-9_.-]+$/.test(name)) throw bad("Username must be 2-40 letters, numbers, dots, dashes or underscores");
  const taken = db.prepare("SELECT id FROM users WHERE username = ?").get(name) as { id: number } | undefined;
  if (taken && taken.id !== exceptId) throw bad("That username is taken");
  return name;
}

export function createUser(username: unknown, password: unknown, isAdmin: unknown) {
  const name = checkUsername(username);
  const pw = checkPassword(password);
  const info = db.prepare("INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)").run(name, bcrypt.hashSync(pw, 12), isAdmin ? 1 : 0);
  return Number(info.lastInsertRowid);
}

function target(id: number) {
  const u = db.prepare("SELECT id, is_admin, disabled FROM users WHERE id = ?").get(id) as { id: number; is_admin: number; disabled: number } | undefined;
  if (!u) throw notFound("User not found");
  return u;
}

/** Stop an action that would leave nobody able to administer the server. */
function assertOtherAdmin(id: number) {
  const others = (db.prepare("SELECT COUNT(*) c FROM users WHERE is_admin = 1 AND disabled = 0 AND id != ?").get(id) as { c: number }).c;
  if (!others) throw bad("There must always be at least one active admin");
}

export function updateUser(actorId: number, id: number, p: { username?: unknown; password?: unknown; disabled?: unknown; isAdmin?: unknown }) {
  const u = target(id);
  db.transaction(() => {
    // Sessions are tied to the account, not the name, so renaming signs nobody out.
    if (p.username !== undefined) db.prepare("UPDATE users SET username = ? WHERE id = ?").run(checkUsername(p.username, id), id);
    if (p.password !== undefined) setPassword(id, p.password);
    if (p.disabled !== undefined) {
      if (p.disabled) {
        if (id === actorId) throw new HttpError(400, "You can't disable your own account");
        if (u.is_admin) assertOtherAdmin(id);
      }
      db.prepare("UPDATE users SET disabled = ? WHERE id = ?").run(p.disabled ? 1 : 0, id);
    }
    if (p.isAdmin !== undefined) {
      if (!p.isAdmin) {
        if (id === actorId) throw new HttpError(400, "You can't remove your own admin access");
        assertOtherAdmin(id);
      }
      db.prepare("UPDATE users SET is_admin = ? WHERE id = ?").run(p.isAdmin ? 1 : 0, id);
    }
  })();
}

/** Removes the account and everything it owns (workouts, routines, programs, custom exercises, body entries). */
export function deleteUser(actorId: number, id: number) {
  const u = target(id);
  if (id === actorId) throw new HttpError(400, "You can't delete your own account");
  if (u.is_admin) assertOtherAdmin(id);
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
}
