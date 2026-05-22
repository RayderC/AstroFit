import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db from "@/lib/db";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });

  const uid = session.user.id;
  const weekStart = getMondayIso();

  const workoutsThisWeek = (db.prepare(
    "SELECT COUNT(*) as c FROM workouts WHERE user_id = ? AND completed_at IS NOT NULL AND completed_at >= ?"
  ).get(uid, weekStart) as { c: number }).c;

  const volumeRow = db.prepare(`
    SELECT COALESCE(SUM(ws.weight * ws.reps), 0) as v
    FROM workout_sets ws
    JOIN workout_exercises we ON we.id = ws.workout_exercise_id
    JOIN workouts w ON w.id = we.workout_id
    WHERE w.user_id = ? AND w.completed_at IS NOT NULL AND w.completed_at >= ?
      AND ws.completed = 1 AND ws.weight IS NOT NULL AND ws.reps IS NOT NULL
  `).get(uid, weekStart) as { v: number };

  const cardioRow = db.prepare(
    "SELECT COALESCE(SUM(distance_km), 0) as km, COUNT(*) as cnt FROM cardio_activities WHERE user_id = ? AND started_at >= ?"
  ).get(uid, weekStart) as { km: number; cnt: number };

  const xpRow = db.prepare(
    "SELECT COALESCE(SUM(amount), 0) as x FROM xp_events WHERE user_id = ? AND created_at >= ?"
  ).get(uid, weekStart) as { x: number };

  const totalWorkouts = (db.prepare(
    "SELECT COUNT(*) as c FROM workouts WHERE user_id = ? AND completed_at IS NOT NULL"
  ).get(uid) as { c: number }).c;

  const totalCardio = (db.prepare(
    "SELECT COUNT(*) as c FROM cardio_activities WHERE user_id = ?"
  ).get(uid) as { c: number }).c;

  const totalVolumeRow = db.prepare(`
    SELECT COALESCE(SUM(ws.weight * ws.reps), 0) as v
    FROM workout_sets ws
    JOIN workout_exercises we ON we.id = ws.workout_exercise_id
    JOIN workouts w ON w.id = we.workout_id
    WHERE w.user_id = ? AND w.completed_at IS NOT NULL
      AND ws.completed = 1 AND ws.weight IS NOT NULL AND ws.reps IS NOT NULL
  `).get(uid) as { v: number };

  res.json({
    workoutsThisWeek,
    volumeThisWeek: Math.round(volumeRow.v),
    cardioKmThisWeek: Math.round(cardioRow.km * 10) / 10,
    cardioThisWeek: cardioRow.cnt,
    xpThisWeek: xpRow.x,
    totalWorkouts,
    totalCardio,
    totalVolumeKg: Math.round(totalVolumeRow.v),
  });
}

function getMondayIso() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
