"use client";

import { useMemo, useState } from "react";
import Chart from "@/app/components/Chart";
import Icon from "@/app/components/Icon";
import Modal from "@/app/components/Modal";
import AddFood, { MEAL_LABEL, MealPicker, macroLine } from "@/app/components/food/AddFood";
import { api, fmtDate, localDay, parseNum, useApi } from "@/lib/client";
import type { FoodDayDTO, FoodEntryDTO, FoodGoals, Meal } from "@/lib/types";

const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

function shiftDay(day: string, n: number) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDay(d);
}

function dayTitle(day: string) {
  const today = localDay();
  if (day === today) return "Today";
  if (day === shiftDay(today, -1)) return "Yesterday";
  if (day === shiftDay(today, 1)) return "Tomorrow";
  return fmtDate(day, { weekday: "short", month: "short", day: "numeric" });
}

export default function FoodPage() {
  const [day, setDay] = useState(localDay());
  const { data, error, reload } = useApi<FoodDayDTO>(`/api/food/day?day=${day}`);
  const [adding, setAdding] = useState<Meal | null>(null);
  const [editing, setEditing] = useState<FoodEntryDTO | null>(null);
  const [goals, setGoals] = useState(false);
  const [msg, setMsg] = useState("");

  const byMeal = useMemo(() => {
    const m = new Map<Meal, FoodEntryDTO[]>(MEALS.map(x => [x, []]));
    for (const e of data?.entries ?? []) m.get(e.meal)?.push(e);
    return m;
  }, [data]);

  async function copyYesterday() {
    setMsg("");
    try {
      const r = await api<{ copied: number }>("/api/food/entries", { body: { copyFrom: shiftDay(day, -1), day } });
      setMsg(r.copied ? `Copied ${r.copied} ${r.copied === 1 ? "item" : "items"} from the day before.` : "Nothing was logged the day before.");
      reload();
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="page page-narrow">
      <div className="dash-header">
        <div><h1 className="dash-title">Food</h1><p className="dash-subtitle">Calories and macros, by meal</p></div>
        <button className="btn-secondary btn-sm" onClick={() => setGoals(true)}><Icon name="target" size={14} /> Goals</button>
      </div>

      <div className="food-daynav">
        <button className="icon-btn" onClick={() => setDay(shiftDay(day, -1))} aria-label="Previous day"><Icon name="back" /></button>
        <button className="food-daytitle" onClick={() => setDay(localDay())} title="Back to today">{dayTitle(day)}</button>
        <button className="icon-btn" onClick={() => setDay(shiftDay(day, 1))} aria-label="Next day"><Icon name="chevron" /></button>
      </div>

      {error && <p className="form-error">{error}</p>}
      {!data ? !error && <div className="loading">Loading…</div> : (
        <>
          <Summary d={data} onGoals={() => setGoals(true)} />

          {MEALS.map(m => {
            const list = byMeal.get(m) ?? [];
            const kcal = list.reduce((a, e) => a + e.kcal, 0);
            return (
              <section key={m} className="card section food-meal">
                <div className="card-header">
                  <span className="card-title">{MEAL_LABEL[m]}</span>
                  <span className="row-sub">{kcal ? `${Math.round(kcal)} kcal` : ""}</span>
                </div>
                {list.map(e => (
                  <button key={e.id} className="food-entry" onClick={() => setEditing(e)}>
                    <span className="food-entry-main">
                      <span className="food-entry-name">{e.name}</span>
                      <span className="row-sub">{[amountText(e), macroLine(e)].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="food-kcal">{Math.round(e.kcal)}<small>kcal</small></span>
                  </button>
                ))}
                <button className="add-set-btn" onClick={() => setAdding(m)}><Icon name="plus" size={14} /> Add food</button>
              </section>
            );
          })}

          {data.entries.length === 0 && (
            <div className="section" style={{ textAlign: "center" }}>
              <button className="btn-ghost btn-sm" onClick={copyYesterday}>Copy everything from the day before</button>
            </div>
          )}
          {msg && <p className="form-hint" style={{ textAlign: "center" }}>{msg}</p>}

          <div className="card section">
            <div className="card-header"><span className="card-title">Last 7 days</span><span className="row-sub">{weekAverage(data)}</span></div>
            <Chart kind="bar" color="var(--accent-cyan)" points={data.week.map(w => ({ x: w.day, y: w.kcal }))}
              label={p => `${fmtDate(p.x, { weekday: "short", month: "short", day: "numeric" })} · ${Math.round(p.y).toLocaleString()} kcal`} />
          </div>
        </>
      )}

      {adding && <AddFood day={day} meal={adding} onClose={() => setAdding(null)} onAdded={() => { setAdding(null); reload(); }} />}
      {editing && <EditEntry entry={editing} onClose={() => setEditing(null)} onDone={() => { setEditing(null); reload(); }} />}
      {goals && data && <GoalsModal goals={data.goals} onClose={() => setGoals(false)} onSaved={() => { setGoals(false); reload(); }} />}
    </div>
  );
}

function amountText(e: FoodEntryDTO) {
  if (e.unit === "serving") return e.foodId == null && e.amount === 1 ? "" : `${e.amount} ${e.amount === 1 ? "serving" : "servings"}`;
  return `${e.amount} ${e.unit}`;
}

function weekAverage(d: FoodDayDTO) {
  const logged = d.week.filter(w => w.kcal > 0);
  return logged.length ? `avg ${Math.round(logged.reduce((a, w) => a + w.kcal, 0) / logged.length).toLocaleString()} kcal on days you logged` : "";
}

function Summary({ d, onGoals }: { d: FoodDayDTO; onGoals: () => void }) {
  const g = d.goals, t = d.totals;
  const left = g.kcal != null ? g.kcal - t.kcal : null;
  const pct = g.kcal ? Math.min(100, (t.kcal / g.kcal) * 100) : 0;
  const R = 52, C = 2 * Math.PI * R;
  return (
    <div className="card section food-summary">
      <div className="food-ring" aria-label={`${t.kcal} calories eaten${g.kcal ? ` of ${g.kcal}` : ""}`}>
        <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden>
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-3)" strokeWidth="10" />
          {g.kcal != null && <circle cx="60" cy="60" r={R} fill="none" stroke={left != null && left < 0 ? "var(--warning, #f59e0b)" : "url(#foodRing)"} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * C} ${C}`} transform="rotate(-90 60 60)" />}
          <defs><linearGradient id="foodRing" x1="0" x2="1"><stop offset="0" stopColor="var(--accent-cyan)" /><stop offset="1" stopColor="var(--primary-light)" /></linearGradient></defs>
        </svg>
        <div className="food-ring-text">
          <b>{t.kcal.toLocaleString()}</b>
          <span>{g.kcal ? `of ${g.kcal.toLocaleString()} kcal` : "kcal"}</span>
        </div>
      </div>
      <div className="food-macros">
        {left != null && <div className={`food-left ${left < 0 ? "over" : ""}`}>{left >= 0 ? `${left.toLocaleString()} kcal left` : `${(-left).toLocaleString()} kcal over`}</div>}
        <Macro label="Protein" v={t.proteinG} goal={g.proteinG} />
        <Macro label="Carbs" v={t.carbsG} goal={g.carbsG} />
        <Macro label="Fat" v={t.fatG} goal={g.fatG} />
        {g.kcal == null && <button className="btn-ghost btn-sm" onClick={onGoals}>Set a daily goal</button>}
      </div>
    </div>
  );
}

function Macro({ label, v, goal }: { label: string; v: number; goal: number | null }) {
  return (
    <div className="food-macro">
      <div className="food-macro-top"><span>{label}</span><b>{Math.round(v)}{goal ? ` / ${goal}` : ""} g</b></div>
      {goal != null && <span className="bar-track"><i style={{ width: `${Math.min(100, (v / goal) * 100)}%` }} /></span>}
    </div>
  );
}

function EditEntry({ entry, onClose, onDone }: { entry: FoodEntryDTO; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(entry.amount));
  const [meal, setMeal] = useState<Meal>(entry.meal);
  const [err, setErr] = useState("");
  async function save() {
    const n = parseNum(amount);
    if (n == null || n <= 0) return setErr("Enter how much you had");
    try { await api(`/api/food/entries/${entry.id}`, { method: "PATCH", body: { amount: n, meal } }); onDone(); }
    catch (e) { setErr((e as Error).message); }
  }
  async function remove() {
    try { await api(`/api/food/entries/${entry.id}`, { method: "DELETE" }); onDone(); }
    catch (e) { setErr((e as Error).message); }
  }
  return (
    <Modal title={entry.name} onClose={onClose} footer={
      <div className="flex gap-2" style={{ width: "100%" }}>
        <button className="btn-danger" onClick={remove}><Icon name="trash" size={14} /> Remove</button>
        <button className="btn-primary" style={{ flex: 1 }} onClick={save}>Save</button>
      </div>}>
      {err && <p className="form-error">{err}</p>}
      <p className="row-sub" style={{ marginBottom: 12 }}>{Math.round(entry.kcal)} kcal{macroLine(entry) ? ` · ${macroLine(entry)}` : ""}</p>
      <div className="form-group">
        <label className="form-label">Amount ({entry.unit === "serving" ? "servings" : entry.unit})</label>
        <input className="form-input" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <MealPicker meal={meal} setMeal={setMeal} />
    </Modal>
  );
}

function GoalsModal({ goals, onClose, onSaved }: { goals: FoodGoals; onClose: () => void; onSaved: () => void }) {
  const s = (v: number | null) => (v == null ? "" : String(v));
  const [f, setF] = useState({ kcal: s(goals.kcal), proteinG: s(goals.proteinG), carbsG: s(goals.carbsG), fatG: s(goals.fatG) });
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(x => ({ ...x, [k]: e.target.value }));
  const kcal = parseNum(f.kcal);

  /** A common starting split: 30% of calories from protein, 40% carbs, 30% fat. */
  function fromCalories() {
    if (!kcal) return setErr("Enter a calorie goal first");
    setErr("");
    setF(x => ({ ...x, proteinG: String(Math.round((kcal * 0.3) / 4)), carbsG: String(Math.round((kcal * 0.4) / 4)), fatG: String(Math.round((kcal * 0.3) / 9)) }));
  }

  async function save() {
    try {
      await api("/api/food/goals", { method: "PATCH", body: { kcal, proteinG: parseNum(f.proteinG), carbsG: parseNum(f.carbsG), fatG: parseNum(f.fatG) } });
      onSaved();
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <Modal title="Daily goals" onClose={onClose} footer={<button className="btn-primary btn-full" onClick={save}>Save goals</button>}>
      {err && <p className="form-error">{err}</p>}
      <div className="form-group"><label className="form-label">Calories</label><input className="form-input" inputMode="numeric" value={f.kcal} onChange={set("kcal")} placeholder="2200" /></div>
      <div className="form-grid-2" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div className="form-group"><label className="form-label">Protein g</label><input className="form-input" inputMode="numeric" value={f.proteinG} onChange={set("proteinG")} /></div>
        <div className="form-group"><label className="form-label">Carbs g</label><input className="form-input" inputMode="numeric" value={f.carbsG} onChange={set("carbsG")} /></div>
        <div className="form-group"><label className="form-label">Fat g</label><input className="form-input" inputMode="numeric" value={f.fatG} onChange={set("fatG")} /></div>
      </div>
      <button className="btn-ghost btn-sm" onClick={fromCalories}>Fill macros from calories (30% protein, 40% carbs, 30% fat)</button>
      <p className="form-hint" style={{ marginTop: 10 }}>Leave any of these blank to not track it. Every goal is optional.</p>
    </Modal>
  );
}
