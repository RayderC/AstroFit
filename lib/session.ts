import { SessionOptions } from "iron-session";

export type User = { id: number; username: string; isAdmin?: boolean };

declare module "iron-session" {
  interface IronSessionData {
    user?: User;
  }
}

const isBuild = process.env.NEXT_PHASE === "phase-production-build";
const isDev = process.env.NODE_ENV !== "production";

// In production: SESSION_SECRET is mandatory. In dev/build: fall back to a
// known placeholder so the build pipeline doesn't need the variable set.
const sessionPassword = process.env.SESSION_SECRET ||
  (isBuild || isDev ? "build_time_placeholder_secret_at_least_32_chars" : "");

if (!isBuild && !isDev && (!sessionPassword || sessionPassword === "build_time_placeholder_secret_at_least_32_chars")) {
  throw new Error(
    "SESSION_SECRET environment variable must be set to a random string of at least 32 characters in production"
  );
}

if (!sessionPassword || sessionPassword.length < 32) {
  throw new Error(
    "SESSION_SECRET must be at least 32 characters"
  );
}

// Default false so plain-HTTP local-network access works out of the box.
// Set SESSION_COOKIE_SECURE=true if you terminate TLS in front of this app.
// Set SESSION_COOKIE_SECURE=false explicitly to suppress the startup warning.
const secureCookieEnv = process.env.SESSION_COOKIE_SECURE;
const secureCookie = secureCookieEnv === "true";

if (!isBuild && !isDev && !secureCookie && secureCookieEnv == null) {
  console.warn(
    "[session] WARNING: SESSION_COOKIE_SECURE is not set. " +
    "Session cookies will be sent over HTTP. " +
    "Set SESSION_COOKIE_SECURE=true if serving over HTTPS, or SESSION_COOKIE_SECURE=false to silence this warning."
  );
}

export const sessionOptions: SessionOptions = {
  password: sessionPassword,
  cookieName: "comicorbit_session",
  cookieOptions: {
    secure: secureCookie,
    httpOnly: true,
    sameSite: "lax",
  },
};
