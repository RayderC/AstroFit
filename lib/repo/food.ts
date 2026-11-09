import { db, nowIso } from "../db";
import { bad, notFound, type UserRow } from "../api";
import { addDays } from "../tz";
import type { FoodDTO, FoodDayDTO, FoodEntryDTO, FoodGoals, Meal } from "../types";

// Nutrition is stored per serving: calories in kcal, macros in grams. serving_g is the serving's weight
// (or volume, for drinks) when it's known, which is what lets an entry be logged in grams.

export const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

type FoodRow = {
  id: number; user_id: number; name: string; brand: string | null; barcode: string | null; source: string;
  serving_label: string; serving_g: number | null; unit: string;
  kcal: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null; last_used_at: string | null;
};
type EntryRow = {
  id: number; day: string; meal: Meal; food_id: number | null; name: string; brand: string | null;
  amount: number; unit: string; kcal: number; protein_g: number | null; carbs_g: number | null; fat_g: number | null; created_at: string;
};

const toFood = (r: FoodRow): FoodDTO => ({
  id: r.id, name: r.name, brand: r.brand, barcode: r.barcode, source: r.source === "off" ? "off" : "custom",
  servingLabel: r.serving_label, servingG: r.serving_g, unit: r.unit === "ml" ? "ml" : "g",
  kcal: r.kcal, proteinG: r.protein_g, carbsG: r.carbs_g, fatG: r.fat_g,
});
const toEntry = (r: EntryRow): FoodEntryDTO => ({
  id: r.id, day: r.day, meal: r.meal, foodId: r.food_id, name: r.name, brand: r.brand, amount: r.amount,
  unit: r.unit as FoodEntryDTO["unit"], kcal: r.kcal, proteinG: r.protein_g, carbsG: r.carbs_g, fatG: r.fat_g,
});

// ── Validation ──

export function day(v: unknown): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(`${v}T00:00:00Z`))) throw bad("Invalid day");
  return v;
}
function meal(v: unknown): Meal {
  if (!MEALS.includes(v as Meal)) throw bad("Invalid meal");
  return v as Meal;
}
function text(v: unknown, max: number, name: string, required = false): string | null {
  if (v == null || v === "") { if (required) throw bad(`${name} is required`); return null; }
  if (typeof v !== "string") throw bad(`Invalid ${name.toLowerCase()}`);
  const t = v.trim().slice(0, max);
  if (required && !t) throw bad(`${name} is required`);
  return t || null;
}
function amountOf(v: unknown, max: number, name: string, required = false): number | null {
  if (v == null || v === "") { if (required) throw bad(`${name} is required`); return null; }
  const n = Number(v);
  if (!isFinite(n) || n < 0 || n > max) throw bad(`Invalid ${name.toLowerCase()}`);
  return Math.round(n * 10) / 10;
}
export function barcodeOf(v: unknown): string {
  const s = String(v ?? "").replace(/\s/g, "");
  // EAN-8, UPC-E, UPC-A, EAN-13 and GTIN-14 are all 6 to 14 digits.
  if (!/^\d{6,14}$/.test(s)) throw bad("A barcode is 6 to 14 digits");
  return s;
}

/** The fields that describe a food, from the client or Open Food Facts. */
export function foodFields(b: any) {
  return {
    name: text(b?.name, 120, "Name", true)!,
    brand: text(b?.brand, 80, "Brand"),
    barcode: b?.barcode ? barcodeOf(b.barcode) : null,
    source: b?.source === "off" ? "off" : "custom",
    serving_label: text(b?.servingLabel, 60, "Serving") ?? (b?.servingG ? `${b.servingG} ${b?.unit === "ml" ? "ml" : "g"}` : "1 serving"),
    serving_g: amountOf(b?.servingG, 5000, "Serving size"),
    unit: b?.unit === "ml" ? "ml" : "g",
    kcal: amountOf(b?.kcal, 10000, "Calories", true)!,
    protein_g: amountOf(b?.proteinG, 1000, "Protein"),
    carbs_g: amountOf(b?.carbsG, 1000, "Carbs"),
    fat_g: amountOf(b?.fatG, 1000, "Fat"),
  };
}

