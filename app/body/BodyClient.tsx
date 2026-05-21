"use client";

import { useState } from "react";

interface BodyMetric {
  id: number; recorded_at: string; weight_kg: number | null; body_fat_pct: number | null;
  chest_cm: number | null; waist_cm: number | null; hips_cm: number | null;
  arms_cm: number | null; legs_cm: number | null; notes: string | null;
}

export default function BodyClient({ metrics, unit }: { metrics: BodyMetric[]; unit: string }) {
  const [localMetrics, setLocalMetrics] = useState(metrics);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [chest, setChest] = useState("");
  const [waist, setWaist] = useState("");
  const [hips, setHips] = useState("");
  const [arms, setArms] = useState("");
  const [legs, setLegs] = useState("");
  const [notes, setNotes] = useState("");

  const isImperial = unit === "mi";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const weightKg = weight ? (isImperial ? parseFloat(weight) / 2.20462 : parseFloat(weight)) : null;
    try {
      const res = await fetch("/api/body", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recorded_at: date,
          weight_kg: weightKg,
          body_fat_pct: bodyFat ? parseFloat(bodyFat) : null,
          chest_cm: chest ? parseFloat(chest) : null,
          waist_cm: waist ? parseFloat(waist) : null,
          hips_cm: hips ? parseFloat(hips) : null,
          arms_cm: arms ? parseFloat(arms) : null,
          legs_cm: legs ? parseFloat(legs) : null,
          notes,
        }),
      });
      if (res.ok) {
        setShowForm(false);
        window.location.reload();
      } else {
        setError((await res.json()).message || "Failed to save");
      }
    } catch { setError("Network error"); }
    setSaving(false);
  }

  async function deleteMetric(id: number) {
    if (!confirm("Delete this entry?")) return;
    await fetch(`/api/body?id=${id}`, { method: "DELETE" });
    setLocalMetrics((prev) => prev.filter((m) => m.id !== id));
  }

  function displayWeight(kg: number | null) {
    if (kg == null) return "—";
    if (isImperial) return (kg * 2.20462).toFixed(1) + " lbs";
    return kg.toFixed(1) + " kg";
  }

  const latest = localMetrics[0];
  const prev = localMetrics[1];

  const weightTrend = latest?.weight_kg != null && prev?.weight_kg != null
    ? latest.weight_kg - prev.weight_kg : null;

  // Weight chart data (last 20 entries, chronological)
  const chartData = [...localMetrics].reverse().filter((m) => m.weight_kg != null).slice(-20);
  const weights = chartData.map((m) => m.weight_kg as number);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const wRange = maxW - minW || 1;

  return (
    <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div className="section-eyebrow">Tracking</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Body Metrics</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Log Measurement"}
        </button>
      </div>

      {showForm && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border-bright)", borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 28 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Log Measurement</h2>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {error && <p className="form-error">{error}</p>}
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Weight ({isImperial ? "lbs" : "kg"})</label>
                <input className="form-input" type="number" min="0" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="—" />
              </div>
              <div className="form-group">
                <label className="form-label">Body Fat %</label>
                <input className="form-input" type="number" min="0" max="100" step="0.1" value={bodyFat} onChange={(e) => setBodyFat(e.target.value)} placeholder="—" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {[
                { label: "Chest (cm)", val: chest, set: setChest },
                { label: "Waist (cm)", val: waist, set: setWaist },
                { label: "Hips (cm)", val: hips, set: setHips },
                { label: "Arms (cm)", val: arms, set: setArms },
                { label: "Legs (cm)", val: legs, set: setLegs },
              ].map(({ label, val, set }) => (
                <div key={label} className="form-group">
                  <label className="form-label">{label}</label>
                  <input className="form-input" type="number" min="0" step="0.1" value={val} onChange={(e) => set(e.target.value)} placeholder="—" />
                </div>
              ))}
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Morning measurement, post-workout…" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </form>
        </div>
      )}

      {/* Latest stats + trend */}
      {latest && (
        <div className="metrics-grid" style={{ marginBottom: 28 }}>
          <div className="metric-card">
            <div className="metric-card-value">{displayWeight(latest.weight_kg)}</div>
            <div className="metric-card-label">
              Weight
              {weightTrend != null && (
                <span style={{ marginLeft: 6, fontSize: 11, color: weightTrend > 0 ? "#f87171" : "#4ade80" }}>
                  {weightTrend > 0 ? "▲" : "▼"} {Math.abs(weightTrend * (isImperial ? 2.20462 : 1)).toFixed(1)}
                </span>
              )}
            </div>
          </div>
          {latest.body_fat_pct != null && (
            <div className="metric-card">
              <div className="metric-card-value">{latest.body_fat_pct.toFixed(1)}%</div>
              <div className="metric-card-label">Body Fat</div>
            </div>
          )}
          {latest.waist_cm != null && (
            <div className="metric-card">
              <div className="metric-card-value">{latest.waist_cm} cm</div>
              <div className="metric-card-label">Waist</div>
            </div>
          )}
        </div>
      )}

      {/* Weight chart */}
      {chartData.length > 1 && (
        <div className="chart-card" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Weight Trend</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
            {chartData.map((m, i) => {
              const pct = 20 + ((m.weight_kg! - minW) / wRange) * 75;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }} title={displayWeight(m.weight_kg)}>
                  <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                    <div style={{ width: "100%", height: `${pct}%`, background: "var(--accent-cyan)", borderRadius: "2px 2px 0 0", opacity: 0.8 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History table */}
      {localMetrics.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⚖️</div>
          <div className="empty-title">No measurements yet</div>
          <div className="empty-desc">Start tracking your weight and measurements over time</div>
        </div>
      ) : (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>History</h2>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Weight</th>
                  <th>Body Fat</th>
                  <th>Waist</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {localMetrics.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{m.recorded_at.slice(0, 10)}</td>
                    <td style={{ fontWeight: 700 }}>{displayWeight(m.weight_kg)}</td>
                    <td>{m.body_fat_pct != null ? m.body_fat_pct.toFixed(1) + "%" : "—"}</td>
                    <td>{m.waist_cm != null ? m.waist_cm + " cm" : "—"}</td>
                    <td style={{ color: "var(--text-muted)", fontSize: 13 }}>{m.notes ?? "—"}</td>
                    <td>
                      <button onClick={() => deleteMetric(m.id)} style={{ background: "none", border: "none", color: "var(--text-subtle)", cursor: "pointer", fontSize: 14 }}>✕</button>
                    </td>
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
