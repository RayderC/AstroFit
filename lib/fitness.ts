/** Format seconds as "H:MM:SS" or "M:SS" */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format pace as "M:SS /km" or "M:SS /mi" */
export function formatPace(secondsPerKm: number, unit: "km" | "mi" = "km"): string {
  const paceSeconds = unit === "mi" ? secondsPerKm * 1.60934 : secondsPerKm;
  const m = Math.floor(paceSeconds / 60);
  const s = Math.floor(paceSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")} /${unit}`;
}

/** Convert meters to km or miles */
export function formatDistance(meters: number, unit: "km" | "mi" = "km"): string {
  if (unit === "mi") return (meters / 1609.344).toFixed(2) + " mi";
  return (meters / 1000).toFixed(2) + " km";
}

/** Format weight: if unit is 'mi', show lbs; if 'km', show kg */
export function formatWeight(kg: number, unit: "km" | "mi" = "km"): string {
  if (unit === "mi") return (kg * 2.20462).toFixed(1) + " lbs";
  return kg.toFixed(1) + " kg";
}

/** XP required to reach a given level (simple quadratic curve) */
export function xpForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.8));
}

/** Compute level from total XP */
export function levelFromXp(totalXp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) level++;
  return level;
}

/** Progress within the current level (0-1) */
export function levelProgress(totalXp: number): number {
  const level = levelFromXp(totalXp);
  const currentThreshold = xpForLevel(level);
  const nextThreshold = xpForLevel(level + 1);
  return (totalXp - currentThreshold) / (nextThreshold - currentThreshold);
}

/** Round pace in s/km to nearest 5s for display */
export function normalizePace(secondsPerKm: number): number {
  return Math.round(secondsPerKm / 5) * 5;
}

/** Estimate calories burned: MET × weight_kg × hours */
export function estimateCalories(durationSeconds: number, weightKg: number, type: string): number {
  const metValues: Record<string, number> = {
    run: 9.8,
    cycling: 7.5,
    swimming: 8.0,
    strength: 5.0,
    yoga: 3.0,
    other: 5.0,
  };
  const met = metValues[type] ?? 5.0;
  const hours = durationSeconds / 3600;
  return Math.round(met * weightKg * hours);
}

/** Parse "M:SS" pace string to seconds */
export function parsePaceString(pace: string): number | null {
  const parts = pace.replace(/\s*\/.*$/, "").split(":");
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const s = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(s)) return null;
  return m * 60 + s;
}
