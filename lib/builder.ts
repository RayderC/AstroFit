import { db } from "./db";
import { listExercises } from "./repo/exercises";
import type { Pattern } from "./exerciseSeed";
import type { ExerciseDTO, RoutineBlockDTO } from "./types";

// Rule-based workout & program builder. No network, no AI — just movement patterns,
// your equipment, and what you've actually been doing.

export type Goal = "strength" | "muscle" | "general";
export type Focus = "full" | "upper" | "lower" | "push" | "pull" | "legs" | `muscle:${string}`;

type Slot = Pattern;
type DayTemplate = { name: string; slots: Slot[] };

const T: Record<string, DayTemplate> = {
  fullA: { name: "Full Body A", slots: ["squat", "h_push", "h_pull", "hinge", "side_delt", "biceps", "triceps", "core"] },
  fullB: { name: "Full Body B", slots: ["hinge", "v_push", "v_pull", "lunge", "chest_iso", "rear_delt", "calves", "core"] },
  fullC: { name: "Full Body C", slots: ["squat", "h_push", "v_pull", "glute_iso", "side_delt", "triceps", "biceps", "core"] },
  upperA: { name: "Upper A", slots: ["h_push", "h_pull", "v_push", "v_pull", "side_delt", "biceps", "triceps", "rear_delt"] },
  upperB: { name: "Upper B", slots: ["v_push", "v_pull", "h_push", "h_pull", "chest_iso", "triceps", "biceps", "side_delt"] },
  lowerA: { name: "Lower A", slots: ["squat", "hinge", "lunge", "quad_iso", "ham_iso", "calves", "core", "glute_iso"] },
  lowerB: { name: "Lower B", slots: ["hinge", "squat", "glute_iso", "ham_iso", "lunge", "calves", "core", "quad_iso"] },
  push: { name: "Push", slots: ["h_push", "v_push", "h_push", "chest_iso", "side_delt", "triceps", "triceps", "core"] },
  pull: { name: "Pull", slots: ["v_pull", "h_pull", "h_pull", "rear_delt", "biceps", "biceps", "traps", "core"] },
  legs: { name: "Legs", slots: ["squat", "hinge", "lunge", "quad_iso", "ham_iso", "calves", "glute_iso", "core"] },
};

const SPLITS: Record<number, { split: string; days: string[]; weekdays: number[] }> = {
  2: { split: "Full Body", days: ["fullA", "fullB"], weekdays: [1, 4] },
  3: { split: "Full Body", days: ["fullA", "fullB", "fullC"], weekdays: [1, 3, 5] },
  4: { split: "Upper / Lower", days: ["upperA", "lowerA", "upperB", "lowerB"], weekdays: [1, 2, 4, 5] },
  5: { split: "Push / Pull / Legs + Upper / Lower", days: ["push", "pull", "legs", "upperA", "lowerB"], weekdays: [1, 2, 3, 5, 6] },
  6: { split: "Push / Pull / Legs ×2", days: ["push", "pull", "legs", "push", "pull", "legs"], weekdays: [1, 2, 3, 4, 5, 6] },
};

const COMPOUND = new Set<Pattern>(["squat", "hinge", "lunge", "h_push", "v_push", "h_pull", "v_pull"]);

const PRESCRIPTION: Record<Goal, { main: [number, number, number, number]; compound: [number, number, number, number]; acc: [number, number, number, number] }> = {
  // [sets, repMin, repMax, restS]
  strength: { main: [4, 3, 5, 180], compound: [3, 6, 8, 150], acc: [3, 8, 12, 90] },
  muscle: { main: [3, 6, 10, 150], compound: [3, 8, 12, 120], acc: [3, 10, 15, 75] },
  general: { main: [3, 6, 10, 120], compound: [3, 8, 12, 90], acc: [2, 10, 15, 60] },
};

export function exercisesForMinutes(min: number) {
  return min <= 30 ? 4 : min <= 45 ? 5 : min <= 60 ? 6 : min <= 75 ? 7 : 8;
}

