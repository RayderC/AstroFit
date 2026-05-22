import type { NextApiRequest, NextApiResponse } from "next";
import db from "../../../lib/db";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "../../../lib/session";
import { checkCsrf } from "../../../lib/csrf";
import { checkWorkoutAchievements, checkPersonalRecords } from "../../../lib/achievements";
import { awardXp } from "../../../lib/xp";

export const config = { api: { bodyParser: { sizeLimit: "8mb" } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Login required" });
  const userId = session.user.id;

  if (req.method === "GET") {
    const { limit = "50", offset = "0", type } = req.query;
    const lim = Math.min(parseInt(String(limit), 10) || 50, 200);
    const off = parseInt(String(offset), 10) || 0;

    const rows = db.prepare(`
      SELECT id, type, title, notes, started_at, duration_seconds,
             distance_meters, avg_pace_seconds_per_km, avg_heart_rate,
             elevation_gain_meters, calories, source, created_at
      FROM workouts
      WHERE user_id = ?${type ? " AND type = ?" : ""}
      ORDER BY started_at DESC
      LIMIT ? OFFSET ?
    `).all(...(type ? [userId, type, lim, off] : [userId, lim, off]));

    return res.json(rows);
  }

  if (req.method === "POST") {
    if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });

    const {
      type, title, started_at, duration_seconds,
      distance_meters, avg_pace_seconds_per_km,
      avg_heart_rate, max_heart_rate,
      elevation_gain_meters, calories, cadence,
      notes, source, gpx_data, exercises,
    } = req.body ?? {};

    if (!type || !["run", "strength", "cycling", "other"].includes(type)) {
      return res.status(400).json({ message: "Invalid workout type" });
    }
    if (!started_at || !duration_seconds) {
      return res.status(400).json({ message: "started_at and duration_seconds are required" });
    }
    if (typeof duration_seconds !== "number" || duration_seconds < 0 || duration_seconds > 86400 * 2) {
      return res.status(400).json({ message: "Invalid duration" });
    }

    const insert = db.prepare(`
      INSERT INTO workouts (
        user_id, type, title, notes, started_at, duration_seconds,
        distance_meters, avg_pace_seconds_per_km, avg_heart_rate, max_heart_rate,
        elevation_gain_meters, calories, cadence, gpx_data, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertExercise = db.prepare(`
      INSERT INTO workout_exercises (workout_id, exercise_name, muscle_group, order_index, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertSet = db.prepare(`
      INSERT INTO exercise_sets (workout_exercise_id, set_number, reps, weight_kg, duration_seconds)
      VALUES (?, ?, ?, ?, ?)
    `);

    const run = db.transaction(() => {
      const result = insert.run(
        userId,
        type,
        (title || "").slice(0, 200),
        (notes || "").slice(0, 2000),
        new Date(started_at).toISOString(),
        Math.round(duration_seconds),
        distance_meters ?? null,
        avg_pace_seconds_per_km ?? null,
        avg_heart_rate ?? null,
        max_heart_rate ?? null,
        elevation_gain_meters ?? null,
        calories ?? null,
        cadence ?? null,
        gpx_data ?? null,
        source || "manual",
      );
      const workoutId = result.lastInsertRowid as number;

      if (Array.isArray(exercises)) {
        for (const ex of exercises) {
          if (!ex.exercise_name?.trim()) continue;
          const exResult = insertExercise.run(
            workoutId,
            String(ex.exercise_name).slice(0, 100).trim(),
            ex.muscle_group ? String(ex.muscle_group).slice(0, 50) : null,
            ex.order_index ?? 0,
            ex.notes ? String(ex.notes).slice(0, 500) : null,
          );
          const exerciseId = exResult.lastInsertRowid as number;

          if (Array.isArray(ex.sets)) {
            for (const s of ex.sets) {
              insertSet.run(
                exerciseId,
                s.set_number ?? 1,
                s.reps ?? null,
                s.weight_kg ?? null,
                s.duration_seconds ?? null,
              );
            }
          }
        }
      }

      return workoutId;
    });

    const workoutId = run();

    checkWorkoutAchievements(userId, workoutId);
    if (type === "run") checkPersonalRecords(userId, workoutId);

    const { xpEarned, newLevel, leveledUp } = awardXp(userId, {
      type,
      duration_seconds: Math.round(duration_seconds),
      distance_meters: distance_meters ?? null,
      exercise_count: Array.isArray(exercises) ? exercises.length : 0,
    });

    return res.status(201).json({ id: workoutId, xpEarned, newLevel, leveledUp });
  }

  res.status(405).end();
}
