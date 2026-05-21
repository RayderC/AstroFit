"use client";

import { useState } from "react";

interface Goal {
  id: number; type: string; title: string; target_value: number; unit: string | null;
  period_start: string | null; period_end: string | null; is_recurring: number;
  notes: string | null; current: number; pct: number;
}

const GOAL_TYPES = [
  { value: "weekly_distance", label: "Weekly Distance", unit: "km", placeholder: "40" },
  { value: "weekly_workouts", label: "Weekly Workouts", unit: "sessions", placeholder: "4" },
  { value: "monthly_distance", label: "Monthly Distance", unit: "km", placeholder: "150" },
  { value: "custom", label: "Custom Goal", unit: "", placeholder: "100" },
];

export default function GoalsClient({ goals, unit }: { goals: Goal[]; unit: string }) {
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [goalType, setGoalType] = useState("weekly_distance");
  const [title, setTitle] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [notes, setNotes] = useState("");
  const [localGoals, setLocalGoals] = useState(goals);

  const selectedType = GOAL_TYPES.find((t) => t.value === goalType) ?? GOAL_TYPES[0];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: goalType, title: title || selectedType.label, target_value: parseFloat(targetValue), unit: selectedType.unit, notes }),
      });
      if (res.ok) {
        setShowForm(false);
        setTitle(""); setTargetValue(""); setNotes("");
        window.location.reload();
      } else {
        setError((await res.json()).message || "Failed to create goal");
      }
    } catch { setError("Network error"); }
    setSaving(false);
  }

  async function deleteGoal(id: number) {
    if (!confirm("Remove this goal?")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    setLocalGoals((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div className="section-eyebrow">Motivation</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Goals</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New Goal"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border-bright)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Create Goal</h2>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {error && <p className="form-error">{error}</p>}
            <div className="form-group">
              <label className="form-label">Goal Type</label>
              <select className="form-input" value={goalType} onChange={(e) => setGoalType(e.target.value)}>
                {GOAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Title (optional)</label>
              <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={selectedType.label} />
            </div>
            <div className="form-group">
              <label className="form-label">Target ({selectedType.unit || "value"})</label>
              <input className="form-input" type="number" min="0" step="0.1" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder={selectedType.placeholder} required />
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why this goal?" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Creating…" : "Create Goal"}</button>
          </form>
        </div>
      )}

      {localGoals.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <div className="empty-title">No goals set</div>
          <div className="empty-desc">Set a weekly distance or workout target to stay motivated</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {localGoals.map((g) => (
            <div key={g.id} className="goal-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{g.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {g.current.toFixed(1)} / {g.target_value} {g.unit}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: g.pct >= 100 ? "var(--accent-cyan)" : "var(--primary-light)" }}>{g.pct}%</span>
                  <button onClick={() => deleteGoal(g.id)} style={{ background: "none", border: "none", color: "var(--text-subtle)", cursor: "pointer", fontSize: 16 }}>✕</button>
                </div>
              </div>
              <div style={{ background: "var(--surface-2)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${g.pct}%`, background: g.pct >= 100 ? "var(--accent-cyan)" : "var(--primary-light)", borderRadius: 4, transition: "width 0.5s ease" }} />
              </div>
              {g.notes && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10 }}>{g.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
