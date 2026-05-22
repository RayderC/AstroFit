import type { NextApiRequest, NextApiResponse } from "next";
import { getIronSession } from "iron-session";
import { sessionOptions, User } from "@/lib/session";
import db, { awardXp, updateStreak, checkAndUpdatePr } from "@/lib/db";
import { calcWorkoutXp, XP } from "@/lib/xp";
import { checkCsrf } from "@/lib/csrf";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  if (!checkCsrf(req)) return res.status(403).json({ message: "Forbidden" });

  const session = await getIronSession<{ user?: User }>(req, res, sessionOptions);
  if (!session.user) return res.status(401).json({ message: "Unauthorized" });
  const uid = session.user.id;

  const workoutId = Number(req.query.id);
  const workout = db.prepare("SELECT * FROM workouts WHERE id = ? AND user_id = ? AND completed_at IS NULL")
    .get(workoutId, uid) as { id: number; started_at: string } | undefined;
  if (!workout) return res.status(404).json({ message: "Active workout not found" });

  const startedAt = new Date(workout.started_at);
  const now = new Date();
  const durationSeconds = Math.round((now.getTime() - startedAt.getTime()) / 1000);

  // Count completed sets
  const completedSets = (db.prepare(`
    SELECT COUNT(*) as c FROM workout_sets ws
    JOIN workout_exercises we ON we.id = ws.workout_exercise_id
    WHERE we.workout_id = ? AND ws.completed = 1
  `).get(workoutId) as { c: number }).c;

  // Check for PRs on all completed sets
  const completedSetRows = db.prepare(`
    SELECT ws.weight, ws.reps, we.exercise_id
    FROM workout_sets ws
    JOIN workout_exercises we ON we.id = ws.workout_exercise_id
    WHERE we.workout_id = ? AND ws.completed = 1
      AND ws.weight IS NOT NULL AND ws.reps IS NOT NULL AND ws.is_warmup = 0
  `).all(workoutId) as { weight: number; reps: number; exercise_id: number }[];

  let prCount = 0;
  let totalXp = calcWorkoutXp(completedSets);
  const prTx = db.transaction(() => {
    for (const s of completedSetRows) {
      const isPr = checkAndUpdatePr(uid, s.exercise_id, s.weight, s.reps, workoutId);
      if (isPr) {
        prCount++;
        db.prepare(
          "UPDATE workout_sets SET is_pr = 1 WHERE workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ? AND exercise_id = ?) AND completed = 1"
        ).run(workoutId, s.exercise_id);
      }
    }
  });
  prTx();

  if (prCount > 0) totalXp += prCount * XP.PR_BONUS;

  // Complete the workout
  db.prepare(
    "UPDATE workouts SET completed_at = datetime('now'), duration_seconds = ?, xp_earned = ? WHERE id = ?"
  ).run(durationSeconds, totalXp, workoutId);

  // Award XP
  awardXp(uid, totalXp, `Completed workout: ${workoutId}`, "workout", workoutId);
  if (prCount > 0) {
    // Already included in totalXp, just log
  }

  // Streak
  const { streak, bonusXp } = updateStreak(uid);
  if (bonusXp > 0) {
    awardXp(uid, bonusXp, `${streak}-day streak bonus`, "streak");
    totalXp += bonusXp;
  }

  // Update challenge progress for workout_count
  updateChallengeProgress(uid, "workout_count", 1);

  // Update challenge progress for volume
  const volumeRow = db.prepare(`
    SELECT COALESCE(SUM(ws.weight * ws.reps), 0) as v
    FROM workout_sets ws
    JOIN workout_exercises we ON we.id = ws.workout_exercise_id
    WHERE we.workout_id = ? AND ws.completed = 1
      AND ws.weight IS NOT NULL AND ws.reps IS NOT NULL
  `).get(workoutId) as { v: number };
  if (volumeRow.v > 0) updateChallengeProgress(uid, "volume_kg", volumeRow.v);

  // Update PR challenges
  if (prCount > 0) updateChallengeProgress(uid, "pr_count", prCount);

  res.json({ ok: true, xpEarned: totalXp, prCount, streak });
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

    // Check if now completed
    const uc = db.prepare(
      "SELECT progress, completed FROM user_challenges WHERE user_id = ? AND challenge_id = ?"
    ).get(userId, ch.id) as { progress: number; completed: number } | undefined;

    if (uc && uc.progress >= ch.target_value && !uc.completed) {
      db.prepare(
        "UPDATE user_challenges SET completed = 1, completed_at = datetime('now'), xp_earned = ? WHERE user_id = ? AND challenge_id = ?"
      ).run(ch.xp_reward, userId, ch.id);
      // Award challenge XP
      const { awardXp } = require("@/lib/db");
      awardXp(userId, ch.xp_reward, `Completed challenge #${ch.id}`, "challenge", ch.id);
    }
  }
}
