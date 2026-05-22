import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });
  const uid = session.user.id;

  const id = Number(req.query.id);
  if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });

  const activity = db.prepare(
    "SELECT * FROM cardio_activities WHERE id = ? AND user_id = ?"
  ).get(id, uid) as { id: number } | undefined;
  if (!activity) return res.status(404).json({ message: "Not found" });

  if (req.method === "GET") {
    return res.json(activity);
  }

  if (req.method === "PUT") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    const { type, distanceKm, durationSeconds, notes } = req.body as {
      type?: string;
      distanceKm?: number;
      durationSeconds?: number;
      notes?: string;
    };

    const setClauses: string[] = [];
    const params: any[] = [];
    if (type !== undefined) { setClauses.push("type = ?"); params.push(type); }
    if (distanceKm !== undefined) { setClauses.push("distance_km = ?"); params.push(distanceKm || null); }
    if (durationSeconds !== undefined) { setClauses.push("duration_seconds = ?"); params.push(durationSeconds); }
    if (notes !== undefined) { setClauses.push("notes = ?"); params.push(notes || null); }

    if (distanceKm !== undefined && durationSeconds !== undefined) {
      const pace = distanceKm > 0 ? durationSeconds / 60 / distanceKm : null;
      setClauses.push("pace_per_km = ?");
      params.push(pace);
    }

    if (setClauses.length === 0) return res.status(400).json({ message: "Nothing to update" });
    params.push(id);
    db.prepare(`UPDATE cardio_activities SET ${setClauses.join(", ")} WHERE id = ?`).run(...params);
    return res.json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });
    db.prepare("DELETE FROM cardio_activities WHERE id = ?").run(id);
    return res.json({ ok: true });
  }

  res.status(405).end();
}