// ── Foods ──

export function ownFood(userId: number, id: number): FoodRow {
  const r = db.prepare("SELECT * FROM foods WHERE id = ? AND user_id = ?").get(id, userId) as FoodRow | undefined;
  if (!r) throw notFound("Food not found");
  return r;
}

export function listFoods(userId: number, q: string | null, limit = 30): FoodDTO[] {
  const rows = q
    ? db.prepare(`SELECT * FROM foods WHERE user_id = ? AND (name LIKE ? ESCAPE '\\' OR brand LIKE ? ESCAPE '\\')
        ORDER BY last_used_at IS NULL, last_used_at DESC, name LIMIT ?`).all(userId, like(q), like(q), limit)
    : db.prepare("SELECT * FROM foods WHERE user_id = ? ORDER BY last_used_at IS NULL, last_used_at DESC, id DESC LIMIT ?").all(userId, limit);
  return (rows as FoodRow[]).map(toFood);
}
const like = (q: string) => `%${q.replace(/[\\%_]/g, c => `\\${c}`)}%`;

export function foodByBarcode(userId: number, code: string): FoodDTO | null {
  const r = db.prepare("SELECT * FROM foods WHERE user_id = ? AND barcode = ?").get(userId, code) as FoodRow | undefined;
  return r ? toFood(r) : null;
}

/** Adds a food, or updates the one with the same barcode, so scanning a product twice doesn't duplicate it. */
export function saveFood(userId: number, b: any): FoodDTO {
  const f = foodFields(b);
  const count = (db.prepare("SELECT COUNT(*) c FROM foods WHERE user_id = ?").get(userId) as { c: number }).c;
  if (count >= 5000) throw bad("You have 5,000 saved foods. Delete some first.");
  if (f.barcode) {
    const existing = db.prepare("SELECT id FROM foods WHERE user_id = ? AND barcode = ?").get(userId, f.barcode) as { id: number } | undefined;
    if (existing) return updateFood(userId, existing.id, b);
  }
  const id = Number(db.prepare(`INSERT INTO foods (user_id, name, brand, barcode, source, serving_label, serving_g, unit, kcal, protein_g, carbs_g, fat_g)
    VALUES (@user_id, @name, @brand, @barcode, @source, @serving_label, @serving_g, @unit, @kcal, @protein_g, @carbs_g, @fat_g)`)
    .run({ ...f, user_id: userId }).lastInsertRowid);
  return toFood(ownFood(userId, id));
}

export function updateFood(userId: number, id: number, b: any): FoodDTO {
  const cur = toFood(ownFood(userId, id));
  const f = foodFields({ ...cur, ...b });
  db.prepare(`UPDATE foods SET name = @name, brand = @brand, barcode = @barcode, source = @source, serving_label = @serving_label,
    serving_g = @serving_g, unit = @unit, kcal = @kcal, protein_g = @protein_g, carbs_g = @carbs_g, fat_g = @fat_g WHERE id = @id`).run({ ...f, id });
  return toFood(ownFood(userId, id));
}

export function deleteFood(userId: number, id: number) {
  ownFood(userId, id);
  // Logged entries keep their own copy of the numbers, so history doesn't change.
  db.prepare("DELETE FROM foods WHERE id = ?").run(id);
}

// ── Diary ──

/** Scales a food's per-serving numbers to what was eaten. */
function portion(f: FoodRow, amount: number, unit: string) {
  let servings: number;
  if (unit === "serving") servings = amount;
  else {
    if (!f.serving_g) throw bad("This food has no serving weight, so log it in servings");
    servings = amount / f.serving_g;
  }
  const r = (v: number | null) => (v == null ? null : Math.round(v * servings * 10) / 10);
  return { kcal: Math.round(f.kcal * servings), protein_g: r(f.protein_g), carbs_g: r(f.carbs_g), fat_g: r(f.fat_g) };
}

