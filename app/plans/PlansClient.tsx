"use client";

import { useState } from "react";

interface Plan {
  id: number; name: string; description: string | null; goal_type: string | null;
  goal_date: string | null; weeks_duration: number | null; start_date: string | null;
  is_active: number; created_at: string; totalWorkouts: number; completedWorkouts: number;
}

const GOAL_TYPES = [
  { value: "5k", label: "5K Race" },
  { value: "10k", label: "10K Race" },
  { value: "half_marathon", label: "Half Marathon" },
  { value: "marathon", label: "Marathon" },
  { value: "general_fitness", label: "General Fitness" },
  { value: "weight_loss", label: "Weight Loss" },
  { value: "strength", label: "Strength Building" },
];

export default function PlansClient({ plans }: { plans: Plan[] }) {
  const [localPlans, setLocalPlans] = useState(plans);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goalType, setGoalType] = useState("general_fitness");
  const [goalDate, setGoalDate] = useState("");
  const [weeksDuration, setWeeksDuration] = useState("8");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, goal_type: goalType, goal_date: goalDate || null, weeks_duration: parseInt(weeksDuration), start_date: startDate }),
      });
      if (res.ok) {
        setShowForm(false);
        setName(""); setDescription(""); setGoalDate("");
        window.location.reload();
      } else {
        setError((await res.json()).message || "Failed to create plan");
      }
    } catch { setError("Network error"); }
    setSaving(false);
  }

  async function activatePlan(id: number) {
    await fetch(`/api/plans/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: true }),
    });
    setLocalPlans((prev) => prev.map((p) => ({ ...p, is_active: p.id === id ? 1 : 0 })));
  }

  async function deletePlan(id: number) {
    if (!confirm("Delete this training plan?")) return;
    await fetch(`/api/plans/${id}`, { method: "DELETE" });
    setLocalPlans((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div className="section-eyebrow">Training</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Training Plans</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New Plan"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border-bright)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Create Training Plan</h2>
          <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {error && <p className="form-error">{error}</p>}
            <div className="form-group">
              <label className="form-label">Plan Name</label>
              <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Half Marathon 12-Week Plan…" required />
            </div>
            <div className="form-group">
              <label className="form-label">Description (optional)</label>
              <textarea className="form-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this plan is about…" style={{ minHeight: 60 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Goal Type</label>
                <select className="form-input" value={goalType} onChange={(e) => setGoalType(e.target.value)}>
                  {GOAL_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Duration (weeks)</label>
                <input className="form-input" type="number" min="1" max="52" value={weeksDuration} onChange={(e) => setWeeksDuration(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Goal Date (optional)</label>
                <input className="form-input" type="date" value={goalDate} onChange={(e) => setGoalDate(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Creating…" : "Create Plan"}</button>
          </form>
        </div>
      )}

      {localPlans.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-title">No training plans yet</div>
          <div className="empty-desc">Create a structured training plan to stay on track toward your race or fitness goal</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {localPlans.map((p) => {
            const pct = p.totalWorkouts > 0 ? Math.round((p.completedWorkouts / p.totalWorkouts) * 100) : 0;
            const goalMeta = GOAL_TYPES.find((t) => t.value === p.goal_type);
            return (
              <div key={p.id} className="plan-card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>{p.name}</div>
                      {p.is_active === 1 && <span className="badge badge-green">Active</span>}
                    </div>
                    {goalMeta && <div style={{ fontSize: 12, color: "var(--accent-cyan)", marginBottom: 6 }}>{goalMeta.label}</div>}
                    {p.description && <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>{p.description}</div>}
                    <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>
                      {p.weeks_duration} weeks
                      {p.start_date ? ` · Starts ${new Date(p.start_date).toLocaleDateString()}` : ""}
                      {p.goal_date ? ` · Goal: ${new Date(p.goal_date).toLocaleDateString()}` : ""}
                    </div>
                    {p.totalWorkouts > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                          <span>{p.completedWorkouts} / {p.totalWorkouts} workouts</span>
                          <span>{pct}%</span>
                        </div>
                        <div style={{ background: "var(--surface-2)", borderRadius: 3, height: 6 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "var(--primary-light)", borderRadius: 3 }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginLeft: 12 }}>
                    {p.is_active !== 1 && (
                      <button onClick={() => activatePlan(p.id)} className="btn btn-secondary btn-sm">Activate</button>
                    )}
                    <button onClick={() => deletePlan(p.id)} className="btn btn-danger btn-sm">Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
