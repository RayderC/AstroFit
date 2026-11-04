import { db } from "../db";
import { bad, notFound } from "../api";

export const MEASUREMENTS = [
  { id: "neck", label: "Neck" },
  { id: "chest", label: "Chest" },
  { id: "waist", label: "Waist" },
  { id: "hips", label: "Hips" },
  { id: "arms", label: "Arms" },
  { id: "thighs", label: "Thighs" },
  { id: "calves", label: "Calves" },
] as const;

export type BodyEntry = {
  id: number; date: string; weightKg: number | null; bodyFatPct: number | null;
  measurements: Record<string, number>; notes: string | null;
};

type Row = { id: number; date: string; weight_kg: number | null; body_fat_pct: number | null; measurements: string; notes: string | null };
const toDTO = (r: Row): BodyEntry => ({
  id: r.id, date: r.date, weightKg: r.weight_kg, bodyFatPct: r.body_fat_pct, measurements: JSON.parse(r.measurements || "{}"), notes: r.notes,
});

export function listBody(userId: number): BodyEntry[] {
  return (db.prepare("SELECT * FROM body_entries WHERE user_id = ? ORDER BY date").all(userId) as Row[]).map(toDTO);
}

function checked(v: unknown, name: string, min: number, max: number): number | null {
  if (v === null || v === "") return null;
  const n = Number(v);
  if (!isFinite(n) || n <= min || n > max) throw bad(`${name} is out of range`);
  return n;
}

function validDate(d: unknown): string {
  if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw bad("Date must be YYYY-MM-DD");
  // Rejects dates like 2026-02-31, which Date would roll over to March.
  const t = new Date(`${d}T00:00:00Z`);
  if (isNaN(t.getTime()) || t.toISOString().slice(0, 10) !== d) throw bad("Invalid date");
  return d;
}

/**
 * Log for a date, merging into any entry already there: a field left out stays as it was, null clears it.
 * That way weighing in the morning and measuring at night make one entry. An entry left empty is removed.
 */
export function saveBody(userId: number, b: Record<string, unknown>): BodyEntry | null {
  const date = validDate(b.date);
  const cur = db.prepare("SELECT * FROM body_entries WHERE user_id = ? AND date = ?").get(userId, date) as Row | undefined;
  const c = cur ? toDTO(cur) : { weightKg: null, bodyFatPct: null, measurements: {} as Record<string, number>, notes: null };

  const weightKg = b.weightKg !== undefined ? checked(b.weightKg, "Weight", 0, 1000) : c.weightKg;
  const bodyFatPct = b.bodyFatPct !== undefined ? checked(b.bodyFatPct, "Body fat", 0, 100) : c.bodyFatPct;
  const notes = b.notes !== undefined ? (b.notes ? String(b.notes).slice(0, 500) : null) : c.notes;
  const measurements = { ...c.measurements };
  if (b.measurements && typeof b.measurements === "object") {
    for (const [k, v] of Object.entries(b.measurements as Record<string, unknown>)) {
      const m = MEASUREMENTS.find(x => x.id === k);
      if (!m) throw bad("Unknown measurement");
      const n = checked(v, m.label, 0, 5);
      if (n == null) delete measurements[k]; else measurements[k] = n;
    }
  }

  if (weightKg == null && bodyFatPct == null && !notes && !Object.keys(measurements).length) {
    if (cur) db.prepare("DELETE FROM body_entries WHERE id = ?").run(cur.id);
    return null;
  }
  db.prepare(`INSERT INTO body_entries (user_id, date, weight_kg, body_fat_pct, measurements, notes) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET weight_kg = excluded.weight_kg, body_fat_pct = excluded.body_fat_pct,
      measurements = excluded.measurements, notes = excluded.notes`)
    .run(userId, date, weightKg, bodyFatPct, JSON.stringify(measurements), notes);
  return toDTO(db.prepare("SELECT * FROM body_entries WHERE user_id = ? AND date = ?").get(userId, date) as Row);
}

export function deleteBody(userId: number, id: number) {
  const r = db.prepare("DELETE FROM body_entries WHERE id = ? AND user_id = ?").run(id, userId);
  if (!r.changes) throw notFound("Entry not found");
}
