import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionUser } from "./session";
import { db } from "./db";
import { checkRateLimit } from "./rateLimit";

export type UserRow = {
  id: number;
  username: string;
  is_admin: number;
  disabled: number;
  token_version: number;
  weight_unit: "lb" | "kg";
  distance_unit: "mi" | "km";
  rest_default: number;
  created_at: string;
};

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const bad = (msg: string) => new HttpError(400, msg);
export const notFound = (msg = "Not found") => new HttpError(404, msg);

export async function getSession() {
  // Secure on HTTPS (including through a tunnel), but still able to sign in over plain HTTP on a LAN.
  const env = process.env.SESSION_COOKIE_SECURE;
  const secure = env != null ? env === "true" : (await headers()).get("x-forwarded-proto") === "https";
  return getIronSession<{ user?: SessionUser }>(await cookies(), {
    ...sessionOptions,
    cookieOptions: { ...sessionOptions.cookieOptions, secure },
  });
}

export function sameOrigin(req: NextRequest) {
  // Browsers set this themselves and pages can't fake it. It stays right when a proxy or tunnel rewrites Host.
  if (req.headers.get("sec-fetch-site") === "same-origin") return true;
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try { return new URL(origin).host === host; } catch { return false; }
}

/**
 * Behind a Cloudflare Tunnel every request arrives from the tunnel, so use the address Cloudflare reports.
 * X-Forwarded-For is deliberately not trusted first: a client can set its leftmost entry to dodge rate limits.
 */
export function clientIp(req: NextRequest) {
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  return req.headers.get("x-forwarded-for")?.split(",").pop()?.trim() || "local";
}

// Strong imports can be large. Nothing else comes close.
const MAX_BODY_BYTES = 60 * 1024 * 1024;

type Ctx<P> = { req: NextRequest; user: UserRow; params: P; body: any };
/** `raw`: leave the body unread, for uploads the handler streams itself (a backup can be large). */
type RouteOpts = { admin?: boolean; raw?: boolean };

/** Wraps a route handler with auth, CSRF, JSON parsing and error handling. */
export function route<P = Record<string, string>>(
  handler: (ctx: Ctx<P>) => unknown | Promise<unknown>,
  opts: RouteOpts = {},
) {
  return async (req: NextRequest, context: { params: Promise<P> }) => {
    try {
      if (req.method !== "GET" && !sameOrigin(req)) throw new HttpError(403, "Bad origin");
      const session = await getSession();
      if (!session.user) throw new HttpError(401, "Not signed in");
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(session.user.id) as UserRow | undefined;
      if (!user || user.disabled || user.token_version !== (session.user.v ?? 0)) {
        session.destroy();
        throw new HttpError(401, "Not signed in");
      }
      if (opts.admin && !user.is_admin) throw new HttpError(403, "Admins only");
      if (req.method !== "GET" && !checkRateLimit(`w:${user.id}`, 600, 60_000)) throw new HttpError(429, "Slow down");

      let body: any = undefined;
      if (req.method !== "GET" && req.method !== "DELETE" && !opts.raw) {
        if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) throw new HttpError(413, "That's too large");
        const ct = req.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) body = await req.json().catch(() => { throw bad("Invalid JSON"); });
        else body = await req.text();
      }
      const params = (await context.params) ?? ({} as P);
      const result = await handler({ req, user, params, body });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ message: e.message }, { status: e.status });
      console.error("[api]", req.method, req.nextUrl.pathname, e);
      return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
  };
}

export function int(v: unknown, name = "id"): number {
  const n = Number(v);
  if (!Number.isInteger(n)) throw bad(`Invalid ${name}`);
  return n;
}

export function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!isFinite(n)) throw bad("Invalid number");
  return n;
}

export function str(v: unknown, max = 200): string {
  if (typeof v !== "string") throw bad("Expected text");
  return v.slice(0, max);
}
