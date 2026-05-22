import db from "./db";

// Level thresholds — 1000 XP per level, linear
export const XP_PER_LEVEL = 1000;
export const MAX_LEVEL = 100;

export function computeLevel(totalXp: number): number {
  return Math.min(MAX_LEVEL, Math.floor(totalXp / XP_PER_LEVEL) + 1);
}

export function xpForNextLevel(totalXp: number): { current: number; needed: number; level: number } {
  const level = computeLevel(totalXp);
  if (level >= MAX_LEVEL) return { current: XP_PER_LEVEL, needed: XP_PER_LEVEL, level };
  const baseXp = (level - 1) * XP_PER_LEVEL;
  return { current: totalXp - baseXp, needed: XP_PER_LEVEL, level };
}

export function calculateWorkoutXp(opts: {
  type: string;
  duration_seconds: number;
  distance_meters?: number | null;
  exercise_count?: number;
  streak: number;
}): number {
  const { type, duration_seconds, distance_meters, exercise_count = 0, streak } = opts;

  let xp = 100; // base

  // Duration bonus: 2 XP per minute, capped at 90 min
  const minutes = Math.min(90, Math.floor(duration_seconds / 60));
  xp += minutes * 2;

  // Distance bonus (runs & cycling): 8 XP per km
  if (distance_meters && (type === "run" || type === "cycling")) {
    xp += Math.floor((distance_meters / 1000) * 8);
  }

  // Strength: 10 XP per exercise
  if (type === "strength" && exercise_count > 0) {
    xp += exercise_count * 10;
  }

  // Streak multiplier
  if (streak >= 7) xp = Math.round(xp * 1.5);
  else if (streak >= 3) xp = Math.round(xp * 1.25);

  return xp;
}

export function awardXp(userId: number, opts: {
  type: string;
  duration_seconds: number;
  distance_meters?: number | null;
  exercise_count?: number;
}): { xpEarned: number; newLevel: number; leveledUp: boolean } {
  const today = new Date().toISOString().slice(0, 10);

  const row = db.prepare(
    "SELECT total_xp, level, streak, last_workout_date FROM user_xp WHERE user_id = ?"
  ).get(userId) as { total_xp: number; level: number; streak: number; last_workout_date: string | null } | undefined;

  const prevXp = row?.total_xp ?? 0;
  const prevLevel = row?.level ?? 1;
  const prevStreak = row?.streak ?? 0;
  const lastDate = row?.last_workout_date ?? null;

  // Calculate new streak
  let newStreak = 1;
  if (lastDate) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    if (lastDate === today) {
      newStreak = prevStreak; // already worked out today, no change
    } else if (lastDate === yesterdayStr) {
      newStreak = prevStreak + 1; // consecutive day
    }
    // else: gap > 1 day → reset to 1
  }

  const xpEarned = calculateWorkoutXp({ ...opts, streak: newStreak });
  const newTotalXp = prevXp + xpEarned;
  const newLevel = computeLevel(newTotalXp);

  db.prepare(`
    INSERT INTO user_xp (user_id, total_xp, level, streak, last_workout_date, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      total_xp = excluded.total_xp,
      level = excluded.level,
      streak = excluded.streak,
      last_workout_date = excluded.last_workout_date,
      updated_at = excluded.updated_at
  `).run(userId, newTotalXp, newLevel, newStreak, today);

  return { xpEarned, newLevel, leveledUp: newLevel > prevLevel };
}
