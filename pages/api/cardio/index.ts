import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db, { awardXp } from "@/lib/db";
import { calcCardioXp } from "@/lib/xp";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });
  const uid = session.user.id;

  if (req.method === "GET") {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const offset = Number(req.query.offset) || 0;
    const activities = db.prepare(`
      SELECT id, type, distance_km, duration_seconds, pace_per_km, notes, xp_earned, started_at
      FROM cardio_activities
      WHERE user_id = ?
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `).all(uid, limit, offset);
    return res.json(activities);
  }

  if (req.method === "POST") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });

    const { type, distanceKm, durationSeconds, notes, gpsData } = req.body as {
      type: string;
      distanceKm?: number;
      durationSeconds: number;
      notes?: string;
      gpsData?: unknown;
    };

    if (!type) return res.status(400).json({ message: "type required" });
    if (!durationSeconds || durationSeconds <= 0) return res.status(400).json({ message: "durationSeconds required" });

    const distance = distanceKm ?? 0;
    const pacePerKm = distance > 0 ? durationSeconds / 60 / distance : null;
    const xpEarned = calcCardioXp(distance);

    const result = db.prepare(`
      INSERT INTO cardio_activities (user_id, type, distance_km, duration_seconds, pace_per_km, notes, gps_data, xp_earned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uid, type, distance || null, durationSeconds,
      pacePerKm, notes ?? null,
      gpsData ? JSON.stringify(gpsData) : null,
      xpEarned
    );

    awardXp(uid, xpEarned, `Cardio: ${type}${distance > 0 ? ` ${distance.toFixed(1)}km` : ""}`, "cardio", result.lastInsertRowid as number);

    // Update challenge progress
    if (distance > 0) {
      updateChallengeProgress(uid, "cardio_km", distance);
    }
    updateChallengeProgress(uid, "cardio_count", 1);

    return res.status(201).json({ id: result.lastInsertRowid, xpEarned });
  }

  res.status(405).end();
}

function updateChallengeProgress(userId: number, targetType: string, increment: number) {
  const now = new Date().toISOString();
  const activeChallenges = db.prepare(`
    SELECT id, target_value, xp_reward FROM challenges
    WHERE target_type = ? AND starts_at <= ? AND ends_at >= ?
  `).all(targetType, now, now) as { id: number; target_value: number; xp_reward: number }[];

  for (const ch of activeChallenges) {
    db.prepare(`
      INSERT INTO user_challenges (user_id, challenge_id, progress)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, challenge_id) DO UPDATE SET
        progress = MIN(target_value, progress + excluded.progress)
    `).run(userId, ch.id, increment);

    const uc = db.prepare(
      "SELECT progress, completed FROM user_challenges WHERE user_id = ? AND challenge_id = ?"
    ).get(userId, ch.id) as { progress: number; completed: number } | undefined;

    if (uc && uc.progress >= ch.target_value && !uc.completed) {
      db.prepare(
        "UPDATE user_challenges SET completed = 1, completed_at = datetime('now'), xp_earned = ? WHERE user_id = ? AND challenge_id = ?"
      ).run(ch.xp_reward, userId, ch.id);
      awardXp(userId, ch.xp_reward, `Completed challenge #${ch.id}`, "challenge", ch.id);
    }
  }
}