function unitOf(v: unknown, f: FoodRow): string {
  if (v === "serving") return "serving";
  if (v === "g" || v === "ml") return f.unit;
  throw bad("Invalid unit");
}

export function addEntry(userId: number, b: any): FoodEntryDTO {
  const f = ownFood(userId, Number(b?.foodId));
  const amount = amountOf(b?.amount, 10000, "Amount", true)!;
  if (amount <= 0) throw bad("Amount must be more than zero");
  const unit = unitOf(b?.unit ?? "serving", f);
  const p = portion(f, amount, unit);
  const id = Number(db.prepare(`INSERT INTO food_entries (user_id, day, meal, food_id, name, brand, amount, unit, kcal, protein_g, carbs_g, fat_g)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(userId, day(b?.day), meal(b?.meal), f.id, f.name, f.brand, amount, unit, p.kcal, p.protein_g, p.carbs_g, p.fat_g).lastInsertRowid);
  db.prepare("UPDATE foods SET last_used_at = ? WHERE id = ?").run(nowIso(), f.id);
  return toEntry(db.prepare("SELECT * FROM food_entries WHERE id = ?").get(id) as EntryRow);
}

/** A quick entry with no saved food: just a name and calories, for when you know the numbers. */
export function addQuickEntry(userId: number, b: any): FoodEntryDTO {
  const name = text(b?.name, 120, "Name") ?? "Quick add";
  const kcal = amountOf(b?.kcal, 20000, "Calories", true)!;
  const id = Number(db.prepare(`INSERT INTO food_entries (user_id, day, meal, food_id, name, amount, unit, kcal, protein_g, carbs_g, fat_g)
    VALUES (?, ?, ?, NULL, ?, 1, 'serving', ?, ?, ?, ?)`).run(userId, day(b?.day), meal(b?.meal), name, Math.round(kcal),
      amountOf(b?.proteinG, 2000, "Protein"), amountOf(b?.carbsG, 2000, "Carbs"), amountOf(b?.fatG, 2000, "Fat")).lastInsertRowid);
  return toEntry(db.prepare("SELECT * FROM food_entries WHERE id = ?").get(id) as EntryRow);
}

function ownEntry(userId: number, id: number): EntryRow {
  const r = db.prepare("SELECT * FROM food_entries WHERE id = ? AND user_id = ?").get(id, userId) as EntryRow | undefined;
  if (!r) throw notFound("Entry not found");
  return r;
}

export function updateEntry(userId: number, id: number, b: any): FoodEntryDTO {
  const e = ownEntry(userId, id);
  const newMeal = b?.meal !== undefined ? meal(b.meal) : e.meal;
  const newDay = b?.day !== undefined ? day(b.day) : e.day;
  let numbers = { amount: e.amount, unit: e.unit, kcal: e.kcal, protein_g: e.protein_g, carbs_g: e.carbs_g, fat_g: e.fat_g };
  if (b?.amount !== undefined || b?.unit !== undefined) {
    const amount = amountOf(b.amount ?? e.amount, 10000, "Amount", true)!;
    if (amount <= 0) throw bad("Amount must be more than zero");
    const f = e.food_id ? (db.prepare("SELECT * FROM foods WHERE id = ? AND user_id = ?").get(e.food_id, userId) as FoodRow | undefined) : undefined;
    if (f) {
      const unit = unitOf(b.unit ?? e.unit, f);
      numbers = { amount, unit, ...portion(f, amount, unit) };
    } else {
      // The food was deleted or this was a quick add: scale what was logged.
      const k = amount / e.amount;
      const r = (v: number | null) => (v == null ? null : Math.round(v * k * 10) / 10);
      numbers = { amount, unit: e.unit, kcal: Math.round(e.kcal * k), protein_g: r(e.protein_g), carbs_g: r(e.carbs_g), fat_g: r(e.fat_g) };
    }
  }
  db.prepare(`UPDATE food_entries SET day = ?, meal = ?, amount = ?, unit = ?, kcal = ?, protein_g = ?, carbs_g = ?, fat_g = ? WHERE id = ?`)
    .run(newDay, newMeal, numbers.amount, numbers.unit, numbers.kcal, numbers.protein_g, numbers.carbs_g, numbers.fat_g, id);
  return toEntry(ownEntry(userId, id));
}

export function deleteEntry(userId: number, id: number) {
  ownEntry(userId, id);
  db.prepare("DELETE FROM food_entries WHERE id = ?").run(id);
}

/** Copies every entry from one day to another, for days you eat the same thing. */
export function copyDay(userId: number, from: string, to: string, onlyMeal?: Meal) {
  const rows = db.prepare(`SELECT * FROM food_entries WHERE user_id = ? AND day = ? ${onlyMeal ? "AND meal = ?" : ""} ORDER BY id`)
    .all(...[userId, day(from), ...(onlyMeal ? [onlyMeal] : [])]) as EntryRow[];
  const ins = db.prepare(`INSERT INTO food_entries (user_id, day, meal, food_id, name, brand, amount, unit, kcal, protein_g, carbs_g, fat_g)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  db.transaction(() => { for (const r of rows) ins.run(userId, day(to), r.meal, r.food_id, r.name, r.brand, r.amount, r.unit, r.kcal, r.protein_g, r.carbs_g, r.fat_g); })();
  return rows.length;
}

export function goalsOf(user: UserRow): FoodGoals {
  const u = user as UserRow & { kcal_goal: number | null; protein_goal_g: number | null; carbs_goal_g: number | null; fat_goal_g: number | null };
  return { kcal: u.kcal_goal ?? null, proteinG: u.protein_goal_g ?? null, carbsG: u.carbs_goal_g ?? null, fatG: u.fat_goal_g ?? null };
}

export function setGoals(userId: number, b: any): void {
  const n = (v: unknown, max: number, name: string) => {
    const x = amountOf(v, max, name);
    return x == null || x === 0 ? null : Math.round(x);
  };
  db.prepare("UPDATE users SET kcal_goal = ?, protein_goal_g = ?, carbs_goal_g = ?, fat_goal_g = ? WHERE id = ?").run(
    n(b?.kcal, 20000, "Calorie goal"), n(b?.proteinG, 2000, "Protein goal"), n(b?.carbsG, 2000, "Carb goal"), n(b?.fatG, 2000, "Fat goal"), userId);
}

export function foodDay(user: UserRow, d: string): FoodDayDTO {
  const entries = (db.prepare("SELECT * FROM food_entries WHERE user_id = ? AND day = ? ORDER BY id").all(user.id, day(d)) as EntryRow[]).map(toEntry);
  const sum = (k: "kcal" | "proteinG" | "carbsG" | "fatG") => Math.round(entries.reduce((a, e) => a + (e[k] ?? 0), 0) * 10) / 10;
  const from = addDays(d, -6);
  const byDay = new Map((db.prepare("SELECT day, SUM(kcal) kcal FROM food_entries WHERE user_id = ? AND day BETWEEN ? AND ? GROUP BY day")
    .all(user.id, from, d) as { day: string; kcal: number }[]).map(r => [r.day, r.kcal]));
  const week = Array.from({ length: 7 }, (_, i) => addDays(from, i)).map(x => ({ day: x, kcal: Math.round(byDay.get(x) ?? 0) }));
  return {
    day: d, entries,
    totals: { kcal: Math.round(sum("kcal")), proteinG: sum("proteinG"), carbsG: sum("carbsG"), fatG: sum("fatG") },
    goals: goalsOf(user),
    week,
  };
}

export function exportFood(userId: number) {
  return {
    foods: db.prepare("SELECT * FROM foods WHERE user_id = ? ORDER BY id").all(userId),
    entries: db.prepare("SELECT * FROM food_entries WHERE user_id = ? ORDER BY day, id").all(userId),
  };
}
