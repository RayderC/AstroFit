import db from "./db";

export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  category: string;
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // Running milestones
  { code: "first_run", name: "First Step", description: "Log your first run", icon: "👟", xp_reward: 100, category: "running" },
  { code: "run_5k", name: "5K Club", description: "Run 5 km in a single session", icon: "🏃", xp_reward: 150, category: "running" },
  { code: "run_10k", name: "10K Warrior", description: "Run 10 km in a single session", icon: "⚡", xp_reward: 250, category: "running" },
  { code: "run_half", name: "Half Marathon Hero", description: "Run 21.1 km in a single session", icon: "🌟", xp_reward: 500, category: "running" },
  { code: "run_marathon", name: "Marathon Legend", description: "Run 42.2 km in a single session", icon: "🏆", xp_reward: 1000, category: "running" },
  { code: "total_50k", name: "50K Total", description: "Log 50 km of total running distance", icon: "🛣️", xp_reward: 200, category: "running" },
  { code: "total_100k", name: "Century Runner", description: "Log 100 km of total running distance", icon: "💯", xp_reward: 400, category: "running" },
  { code: "total_500k", name: "Road Warrior", description: "Log 500 km of total running distance", icon: "🌍", xp_reward: 1000, category: "running" },
  // Strength milestones
  { code: "first_lift", name: "Iron Beginner", description: "Log your first strength workout", icon: "💪", xp_reward: 100, category: "strength" },
  { code: "strength_10", name: "10 Workouts", description: "Complete 10 strength sessions", icon: "🏋️", xp_reward: 200, category: "strength" },
  { code: "strength_50", name: "50 Workouts", description: "Complete 50 strength sessions", icon: "⚔️", xp_reward: 500, category: "strength" },
  // Consistency
  { code: "streak_3", name: "3-Day Streak", description: "Work out 3 days in a row", icon: "🔥", xp_reward: 75, category: "consistency" },
  { code: "streak_7", name: "Week Warrior", description: "Work out 7 days in a row", icon: "🔥🔥", xp_reward: 200, category: "consistency" },
  { code: "streak_30", name: "Monthly Grind", description: "Work out 30 days in a row", icon: "🌠", xp_reward: 750, category: "consistency" },
  { code: "workouts_25", name: "25 Workouts", description: "Log 25 total workouts", icon: "📊", xp_reward: 150, category: "consistency" },
  { code: "workouts_100", name: "Century Club", description: "Log 100 total workouts", icon: "💎", xp_reward: 500, category: "consistency" },
  // PRs
  { code: "first_pr", name: "Personal Best", description: "Set your first personal record", icon: "🥇", xp_reward: 100, category: "pr" },
];

export function seedAchievements(): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO achievements (code, name, description, icon, xp_reward, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertAll = db.transaction(() => {
    for (const a of ACHIEVEMENT_DEFS) {
      insert.run(a.code, a.name, a.description, a.icon, a.xp_reward, a.category);
    }
  });
  insertAll();
}

/** Award an achievement to a user if they don't have it yet. Returns XP awarded. */
export function awardAchievement(userId: number, code: string): number {
  const achievement = db.prepare("SELECT id, xp_reward FROM achievements WHERE code = ?").get(code) as
    | { id: number; xp_reward: number } | undefined;
  if (!achievement) return 0;

  const existing = db.prepare("SELECT id FROM user_achievements WHERE user_id = ? AND achievement_id = ?")
    .get(userId, achievement.id);
  if (existing) return 0;

  db.prepare("INSERT INTO user_achievements (user_id, achievement_id) VALUES (?, ?)").run(userId, achievement.id);
  addXp(userId, achievement.xp_reward);
  return achievement.xp_reward;
}

export function addXp(userId: number, xp: number): void {
  db.prepare(`
    INSERT INTO user_xp (user_id, total_xp, level, updated_at) VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET total_xp = total_xp + ?, updated_at = datetime('now')
  `).run(userId, xp, xp);
}

/** Check and award achievements after any workout is logged */
export function checkWorkoutAchievements(userId: number, workoutId: number): string[] {
  const awarded: string[] = [];

  const workout = db.prepare("SELECT type, distance_meters, started_at FROM workouts WHERE id = ?").get(workoutId) as
    | { type: string; distance_meters: number | null; started_at: string } | undefined;
  if (!workout) return awarded;

  const totalWorkouts = (db.prepare("SELECT COUNT(*) as c FROM workouts WHERE user_id = ?").get(userId) as { c: number }).c;

  if (workout.type === "run") {
    if (totalWorkouts === 1) awarded.push("first_run");
    const dist = workout.distance_meters ?? 0;
    if (dist >= 5000) awarded.push("run_5k");
    if (dist >= 10000) awarded.push("run_10k");
    if (dist >= 21100) awarded.push("run_half");
    if (dist >= 42200) awarded.push("run_marathon");

    const totalKm = (db.prepare("SELECT COALESCE(SUM(distance_meters),0) as t FROM workouts WHERE user_id = ? AND type = 'run'").get(userId) as { t: number }).t;
    if (totalKm >= 50000) awarded.push("total_50k");
    if (totalKm >= 100000) awarded.push("total_100k");
    if (totalKm >= 500000) awarded.push("total_500k");
  }

  if (workout.type === "strength") {
    const strengthCount = (db.prepare("SELECT COUNT(*) as c FROM workouts WHERE user_id = ? AND type = 'strength'").get(userId) as { c: number }).c;
    if (strengthCount === 1) awarded.push("first_lift");
    if (strengthCount === 10) awarded.push("strength_10");
    if (strengthCount === 50) awarded.push("strength_50");
  }

  if (totalWorkouts === 25) awarded.push("workouts_25");
  if (totalWorkouts === 100) awarded.push("workouts_100");

  for (const code of awarded) {
    awardAchievement(userId, code);
  }

  return awarded;
}

/** Check personal records after a run and update if broken */
export function checkPersonalRecords(userId: number, workoutId: number): string[] {
  const workout = db.prepare(`
    SELECT distance_meters, duration_seconds, avg_pace_seconds_per_km, started_at
    FROM workouts WHERE id = ? AND type = 'run'
  `).get(workoutId) as {
    distance_meters: number | null;
    duration_seconds: number;
    avg_pace_seconds_per_km: number | null;
    started_at: string;
  } | undefined;

  if (!workout || !workout.distance_meters) return [];

  const newPrs: string[] = [];
  const dist = workout.distance_meters;
  const dur = workout.duration_seconds;

  const races: Array<[string, number]> = [
    ["1km", 1000], ["5km", 5000], ["10km", 10000],
    ["half_marathon", 21097], ["marathon", 42195],
  ];

  for (const [code, threshold] of races) {
    if (dist < threshold) continue;
    const timeAtDist = (dur / dist) * threshold;
    const existing = db.prepare("SELECT value FROM personal_records WHERE user_id = ? AND record_type = ?")
      .get(userId, code) as { value: number } | undefined;
    if (!existing || timeAtDist < existing.value) {
      db.prepare(`
        INSERT INTO personal_records (user_id, record_type, value, workout_id, achieved_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, record_type) DO UPDATE SET value = ?, workout_id = ?, achieved_at = ?
      `).run(userId, code, timeAtDist, workoutId, workout.started_at, timeAtDist, workoutId, workout.started_at);
      newPrs.push(code);
      if (existing === undefined) awardAchievement(userId, "first_pr");
    }
  }

  return newPrs;
}
