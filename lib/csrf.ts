import type { NextApiRequest } from "next";

/**
 * CSRF check: if the request includes an Origin header (always sent on cross-origin
 * fetch/XHR), it must match the server's Host. Same-origin browser requests and
 * direct API clients typically omit Origin, so they pass unconditionally.
 */
export function checkCsrf(req: NextApiRequest): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  if (!host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host === host;
  } catch {
    return false;
  }
}