type Ctx = {
  pool: (ExerciseDTO & { timesDone: number })[];
  equipment: Set<string>;
  used: Map<string, number>; // pattern -> times used across the program (for variety)
  seed: number;
};

function makeCtx(userId: number, equipment: string[], seed = 0): Ctx {
  const usage = new Map((db.prepare(`SELECT b.exercise_id id, COUNT(DISTINCT b.session_id) n FROM blocks b JOIN sessions s ON s.id = b.session_id
    WHERE s.user_id = ? AND s.ended_at IS NOT NULL GROUP BY b.exercise_id`).all(userId) as { id: number; n: number }[]).map(r => [r.id, r.n]));
  const eq = new Set([...equipment, "bodyweight"]);
  const pool = listExercises(userId).filter(e => e.isBuiltin || usage.has(e.id)).map(e => ({ ...e, timesDone: usage.get(e.id) ?? 0 }));
  return { pool, equipment: eq, used: new Map(), seed };
}

function rankOf(e: ExerciseDTO & { timesDone: number }) {
  const r = (db.prepare("SELECT rank FROM exercises WHERE id = ?").get(e.id) as { rank: number } | undefined)?.rank ?? 5;
  return r - Math.min(e.timesDone, 6) * 0.4; // lean toward what you already do
}

function pick(ctx: Ctx, pattern: Pattern, taken: Set<number>, muscle?: string) {
  const cands = ctx.pool
    .filter(e => e.pattern === pattern && ctx.equipment.has(e.equipment) && !taken.has(e.id) && (!muscle || e.primary.includes(muscle)))
    .sort((a, b) => rankOf(a) - rankOf(b) || a.displayName.localeCompare(b.displayName));
  if (!cands.length) return null;
  const n = ctx.used.get(pattern) ?? 0;
  ctx.used.set(pattern, n + 1);
  // rotate through the top few choices so repeated days get different variations
  const top = cands.slice(0, Math.min(3, cands.length));
  return top[(n + ctx.seed) % top.length];
}

function blockFor(e: ExerciseDTO, kind: "main" | "compound" | "acc", goal: Goal): RoutineBlockDTO {
  const [sets, lo, hi, rest] = PRESCRIPTION[goal][kind];
  const timed = e.logType === "time";
  return {
    kind: "lift", superset: null, exerciseId: e.id, activityTypeId: null, exercise: e,
    setsCount: sets, repMin: timed ? null : lo, repMax: timed ? null : hi, targetWeightKg: null,
    restS: rest, targetDurationS: null, targetDistanceM: null, notes: null,
  };
}

function fillDay(ctx: Ctx, slots: Slot[], count: number, goal: Goal, minutes: number, muscle?: string): RoutineBlockDTO[] {
  const taken = new Set<number>();
  const out: RoutineBlockDTO[] = [];
  let compounds = 0;
  for (const slot of slots) {
    if (out.length >= count) break;
    const e = pick(ctx, slot, taken, muscle);
    if (!e) continue;
    taken.add(e.id);
    const isCompound = COMPOUND.has(slot);
    const kind = isCompound ? (compounds++ < 2 ? "main" : "compound") : "acc";
    out.push(blockFor(e, kind, goal));
  }
  // Short sessions: pair up accessories as supersets to save time.
  if (minutes <= 45) {
    const acc = out.map((b, i) => ({ b, i })).filter(x => !COMPOUND.has(x.b.exercise?.pattern as Pattern));
    for (let k = 0; k + 1 < acc.length; k += 2) {
      const g = 1000 + k;
      acc[k].b.superset = g; acc[k + 1].b.superset = g;
    }
    const ordered: RoutineBlockDTO[] = [];
    for (const b of out) {
      if (ordered.includes(b)) continue;
      ordered.push(b);
      if (b.superset != null) for (const o of out) if (o !== b && o.superset === b.superset && !ordered.includes(o)) ordered.push(o);
    }
    return ordered;
  }
  return out;
}

