// Optional coach notes from Google's Gemini API, which has a free tier. Off until an admin pastes a key in
// on the Admin page, or GEMINI_API_KEY is set. The plan itself always comes from lib/coach.ts; this only adds advice in words.
import { HttpError } from "./api";
import { getSetting, keyHint } from "./settings";
import { MUSCLES } from "./exerciseSeed";
import type { CoachProfile } from "./types";

/** The container's environment wins, so a key set there can't be changed from the app. */
function apiKey(): { key: string; source: "env" | "app" } | null {
  if (process.env.GEMINI_API_KEY) return { key: process.env.GEMINI_API_KEY, source: "env" };
  const k = getSetting("gemini_api_key");
  return k ? { key: k, source: "app" } : null;
}

export const aiEnabled = () => apiKey() !== null;

export function aiStatus() {
  const k = apiKey();
  return { configured: !!k, source: k?.source ?? null, hint: keyHint(k?.key) };
}

/** An alias Google points at its current Flash model, so this keeps working as models are replaced. */
// Flash-Lite answers in about a second and has the biggest free allowance; a few short tips don't need more.
const model = () => (process.env.GEMINI_MODEL || "gemini-flash-lite-latest").replace(/[^a-z0-9.\-]/gi, "");
/** Used when the main model is overloaded. Also free, but slower, since it thinks before answering. */
const FALLBACK_MODEL = "gemini-flash-latest";

export type PlanSummary = { name: string; days: { weekday: string; name: string; exercises: string[] }[] };

function describe(p: CoachProfile, plan: PlanSummary | null, weightUnit: "lb" | "kg") {
  const { about: a, stats: s, recommendation: r } = p;
  const w = (kg: number) => weightUnit === "lb" ? `${Math.round(kg * 2.20462)} lb` : `${Math.round(kg)} kg`;
  const lines = [
    `Sex: ${a.sex ?? "not given"}. Age: ${a.birthYear ? new Date().getFullYear() - a.birthYear : "not given"}.`,
    `Height: ${a.heightCm ? `${Math.round(a.heightCm)} cm` : "not given"}. Weight: ${a.weightKg ? w(a.weightKg) : "not given"}. Body fat: ${a.bodyFatPct ?? "not given"}%.`,
    r.bmi ? `BMI ${r.bmi}${r.ffmi ? `, FFMI ${r.ffmi}` : ""}.` : "",
    `Training: ${s.totalSessions} workouts logged over ${s.trainingMonths} months; ${s.sessionsPerWeek} per week lately; ${Math.round(s.consistency * 100)}% of recent weeks trained; last workout ${s.daysSinceLast ?? "never"} days ago.`,
    `Typical session ${s.typicalMinutes ?? "?"} min, typical ${s.typicalReps ?? "?"} reps per set. Cardio ${s.cardioMinutesPerWeek} min a week.`,
    `Weekly working sets per muscle (last 4 weeks): ${MUSCLES.map(m => `${m.label} ${s.weeklySets[m.id] ?? 0}`).join(", ")}.`,
    s.bestLifts.length ? `Best estimated 1-rep maxes: ${s.bestLifts.map(l => `${l.name} ${w(l.e1rmKg)}`).join(", ")}.` : "",
    `The app chose: ${r.level} level, ${r.days} lifting days (${r.split}), goal ${r.goal}, ${r.cardioDays} cardio sessions of ${r.cardioMinutes} min.`,
    plan ? `The plan: ${plan.days.map(d => `${d.weekday} ${d.name}: ${d.exercises.join(", ")}`).join(" | ")}.` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** A few short, specific tips about this person's plan. Plain text, one tip per line. */
export async function coachNotes(p: CoachProfile, plan: PlanSummary | null, weightUnit: "lb" | "kg"): Promise<string[]> {
  const key = apiKey();
  if (!key) throw new HttpError(400, "AI notes aren't set up. An admin can add a free Gemini key on the Admin page.");
  const prompt = `You are an experienced strength coach. Below is a lifter's data from their workout log and the weekly plan an app built for them.
Give 4 to 6 short, specific tips for following this plan over the next 4 to 8 weeks: what to watch, how to progress, recovery, and anything in their data that stands out.
Base every tip on their numbers. Don't repeat the plan back, don't give medical advice, and don't suggest changing apps.
Answer as plain text, one tip per line, each under 35 words, with no numbering, bullets or markdown.

${describe(p, plan, weightUnit)}`;

  const ask = (m: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key.key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 2048 } }),
    signal: AbortSignal.timeout(45_000),
  });

  // Free-tier models are often briefly overloaded (503). Try again once, then the lighter Flash-Lite model.
  const attempts = [model(), model(), FALLBACK_MODEL].filter((m, i, a) => i < 2 || m !== a[0]);
  let res: Response | null = null;
  for (const [i, m] of attempts.entries()) {
    try { res = await ask(m); } catch { res = null; }
    if (res && res.status !== 503 && res.status !== 500) break;
    console.warn(`[coach] ${m} answered ${res?.status ?? "no response"}`);
    if (i < attempts.length - 1) await new Promise(r => setTimeout(r, 1500));
  }
  if (!res) throw new HttpError(502, "Couldn't reach Gemini. Try again in a moment.");
  if (!res.ok) {
    console.warn(`[coach] Gemini answered ${res.status}`);
    if (res.status === 429) throw new HttpError(429, "Gemini's free limit is used up for now. Try again later, or tomorrow.");
    if (res.status === 400 || res.status === 403) throw new HttpError(502, "Gemini didn't accept the key. Check it on the Admin page.");
    if (res.status === 404) throw new HttpError(502, "That Gemini model doesn't exist. Check GEMINI_MODEL.");
    if (res.status === 503 || res.status === 500) throw new HttpError(503, "Gemini is busy right now. Try again in a minute.");
    throw new HttpError(502, "Gemini isn't available right now.");
  }
  const j = await res.json() as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
  const text = (j.candidates?.[0]?.content?.parts ?? []).filter(x => !x.thought).map(x => x.text ?? "").join("");
  const tips = text.split("\n")
    .map(l => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").replace(/\*\*/g, "").trim())
    .filter(l => l.length > 3)
    .slice(0, 8)
    .map(l => l.slice(0, 400));
  if (!tips.length) throw new HttpError(502, "Gemini didn't send any notes. Try again.");
  return tips;
}

/** Checks the key and model by looking the model up, which doesn't count against the free daily notes. */
export async function testKey(): Promise<string> {
  const key = apiKey();
  if (!key) throw new HttpError(400, "Save a key first.");
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model()}`, {
      headers: { "x-goog-api-key": key.key }, signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new HttpError(502, "Couldn't reach Google. Check the server's internet connection.");
  }
  if (res.status === 400 || res.status === 401 || res.status === 403) throw new HttpError(400, "Google didn't accept that key. Copy it again from AI Studio, the whole thing.");
  if (res.status === 404) throw new HttpError(400, `The key works, but the model "${model()}" doesn't exist. Check GEMINI_MODEL.`);
  if (!res.ok) throw new HttpError(502, `Google answered ${res.status}. Try again in a minute.`);
  const j = await res.json() as { displayName?: string };
  return `It works. Coach notes will use ${j.displayName ?? model()}.`;
}
