// XP required to reach level n (1-indexed, level 1 = 0 XP)
// Formula: cumulative sum of (100 + 75*(k-1)) for k=1..n-1
// Level 2: 100, Level 3: 275, Level 4: 525, Level 5: 850...
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  let total = 0;
  for (let k = 1; k < level; k++) {
    total += 100 + 75 * (k - 1);
  }
  return total;
}

// Returns the level a user is at given their total XP
export function levelFromXp(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

// XP needed to reach the next level from current
export function xpToNextLevel(xp: number): { current: number; needed: number; level: number } {
  const level = levelFromXp(xp);
  const currentFloor = xpForLevel(level);
  const nextFloor = xpForLevel(level + 1);
  return { current: xp - currentFloor, needed: nextFloor - currentFloor, level };
}

// XP awards
export const XP = {
  WORKOUT_BASE: 50,       // completing a workout
  PER_SET: 2,             // per completed set
  PR_BONUS: 25,           // hitting a new personal record
  CARDIO_BASE: 30,        // completing any cardio activity
  CARDIO_PER_KM: 5,       // per km of cardio
  STREAK_7: 50,           // maintaining a 7-day streak
  STREAK_30: 200,         // 30-day streak
  CHALLENGE_BASE: 75,     // default challenge reward (overridden per challenge)
} as const;

export function calcWorkoutXp(completedSets: number): number {
  return XP.WORKOUT_BASE + completedSets * XP.PER_SET;
}

export function calcCardioXp(distanceKm: number): number {
  return XP.CARDIO_BASE + Math.round(distanceKm * XP.CARDIO_PER_KM);
}
