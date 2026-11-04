// Parser for Strong (iOS) CSV exports. No database access, so it can be tested on its own.
// Strong writes one row per set:
//   Date, Workout Name, Duration, Exercise Name, Set Order, Weight, Reps, Distance, Seconds, Notes, Workout Notes, RPE

import type { SetKind } from "./types";
import { zonedToUtc } from "./tz";

export type StrongSet = {
  kind: SetKind; weight: number | null; reps: number | null; distance: number | null; seconds: number | null; rpe: number | null;
  weightUnit: "lb" | "kg" | null; distanceUnit: "mi" | "km" | "m" | null;
};
export type StrongBlock = { exercise: string; notes: string | null; restS: number | null; sets: StrongSet[] };
export type StrongWorkout = {
  /** Stable across re-exports, so importing a newer file only adds what's new. Excludes "Workout #", which can renumber. */
  key: string; name: string; startedAt: string; durationS: number; notes: string | null; blocks: StrongBlock[];
};
export type StrongFile = {
  delimiter: string; dataRows: number; emptySets: number; restRows: number; ignoredRows: number; badDates: number;
  /** Units named by the file's own header, if any. */
  weightUnit: "lb" | "kg" | null; distanceUnit: "mi" | "km" | null;
  workouts: StrongWorkout[];
};

export class StrongFormatError extends Error {}

/** The delimiter that splits the header line most, ignoring anything inside quotes. */
export function detectDelimiter(text: string) {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** RFC 4180 CSV: quoted fields can hold delimiters, doubled quotes and line breaks. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delimiter) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some(c => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== "")) rows.push(row);
  return rows;
}

type Col = "date" | "workout" | "duration" | "exercise" | "order" | "weight" | "reps" | "distance" | "seconds" | "notes" | "workoutNotes" | "rpe" | "workoutNo" | "weightUnit" | "distanceUnit";

const HEADER: [RegExp, Col][] = [
  [/^date$/, "date"],
  [/^workout name$/, "workout"],
  [/^(workout )?duration( \(.*\))?$/, "duration"],
  [/^exercise( name)?$/, "exercise"],
  [/^set( order)?$/, "order"],
  [/^weight unit$/, "weightUnit"],
  [/^weight( \(.*\))?$/, "weight"],
  [/^reps$/, "reps"],
  [/^distance unit$/, "distanceUnit"],
  [/^distance( \(.*\))?$/, "distance"],
  [/^seconds$/, "seconds"],
  [/^(exercise )?notes?$/, "notes"],
  [/^workout notes?$/, "workoutNotes"],
  [/^rpe$/, "rpe"],
  [/^workout #$/, "workoutNo"],
];

function unitOfWeight(s: string | undefined): "lb" | "kg" | null {
  const u = s?.toLowerCase() ?? "";
  return /\blbs?\b/.test(u) ? "lb" : /\bkgs?\b/.test(u) ? "kg" : null;
}
function unitOfDistance(s: string | undefined): "mi" | "km" | "m" | null {
  const u = s?.toLowerCase() ?? "";
  return /\b(mi|miles?)\b/.test(u) ? "mi" : /\b(km|kilomet\w+)\b/.test(u) ? "km" : /\b(m|met\w+)\b/.test(u) ? "m" : null;
}

function num(s: string | undefined, delimiter: string): number | null {
  const t = (s ?? "").trim();
  if (!t) return null;
  // Semicolon files come from locales that write decimals with a comma.
  const n = Number(delimiter === ";" ? t.replace(",", ".") : t);
  return isFinite(n) ? n : null;
}

/** "1h 5m", "45m", "30s", "1:05:00", or a bare number of seconds. */
export function parseStrongDuration(s: string | undefined): number {
  const t = (s ?? "").trim().toLowerCase();
  if (!t) return 0;
  if (/^\d+(\.\d+)?$/.test(t)) return Math.round(Number(t));
  const colon = t.match(/^(?:(\d+):)?(\d+):(\d+)$/);
  if (colon) return Number(colon[1] ?? 0) * 3600 + Number(colon[2]) * 60 + Number(colon[3]);
  const part = (re: RegExp) => Number(t.match(re)?.[1] ?? 0);
  return part(/(\d+)\s*h/) * 3600 + part(/(\d+)\s*m/) * 60 + part(/(\d+)\s*s/);
}

/** Strong's dates are wall-clock with no zone. Returns UTC ISO, or null if unreadable. */
export function parseStrongDate(s: string, tz: string): string | null {
  const t = s.trim();
  const m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], +(m[6] ?? 0), tz);
  const d = new Date(t);
  if (isNaN(d.getTime())) return null;
  if (/(z|[+-]\d{2}:?\d{2})$/i.test(t)) return d.toISOString(); // carries its own zone
  // Other readable forms ("Jan 5, 2024, 5:32 PM"): Date parsed them as server-local, so read the wall clock back.
  return zonedToUtc(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), tz);
}

