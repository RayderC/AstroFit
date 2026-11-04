import { SessionOptions } from "iron-session";

export type SessionUser = { id: number; username: string };

const PLACEHOLDER = "build_time_placeholder_secret_at_least_32_chars";
const isBuild = process.env.NEXT_PHASE === "phase-production-build";
const isDev = process.env.NODE_ENV !== "production";

const sessionPassword = process.env.SESSION_SECRET || (isBuild || isDev ? PLACEHOLDER : "");

if (!isBuild && !isDev && (!sessionPassword || sessionPassword === PLACEHOLDER)) {
  throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters in production");
}
if (sessionPassword.length < 32) {
  throw new Error("SESSION_SECRET must be at least 32 characters");
}

const secureEnv = process.env.SESSION_COOKIE_SECURE;

export const sessionOptions: SessionOptions = {
  password: sessionPassword,
  cookieName: "astrofit_session",
  ttl: 60 * 60 * 24 * 30,
  cookieOptions: {
    secure: secureEnv == null ? false : secureEnv === "true",
    httpOnly: true,
    sameSite: "lax",
  },
};
