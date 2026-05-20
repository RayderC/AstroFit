import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../lib/session";
import { checkCsrf } from "../../lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  if (!checkCsrf(req)) { res.status(403).json({ message: "Forbidden" }); return; }
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  session.destroy();
  res.json({ ok: true });
}