/** Set Order cell: "1" / "W" / "D" / "F", and the odd non-set rows. */
function orderOf(s: string | undefined): { type: "set"; kind: SetKind; n: number | null } | { type: "rest" | "note" | "unknown" } {
  const t = (s ?? "").trim().toLowerCase();
  if (!t) return { type: "set", kind: "normal", n: null };
  if (/^\d+$/.test(t)) return { type: "set", kind: "normal", n: Number(t) };
  if (/^\d+\s*w$|^w$|^warm/.test(t)) return { type: "set", kind: "warmup", n: null };
  if (/^\d+\s*d$|^d$|^drop/.test(t)) return { type: "set", kind: "drop", n: null };
  if (/^\d+\s*f$|^f$|^fail/.test(t)) return { type: "set", kind: "failure", n: null };
  if (t.includes("rest")) return { type: "rest" };
  if (t.includes("note")) return { type: "note" };
  return { type: "unknown" };
}

export function parseStrong(rawText: string, tz: string): StrongFile {
  const text = rawText.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows = parseCsv(text, delimiter);
  if (rows.length < 1) throw new StrongFormatError("That file is empty.");

  const col = new Map<Col, number>();
  rows[0].forEach((h, i) => {
    const name = h.trim().toLowerCase();
    const hit = HEADER.find(([re]) => re.test(name));
    if (hit && !col.has(hit[1])) col.set(hit[1], i);
  });
  const missing = (["date", "exercise"] as Col[]).filter(c => !col.has(c));
  if (missing.length) {
    throw new StrongFormatError(`This doesn't look like a Strong export: no ${missing.map(m => (m === "date" ? "Date" : "Exercise Name")).join(" or ")} column. Found: ${rows[0].join(", ").slice(0, 200)}`);
  }

  const out: StrongFile = {
    delimiter, dataRows: rows.length - 1, emptySets: 0, restRows: 0, ignoredRows: 0, badDates: 0,
    weightUnit: col.has("weight") ? unitOfWeight(rows[0][col.get("weight")!]) : null,
    distanceUnit: null, workouts: [],
  };
  const hd = col.has("distance") ? unitOfDistance(rows[0][col.get("distance")!]) : null;
  out.distanceUnit = hd === "mi" || hd === "km" ? hd : null;

  const byKey = new Map<string, StrongWorkout>();
  const lastNumber = new Map<StrongBlock, number>();
  const pendingRest = new Map<StrongWorkout, Map<string, number>>();
  const badKeys = new Set<string>();

  for (const r of rows.slice(1)) {
    const get = (c: Col) => (col.has(c) ? r[col.get(c)!] : undefined);
    const rawDate = (get("date") ?? "").trim();
    const workoutName = (get("workout") ?? "").trim() || "Workout";
    const exercise = (get("exercise") ?? "").trim();
    const key = `${rawDate}|${workoutName}`;
    const groupKey = col.has("workoutNo") && get("workoutNo")?.trim() ? `#${get("workoutNo")!.trim()}` : key;

    let w = byKey.get(groupKey);
    if (!w) {
      const startedAt = parseStrongDate(rawDate, tz);
      if (!startedAt) {
        if (!badKeys.has(groupKey)) { badKeys.add(groupKey); out.badDates++; }
        continue;
      }
      w = { key, name: workoutName.slice(0, 100), startedAt, durationS: parseStrongDuration(get("duration")), notes: get("workoutNotes")?.trim() || null, blocks: [] };
      byKey.set(groupKey, w);
    }
    if (!w.notes && get("workoutNotes")?.trim()) w.notes = get("workoutNotes")!.trim();

    const order = orderOf(get("order"));
    const seconds = num(get("seconds"), delimiter);
    let last = w.blocks[w.blocks.length - 1];

    if (order.type === "rest" || /^rest( timer)?$/i.test(exercise)) {
      out.restRows++;
      if (seconds && exercise) {
        if (last?.exercise === exercise) last.restS = seconds;
        else {
          const p = pendingRest.get(w) ?? new Map<string, number>();
          p.set(exercise, seconds);
          pendingRest.set(w, p);
        }
      }
      continue;
    }
    if (order.type === "note") {
      const note = get("notes")?.trim();
      if (note && last?.exercise === exercise) last.notes = last.notes ?? note;
      else out.ignoredRows++;
      continue;
    }
    if (order.type !== "set" || !exercise) { out.ignoredRows++; continue; }

    // Strong writes 0 rather than blank for fields a set doesn't use.
    const pos = (n: number | null) => (n && n > 0 ? n : null);
    const set: StrongSet = {
      kind: order.kind,
      weight: pos(num(get("weight"), delimiter)),
      reps: pos(num(get("reps"), delimiter)),
      distance: pos(num(get("distance"), delimiter)),
      seconds: pos(seconds),
      rpe: pos(num(get("rpe"), delimiter)),
      weightUnit: unitOfWeight(get("weightUnit")),
      distanceUnit: unitOfDistance(get("distanceUnit")),
    };
    if (set.weight == null && set.reps == null && set.distance == null && set.seconds == null) { out.emptySets++; continue; }

    // Consecutive rows of one exercise are one block, unless numbering restarts (it was done twice in a row).
    const restarted = last?.exercise === exercise && order.n != null && order.n <= (lastNumber.get(last) ?? 0);
    if (!last || last.exercise !== exercise || restarted) {
      last = { exercise, notes: null, restS: pendingRest.get(w)?.get(exercise) ?? null, sets: [] };
      pendingRest.get(w)?.delete(exercise);
      w.blocks.push(last);
    }
    if (order.n != null) lastNumber.set(last, order.n);
    last.notes = last.notes ?? (get("notes")?.trim() || null);
    last.sets.push(set);
  }

  out.workouts = [...byKey.values()].filter(w => w.blocks.length > 0).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  return out;
}
