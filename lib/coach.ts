import { db } from "./db";
import { bad } from "./api";
import { e1rm } from "./units";
import { MUSCLES } from "./exerciseSeed";
import { saveBody } from "./repo/body";
import type { CoachAbout, CoachProfile, CoachRecommendation, CoachStats } from "./types";

// Reads what you've actually been doing and what you've told the app about yourself, and works out
// a plan that fits. Plain rules, so it works with no network and no keys. lib/coachAi.ts can add notes on top.

const DAY = 86_400_000;
const WORKING = `st.done = 1 AND st.kind IN ('normal','failure')`;
/** The muscles a balanced plan should cover. Forearms, neck and the like don't count as lagging. */
const MAJOR = ["chest", "lats", "upper_back", "front_delts", "side_delts", "rear_delts", "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "abs"];

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function aboutYou(userId: number): CoachAbout {
  const u = db.prepare("SELECT height_cm, sex, birth_year FROM users WHERE id = ?").get(userId) as { height_cm: number | null; sex: string | null; birth_year: number | null };
  const w = db.prepare("SELECT weight_kg, date FROM body_entries WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY date DESC LIMIT 1").get(userId) as { weight_kg: number; date: string } | undefined;
  const bf = db.prepare("SELECT body_fat_pct, date FROM body_entries WHERE user_id = ? AND body_fat_pct IS NOT NULL ORDER BY date DESC LIMIT 1").get(userId) as { body_fat_pct: number; date: string } | undefined;
  return {
    heightCm: u.height_cm, sex: u.sex === "male" || u.sex === "female" ? u.sex : null, birthYear: u.birth_year,
    weightKg: w?.weight_kg ?? null, weightDate: w?.date ?? null, bodyFatPct: bf?.body_fat_pct ?? null, bodyFatDate: bf?.date ?? null,
  };
}

/** Saves height, sex and birth year, and logs weight and body fat for today when they changed. */
export function saveAbout(userId: number, b: Record<string, unknown>, today: string) {
  const num = (v: unknown, name: string, min: number, max: number) => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw bad(`${name} is out of range`);
    return n;
  };
  const height = num(b.heightCm, "Height", 100, 250);
  const year = num(b.birthYear, "Birth year", 1900, new Date().getFullYear() - 10);
  const sex = b.sex === "male" || b.sex === "female" ? b.sex : null;
  db.prepare("UPDATE users SET height_cm = ?, sex = ?, birth_year = ? WHERE id = ?").run(height, sex, year === null ? null : Math.round(year), userId);

  const now = aboutYou(userId);
  const weight = num(b.weightKg, "Weight", 25, 350);
  const fat = num(b.bodyFatPct, "Body fat", 2, 70);
  const change: Record<string, unknown> = {};
  if (weight !== null && (now.weightKg === null || Math.abs(weight - now.weightKg) > 0.05)) change.weightKg = weight;
  if (fat !== null && (now.bodyFatPct === null || Math.abs(fat - now.bodyFatPct) > 0.05)) change.bodyFatPct = fat;
  if (Object.keys(change).length) saveBody(userId, { date: today, ...change });
}

