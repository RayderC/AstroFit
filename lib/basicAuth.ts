import bcrypt from "bcryptjs";
import db from "./db";
import { verifyWerkzeugHash } from "./legacyPassword";

export interface BasicAuthUser {
  id: number;
  username: string;
  isAdmin: boolean;
}

// OPDS clients send credentials as HTTP Basic. We don't issue tokens — they
// auth on every request with their own username + password, validated against
// the same users table as the web UI.
export function parseBasic(header: string | null): { username: string; password: string } | null {
  if (!header) return null;
  if (!header.toLowerCase().startsWith("basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

export function authenticateBasic(header: string | null): BasicAuthUser | null {
  const creds = parseBasic(header);
  if (!creds) return null;

  const row = db
    .prepare("SELECT id, username, password, legacy_password, is_admin FROM users WHERE LOWER(username) = ?")
    .get(String(creds.username).toLowerCase()) as
    | { id: number; username: string; password: string; legacy_password: string; is_admin: number }
    | undefined;
  if (!row) return null;

  if (row.password && bcrypt.compareSync(creds.password, row.password)) {
    return { id: row.id, username: row.username, isAdmin: row.is_admin === 1 };
  }
  if (row.legacy_password && verifyWerkzeugHash(row.legacy_password, creds.password)) {
    // Don't upgrade hashes here — that's the login flow's job.
    return { id: row.id, username: row.username, isAdmin: row.is_admin === 1 };
  }
  return null;
}

export const BASIC_CHALLENGE = 'Basic realm="ComicOrbit OPDS", charset="UTF-8"';