function cardioBlock(activityTypeId: number, minutes: number): RoutineBlockDTO {
  const a = db.prepare("SELECT id, name, has_distance, icon, is_builtin FROM activity_types WHERE id = ?").get(activityTypeId) as
    { id: number; name: string; has_distance: number; icon: string; is_builtin: number };
  return {
    kind: "cardio", superset: null, exerciseId: null, activityTypeId, setsCount: 1, repMin: null, repMax: null, targetWeightKg: null, restS: null,
    activity: { id: a.id, name: a.name, hasDistance: !!a.has_distance, icon: a.icon, isBuiltin: !!a.is_builtin },
    targetDurationS: minutes * 60, targetDistanceM: null, notes: null,
  };
}

// ── One-off workout ──────────────────────────────────────────────────────────

const FOCUS: Record<string, DayTemplate> = {
  full: T.fullA, upper: T.upperA, lower: T.lowerA, push: T.push, pull: T.pull, legs: T.legs,
};

export function buildWorkout(userId: number, o: { focus: string; minutes: number; equipment: string[]; goal: Goal; seed?: number; cardio?: { activityTypeId: number; minutes: number } | null }) {
  const ctx = makeCtx(userId, o.equipment, o.seed ?? 0);
  const count = exercisesForMinutes(o.minutes - (o.cardio?.minutes ?? 0));
  let name: string;
  let blocks: RoutineBlockDTO[];
  if (o.focus.startsWith("muscle:")) {
    const m = o.focus.slice(7);
    const patterns = [...new Set(ctx.pool.filter(e => e.primary.includes(m) && ctx.equipment.has(e.equipment)).map(e => e.pattern as Pattern))]
      .sort((a, b) => Number(COMPOUND.has(b)) - Number(COMPOUND.has(a)));
    const slots: Slot[] = [];
    while (slots.length < count && patterns.length) slots.push(...patterns.slice(0, count - slots.length));
    blocks = fillDay(ctx, slots, Math.min(count, 5), o.goal, o.minutes, m);
    name = `${m.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())} focus`;
  } else {
    const t = FOCUS[o.focus] ?? T.fullA;
    blocks = fillDay(ctx, t.slots, count, o.goal, o.minutes);
    name = t.name.replace(/ A$/, "");
  }
  if (o.cardio) blocks.push(cardioBlock(o.cardio.activityTypeId, o.cardio.minutes));
  return { name, blocks };
}

// ── Program ──────────────────────────────────────────────────────────────────

export function buildProgram(userId: number, o: {
  goal: Goal; days: number; minutes: number; equipment: string[];
  cardioDays: number; cardioMinutes: number; activityTypeId: number | null;
}) {
  const plan = SPLITS[Math.min(6, Math.max(2, o.days))];
  const ctx = makeCtx(userId, o.equipment);
  const count = exercisesForMinutes(o.minutes);
  const days: { weekday: number; name: string; blocks: RoutineBlockDTO[] }[] = plan.days.map((k, i) => ({
    weekday: plan.weekdays[i],
    name: T[k].name + (plan.days.indexOf(k) !== i ? " 2" : ""),
    blocks: fillDay(ctx, T[k].slots, count, o.goal, o.minutes),
  }));

  if (o.cardioDays > 0 && o.activityTypeId) {
    const rest = [3, 6, 0, 2, 4, 5, 1].filter(d => !days.some(x => x.weekday === d));
    let left = o.cardioDays;
    for (const d of rest) {
      if (!left) break;
      days.push({ weekday: d, name: "Cardio", blocks: [cardioBlock(o.activityTypeId, o.cardioMinutes)] });
      left--;
    }
    // no free days left: finish some lifting days with cardio instead
    for (const d of days.filter(x => x.name !== "Cardio")) {
      if (!left) break;
      d.blocks.push(cardioBlock(o.activityTypeId, Math.min(o.cardioMinutes, 20)));
      d.name += " + Cardio";
      left--;
    }
  }
  days.sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7));
  const goalName = { strength: "Strength", muscle: "Muscle", general: "General Fitness" }[o.goal];
  return { name: `${o.days}-Day ${plan.split} · ${goalName}`, split: plan.split, days };
}