export function trainingStats(userId: number, today: string): CoachStats {
  const end = new Date(`${today}T23:59:59Z`).getTime();
  // Lifting workouts only. Cardio is counted separately below, so a run doesn't count as a lifting day.
  const all = db.prepare(`SELECT id, started_at, ended_at, paused_s FROM sessions s WHERE user_id = ? AND ended_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM blocks b WHERE b.session_id = s.id AND b.kind = 'lift') ORDER BY started_at`).all(userId) as
    { id: number; started_at: string; ended_at: string; paused_s: number }[];
  const first = all[0] ? new Date(all[0].started_at).getTime() : null;
  const last = all.length ? new Date(all[all.length - 1].started_at).getTime() : null;

  // Look back 8 weeks, or to the first workout if that's sooner, so a new account isn't averaged over empty weeks.
  const windowDays = first ? Math.max(7, Math.min(56, Math.ceil((end - first) / DAY))) : 56;
  const since = iso(end - windowDays * DAY);
  const recent = all.filter(s => s.started_at.slice(0, 10) > since);
  const weeks = windowDays / 7;
  const activeWeeks = new Set(recent.map(s => Math.floor((end - new Date(s.started_at).getTime()) / (7 * DAY)))).size;

  const durations = recent.map(s => (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000 - (s.paused_s ?? 0) / 60)
    .filter(m => m >= 10 && m <= 240).sort((a, b) => a - b);

  // Sets per muscle each week over the last 4 weeks, counted like the Progress page: secondary muscles are half.
  const vSince = iso(end - Math.min(28, windowDays) * DAY);
  const vWeeks = Math.min(28, windowDays) / 7;
  const rows = db.prepare(`SELECT e.primary_muscles p, e.secondary_muscles s, COUNT(*) n FROM sets st
    JOIN blocks b ON b.id = st.block_id JOIN sessions se ON se.id = b.session_id JOIN exercises e ON e.id = b.exercise_id
    WHERE se.user_id = ? AND se.ended_at IS NOT NULL AND substr(se.started_at, 1, 10) > ? AND ${WORKING}
    GROUP BY e.id`).all(userId, vSince) as { p: string; s: string; n: number }[];
  const sets = new Map<string, number>();
  for (const r of rows) {
    for (const m of JSON.parse(r.p || "[]") as string[]) sets.set(m, (sets.get(m) ?? 0) + r.n);
    for (const m of JSON.parse(r.s || "[]") as string[]) sets.set(m, (sets.get(m) ?? 0) + r.n / 2);
  }
  const weeklySets: Record<string, number> = {};
  for (const [m, n] of sets) weeklySets[m] = Math.round((n / vWeeks) * 10) / 10;

  const cardio = db.prepare(`SELECT COALESCE(SUM(c.duration_s), 0) s, COUNT(DISTINCT se.id) n FROM cardio c
    JOIN blocks b ON b.id = c.block_id JOIN sessions se ON se.id = b.session_id
    WHERE se.user_id = ? AND se.ended_at IS NOT NULL AND substr(se.started_at, 1, 10) > ?`).get(userId, vSince) as { s: number; n: number };

  const reps = (db.prepare(`SELECT st.reps FROM sets st JOIN blocks b ON b.id = st.block_id JOIN sessions se ON se.id = b.session_id
    WHERE se.user_id = ? AND se.ended_at IS NOT NULL AND substr(se.started_at, 1, 10) > ? AND ${WORKING} AND st.reps > 0`).all(userId, since) as { reps: number }[])
    .map(r => r.reps).sort((a, b) => a - b);

  const lifts = db.prepare(`SELECT e.name, st.weight_kg w, st.reps r FROM sets st JOIN blocks b ON b.id = st.block_id
    JOIN sessions se ON se.id = b.session_id JOIN exercises e ON e.id = b.exercise_id
    WHERE se.user_id = ? AND se.ended_at IS NOT NULL AND substr(se.started_at, 1, 10) > ? AND ${WORKING} AND st.weight_kg > 0 AND st.reps BETWEEN 1 AND 12
      AND e.pattern IN ('squat','hinge','h_push','v_push','h_pull','v_pull')`).all(userId, iso(end - 84 * DAY)) as { name: string; w: number; r: number }[];
  const best = new Map<string, number>();
  for (const l of lifts) best.set(l.name, Math.max(best.get(l.name) ?? 0, e1rm(l.w, l.r)));

  return {
    totalSessions: all.length,
    trainingMonths: first ? Math.round(((end - first) / (30.4 * DAY)) * 10) / 10 : 0,
    windowWeeks: Math.round(weeks * 10) / 10,
    sessionsPerWeek: Math.round((recent.length / weeks) * 10) / 10,
    consistency: Math.round((activeWeeks / Math.max(1, Math.ceil(weeks))) * 100) / 100,
    daysSinceLast: last === null ? null : Math.floor((end - last) / DAY),
    typicalMinutes: durations.length ? Math.round(durations[Math.floor(durations.length / 2)]) : null,
    typicalReps: reps.length ? reps[Math.floor(reps.length / 2)] : null,
    weeklySets,
    cardioMinutesPerWeek: Math.round(cardio.s / 60 / vWeeks),
    cardioSessionsPerWeek: Math.round((cardio.n / vWeeks) * 10) / 10,
    bestLifts: [...best].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([name, kg]) => ({ name, e1rmKg: Math.round(kg * 10) / 10 })),
  };
}

type FatBand = "lean" | "fit" | "average" | "high";

