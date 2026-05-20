import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../../lib/session";
import db from "../../../lib/db";
import { sendPushToUser } from "../../../lib/webpush";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.status(405).end(); return; }
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) { res.status(401).json({ message: "Login required" }); return; }

  const subCount = (db.prepare(
    "SELECT COUNT(*) as c FROM push_subscriptions WHERE user_id = ?"
  ).get(session.user.id) as { c: number }).c;

  if (subCount === 0) {
    res.status(400).json({ message: "No push subscription found for your account. Enable notifications first." });
    return;
  }

  try {
    await sendPushToUser(session.user.id, {
      title: "ComicOrbit",
      body: "Test notification — it's working!",
      url: "/profile",
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ message: (e as Error).message || "Send failed" });
  }
}
