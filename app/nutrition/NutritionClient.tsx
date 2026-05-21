"use client";

import { useState } from "react";

interface NutritionLog {
  id: number; logged_date: string; meal_type: string; food_name: string;
  calories: number | null; protein_g: number | null; carbs_g: number | null;
  fat_g: number | null; amount_g: number | null; notes: string | null;
}

interface Goals { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null }

interface DaySummary { logged_date: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; entries: number }

const MEAL_TYPES = ["breakfast", "lunch", "dinner", "snack"];

function MacroBar({ value, target, color }: { value: number; target: number | null; color: string }) {
  if (!target) return null;
  const pct = Math.min(100, Math.round((value / target) * 100));
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
        <span>{value.toFixed(0)}g</span><span>{target}g ({pct}%)</span>
      </div>
      <div style={{ background: "var(--surface-2)", borderRadius: 3, height: 6 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
      </div>
    </div>
  );
}

export default function NutritionClient({ todayLogs, goals, recentDays, today }: {
  todayLogs: NutritionLog[]; goals: Goals | null; recentDays: DaySummary[]; today: string;
}) {
  const [logs, setLogs] = useState(todayLogs);
  const [showForm, setShowForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [mealType, setMealType] = useState("breakfast");
  const [foodName, setFoodName] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [goalCal, setGoalCal] = useState(String(goals?.calories ?? ""));
  const [goalProtein, setGoalProtein] = useState(String(goals?.protein_g ?? ""));
  const [goalCarbs, setGoalCarbs] = useState(String(goals?.carbs_g ?? ""));
  const [goalFat, setGoalFat] = useState(String(goals?.fat_g ?? ""));

  const totalCal = logs.reduce((s, l) => s + (l.calories ?? 0), 0);
  const totalProtein = logs.reduce((s, l) => s + (l.protein_g ?? 0), 0);
  const totalCarbs = logs.reduce((s, l) => s + (l.carbs_g ?? 0), 0);
  const totalFat = logs.reduce((s, l) => s + (l.fat_g ?? 0), 0);

  async function handleAddFood(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logged_date: today, meal_type: mealType, food_name: foodName,
          calories: calories ? parseFloat(calories) : null,
          protein_g: protein ? parseFloat(protein) : null,
          carbs_g: carbs ? parseFloat(carbs) : null,
          fat_g: fat ? parseFloat(fat) : null,
          amount_g: amount ? parseFloat(amount) : null,
          notes,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        setFoodName(""); setCalories(""); setProtein(""); setCarbs(""); setFat(""); setAmount(""); setNotes("");
        window.location.reload();
      } else {
        setError((await res.json()).message || "Failed to save");
      }
    } catch { setError("Network error"); }
    setSaving(false);
  }

  async function handleSaveGoals(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/nutrition", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calories: goalCal ? parseFloat(goalCal) : null,
          protein_g: goalProtein ? parseFloat(goalProtein) : null,
          carbs_g: goalCarbs ? parseFloat(goalCarbs) : null,
          fat_g: goalFat ? parseFloat(goalFat) : null,
        }),
      });
      setShowGoalForm(false);
      window.location.reload();
    } catch { }
    setSaving(false);
  }

  async function deleteLog(id: number) {
    await fetch(`/api/nutrition?id=${id}`, { method: "DELETE" });
    setLogs((prev) => prev.filter((l) => l.id !== id));
  }

  const byMeal = MEAL_TYPES.map((m) => ({ type: m, entries: logs.filter((l) => l.meal_type === m) }));

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div className="section-eyebrow">Nutrition</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Food Log</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowGoalForm((v) => !v)}>Macro Goals</button>
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "+ Add Food"}
          </button>
        </div>
      </div>

      {/* Today's totals */}
      <div className="metrics-grid" style={{ marginBottom: 24 }}>
        <div className="metric-card">
          <div className="metric-card-value">{Math.round(totalCal)}</div>
          <div className="metric-card-label">Calories</div>
          {goals?.calories && (
            <div style={{ marginTop: 6 }}>
              <div style={{ background: "var(--surface-2)", borderRadius: 3, height: 4 }}>
                <div style={{ height: "100%", width: `${Math.min(100, (totalCal / goals.calories) * 100)}%`, background: "var(--primary-light)", borderRadius: 3 }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{goals.calories} goal</div>
            </div>
          )}
        </div>
        <div className="metric-card">
          <div className="metric-card-value">{totalProtein.toFixed(0)}g</div>
          <div className="metric-card-label">Protein</div>
          <MacroBar value={totalProtein} target={goals?.protein_g ?? null} color="#a855f7" />
        </div>
        <div className="metric-card">
          <div className="metric-card-value">{totalCarbs.toFixed(0)}g</div>
          <div className="metric-card-label">Carbs</div>
          <MacroBar value={totalCarbs} target={goals?.carbs_g ?? null} color="#22d3ee" />
        </div>
        <div className="metric-card">
          <div className="metric-card-value">{totalFat.toFixed(0)}g</div>
          <div className="metric-card-label">Fat</div>
          <MacroBar value={totalFat} target={goals?.fat_g ?? null} color="#f59e0b" />
        </div>
      </div>

      {/* Macro goal form */}
      {showGoalForm && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border-bright)", borderRadius: "var(--radius-lg)", padding: 20, marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Daily Macro Goals</h2>
          <form onSubmit={handleSaveGoals} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[
              { label: "Calories (kcal)", val: goalCal, set: setGoalCal },
              { label: "Protein (g)", val: goalProtein, set: setGoalProtein },
              { label: "Carbs (g)", val: goalCarbs, set: setGoalCarbs },
              { label: "Fat (g)", val: goalFat, set: setGoalFat },
            ].map(({ label, val, set }) => (
              <div key={label} className="form-group">
                <label className="form-label">{label}</label>
                <input className="form-input" type="number" min="0" value={val} onChange={(e) => set(e.target.value)} placeholder="—" />
              </div>
            ))}
            <div style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>Save Goals</button>
            </div>
          </form>
        </div>
      )}

      {/* Add food form */}
      {showForm && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border-bright)", borderRadius: "var(--radius-lg)", padding: 20, marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Add Food</h2>
          <form onSubmit={handleAddFood} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {error && <p className="form-error">{error}</p>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Meal</label>
                <select className="form-input" value={mealType} onChange={(e) => setMealType(e.target.value)}>
                  {MEAL_TYPES.map((m) => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Food Name</label>
                <input className="form-input" value={foodName} onChange={(e) => setFoodName(e.target.value)} placeholder="Chicken breast, Rice…" required />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
              {[
                { label: "Calories", val: calories, set: setCalories, step: "1" },
                { label: "Protein (g)", val: protein, set: setProtein, step: "0.1" },
                { label: "Carbs (g)", val: carbs, set: setCarbs, step: "0.1" },
                { label: "Fat (g)", val: fat, set: setFat, step: "0.1" },
              ].map(({ label, val, set, step }) => (
                <div key={label} className="form-group">
                  <label className="form-label" style={{ fontSize: 11 }}>{label}</label>
                  <input className="form-input" type="number" min="0" step={step} value={val} onChange={(e) => set(e.target.value)} placeholder="—" />
                </div>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">Amount (g, optional)</label>
              <input className="form-input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100" />
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? "Saving…" : "Add"}</button>
          </form>
        </div>
      )}

      {/* Today's log by meal */}
      {logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🥗</div>
          <div className="empty-title">Nothing logged today</div>
          <div className="empty-desc">Track your meals to hit your macro goals</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {byMeal.filter((m) => m.entries.length > 0).map(({ type, entries }) => (
            <div key={type}>
              <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: "capitalize", color: "var(--text-muted)", marginBottom: 8 }}>{type}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {entries.map((e) => (
                  <div key={e.id} className="nutrition-entry">
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{e.food_name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        {e.calories != null ? `${Math.round(e.calories)} kcal` : ""}
                        {e.protein_g != null ? ` · P: ${e.protein_g.toFixed(0)}g` : ""}
                        {e.carbs_g != null ? ` · C: ${e.carbs_g.toFixed(0)}g` : ""}
                        {e.fat_g != null ? ` · F: ${e.fat_g.toFixed(0)}g` : ""}
                        {e.amount_g != null ? ` · ${e.amount_g}g` : ""}
                      </div>
                    </div>
                    <button onClick={() => deleteLog(e.id)} style={{ background: "none", border: "none", color: "var(--text-subtle)", cursor: "pointer", fontSize: 16, padding: "0 4px" }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 7-day history */}
      {recentDays.length > 0 && (
        <div style={{ marginTop: 36 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>7-Day History</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fat</th></tr>
              </thead>
              <tbody>
                {recentDays.map((d) => (
                  <tr key={d.logged_date}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{d.logged_date}</td>
                    <td style={{ fontWeight: 700 }}>{Math.round(d.calories)} kcal</td>
                    <td>{d.protein_g.toFixed(0)}g</td>
                    <td>{d.carbs_g.toFixed(0)}g</td>
                    <td>{d.fat_g.toFixed(0)}g</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