function fatBand(pct: number, sex: "male" | "female" | null): FatBand {
  // ACE-style ranges. Without a sex, use the middle of the two.
  const [lean, fit, avg] = sex === "male" ? [14, 18, 25] : sex === "female" ? [21, 25, 32] : [17.5, 21.5, 28.5];
  return pct < lean ? "lean" : pct < fit ? "fit" : pct < avg ? "average" : "high";
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function recommend(about: CoachAbout, stats: CoachStats, today: string): CoachRecommendation {
  const why: string[] = [];
  const level: CoachRecommendation["level"] = stats.totalSessions < 24 || stats.trainingMonths < 4 ? "beginner" : stats.trainingMonths < 24 ? "intermediate" : "advanced";
  const returning = stats.daysSinceLast !== null && stats.daysSinceLast > 14;

  // Days: what you've actually been managing, nudged up a little, never past what your experience can recover from.
  let days = 3;
  if (stats.totalSessions >= 4) {
    days = clamp(Math.round(stats.sessionsPerWeek + 0.3), 2, 6);
    if (level === "beginner") days = Math.min(days, 4);
    if (stats.consistency < 0.5) days = Math.min(days, 3);
    why.push(`You've trained about ${stats.sessionsPerWeek} times a week over the last ${Math.round(stats.windowWeeks)} weeks${stats.consistency < 0.5 ? ", with some weeks off" : ""}, so ${days} days is realistic to keep up.`);
  } else {
    why.push("There isn't much workout history yet, so this starts at 3 days, which most people can keep up.");
  }

  const split = days === 2 ? "full" : days === 3 ? (level === "beginner" ? "full" : "ppl") : days === 4 ? "ul" : days === 5 ? "pplul" : "ppl2";
  if (days === 3) why.push(level === "beginner"
    ? "Full body three times a week gives new lifters the most practice on each lift. You can still switch to Push / Pull / Legs."
    : "Push / Pull / Legs hits each muscle once a week with plenty of exercises for it.");

  const band = about.bodyFatPct !== null ? fatBand(about.bodyFatPct, about.sex) : null;
  let goal: CoachRecommendation["goal"] = "muscle";
  if (band === "high") {
    goal = "general";
    why.push(`At ${about.bodyFatPct}% body fat, the plan leans toward losing fat: shorter rests to keep sessions dense, and more cardio. Lifting keeps the muscle you have while you lose fat.`);
  } else if (level === "advanced" && stats.typicalReps !== null && stats.typicalReps <= 6) {
    goal = "strength";
    why.push(`You mostly train heavy (around ${stats.typicalReps} reps a set) and have been lifting for a while, so the plan focuses on strength.`);
  } else if (band === "lean" || band === "fit") {
    why.push(`At ${about.bodyFatPct}% body fat you're in a good place to build muscle.`);
  } else if (band === "average") {
    why.push(`At ${about.bodyFatPct}% body fat, the plan builds muscle and adds a couple of cardio sessions to bring body fat down over time.`);
  }

  // Cardio: more when there's fat to lose, some for heart health either way, and never less than you already do.
  let cardioDays = band === "high" ? 3 : band === "average" ? 2 : 1;
  let cardioMinutes = band === "high" ? 30 : band === "average" ? 25 : 20;
  const yours = Math.round(stats.cardioSessionsPerWeek);
  if (yours > cardioDays) { cardioDays = Math.min(4, yours); why.push(`You already do cardio about ${yours} times a week, so that stays.`); }
  if (stats.cardioMinutesPerWeek > 0 && stats.cardioSessionsPerWeek > 0) {
    cardioMinutes = clamp(Math.round(stats.cardioMinutesPerWeek / stats.cardioSessionsPerWeek / 5) * 5, cardioMinutes, 60);
  }
  if (band === null) why.push("Log your body fat to tune the cardio and goal. Without it, the plan assumes you want to build muscle.");
  const weekly = days + cardioDays;
  if (weekly > 7) cardioDays = Math.max(0, 7 - days);

  const minutes = stats.typicalMinutes ? clamp(Math.round(stats.typicalMinutes / 5) * 5, 30, 90) : 60;
  if (stats.typicalMinutes) why.push(`Your workouts usually take about ${stats.typicalMinutes} minutes, so sessions are sized to ${minutes}.`);

  // Muscles you've trained before but barely touched lately get extra sets.
  const lagging = stats.totalSessions >= 6
    ? MAJOR.filter(m => (stats.weeklySets[m] ?? 0) < 4).slice(0, 5)
    : [];
  if (lagging.length) {
    const names = lagging.map(m => MUSCLES.find(x => x.id === m)?.label.toLowerCase() ?? m);
    why.push(`You've done under 4 sets a week lately for ${names.join(", ")}, so those get an extra set.`);
  }
  if (returning) why.push(`It's been ${stats.daysSinceLast} days since your last workout, so every exercise starts with one set fewer to ease back in. Add it back after a week or two.`);
  if (level === "beginner") why.push("As a newer lifter, sets are capped at 3 per exercise. You'll still progress quickly.");

  const age = about.birthYear ? Number(today.slice(0, 4)) - about.birthYear : null;
  if (age !== null && age >= 50) why.push("Over 50, recovery takes longer, so rest between sets is a bit longer.");

  const bmi = about.heightCm && about.weightKg ? Math.round((about.weightKg / (about.heightCm / 100) ** 2) * 10) / 10 : null;
  const ffmi = bmi !== null && about.bodyFatPct !== null ? Math.round(bmi * (1 - about.bodyFatPct / 100) * 10) / 10 : null;

  return { level, goal, days, split, minutes, cardioDays, cardioMinutes, lagging, returning, older: age !== null && age >= 50, bmi, ffmi, fatBand: band, why };
}

export function coachProfile(userId: number, today: string): CoachProfile {
  const about = aboutYou(userId);
  const stats = trainingStats(userId, today);
  return { about, stats, recommendation: recommend(about, stats, today) };
}
