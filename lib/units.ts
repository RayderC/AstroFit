// Everything is stored in kg / meters / seconds. These helpers convert for display and input.

export type WeightUnit = "lb" | "kg";
export type DistanceUnit = "mi" | "km";

export const LB_PER_KG = 2.2046226218;
export const M_PER_MI = 1609.344;

export function kgTo(kg: number, unit: WeightUnit) {
  return unit === "lb" ? kg * LB_PER_KG : kg;
}
export function toKg(value: number, unit: WeightUnit) {
  return unit === "lb" ? value / LB_PER_KG : value;
}
export function mTo(m: number, unit: DistanceUnit) {
  return unit === "mi" ? m / M_PER_MI : m / 1000;
}
export function toM(value: number, unit: DistanceUnit) {
  return unit === "mi" ? value * M_PER_MI : value * 1000;
}


// Tape measurements are stored in meters. Imperial distance users see inches, metric users cm.
export type LengthUnit = "in" | "cm";
export const lengthUnitFor = (d: DistanceUnit): LengthUnit => (d === "mi" ? "in" : "cm");
export function mToLength(m: number, unit: LengthUnit) {
  return unit === "in" ? m / 0.0254 : m * 100;
}
export function lengthToM(value: number, unit: LengthUnit) {
  return unit === "in" ? value * 0.0254 : value / 100;
}

/** Round to sensible precision and drop trailing zeros: 185, 82.5, 3.11 */
export function trim(n: number, decimals = 2) {
  const f = Math.pow(10, decimals);
  return String(Math.round(n * f) / f);
}

/** Display weight number only (no unit). lb rounded to 0.1, kg to 0.25-ish via 2 decimals. */
export function fmtWeight(kg: number | null | undefined, unit: WeightUnit) {
  if (kg == null) return "";
  return trim(kgTo(kg, unit), 1);
}

export function fmtDistance(m: number | null | undefined, unit: DistanceUnit, decimals = 2) {
  if (m == null) return "";
  return trim(mTo(m, unit), decimals);
}

export function fmtDuration(totalS: number | null | undefined, opts: { long?: boolean } = {}) {
  if (totalS == null || !isFinite(totalS)) return "";
  const s = Math.max(0, Math.round(totalS));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (opts.long) {
    if (h) return `${h}h ${m}m`;
    if (m) return `${m}m${sec ? ` ${sec}s` : ""}`;
    return `${sec}s`;
  }
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? h + ":" : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** Pace in seconds per display unit (mi or km). */
export function paceSecPer(distanceM: number | null | undefined, durationS: number | null | undefined, unit: DistanceUnit) {
  if (!distanceM || !durationS) return null;
  const d = mTo(distanceM, unit);
  return d > 0 ? durationS / d : null;
}

export function fmtPace(secPer: number | null | undefined, unit: DistanceUnit) {
  if (secPer == null || !isFinite(secPer)) return "–";
  return `${fmtDuration(secPer)} /${unit}`;
}

/** Parse "1:23:45", "23:45", "45" (minutes) into seconds. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(":").map(Number);
  if (parts.some(p => isNaN(p))) return null;
  if (parts.length === 1) return Math.round(parts[0] * 60);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

/** Default progression increment in kg for the user's unit system. */
export function defaultIncrementKg(upper: boolean, unit: WeightUnit) {
  if (unit === "lb") return toKg(upper ? 5 : 10, "lb");
  return upper ? 2.5 : 5;
}

/** Round a kg value so it lands on a loadable number in the user's unit (0.5 lb / 0.25 kg). */
export function roundLoadable(kg: number, unit: WeightUnit) {
  const step = unit === "lb" ? 0.5 : 0.25;
  const v = Math.round(kgTo(kg, unit) / step) * step;
  return toKg(v, unit);
}

/** Epley estimated 1RM. */
export function e1rm(weight: number, reps: number) {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}
