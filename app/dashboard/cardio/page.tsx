"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

const CARDIO_TYPES = ["Running", "Cycling", "Walking", "Swimming", "Rowing", "Elliptical", "Stair Climber", "Jump Rope", "HIIT", "Other"];

interface CardioActivity {
  id: number;
  type: string;
  distance_km: number | null;
  duration_seconds: number;
  pace_per_km: number | null;
  notes: string | null;
  xp_earned: number;
  created_at: string;
}

export default function CardioPage() {
  const [activities, setActivities] = useState<CardioActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "Running",
    hours: "",
    minutes: "",
    seconds: "",
    distance: "",
    notes: "",
  });

  useEffect(() => {
    fetch("/api/cardio").then(r => r.json()).then(d => { setActivities(d); setLoading(false); });
  }, []);

  const submitCardio = async () => {
    const h = parseInt(form.hours) || 0;
    const m = parseInt(form.minutes) || 0;
    const s = parseInt(form.seconds) || 0;
    const durationSeconds = h * 3600 + m * 60 + s;
    if (durationSeconds === 0) { alert("Duration required"); return; }

    setSaving(true);
    const res = await fetch("/api/cardio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.type,
        durationSeconds,
        distanceKm: form.distance ? Number(form.distance) : undefined,
        notes: form.notes || undefined,
      }),
    });
    if (res.ok) {
      const fresh = await fetch("/api/cardio").then(r => r.json());
      setActivities(fresh);
      setForm({ type: "Running", hours: "", minutes: "", seconds: "", distance: "", notes: "" });
      setShowForm(false);
    }
    setSaving(false);
  };

  const deleteActivity = async (id: number) => {
    if (!confirm("Delete this activity?")) return;
    await fetch(`/api/cardio/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    setActivities(a => a.filter(x => x.id !== id));
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const formatPace = (pacePerKm: number) => {
    const m = Math.floor(pacePerKm);
    const s = Math.round((pacePerKm - m) * 60);
    return `${m}:${String(s).padStart(2, "0")}/km`;
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Cardio</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/dashboard/cardio/track" className="btn-secondary btn-sm">GPS Track</Link>
          <button className="btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            + Log Activity
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16, fontWeight: 600 }}>Log Cardio Activity</h3>
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <label className="form-label">Activity Type</label>
              <select className="form-input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {CARDIO_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Duration</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div style={{ position: "relative" }}>
                  <input className="form-input" type="number" placeholder="0" min="0" value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: "0.75rem", color: "var(--text-muted)" }}>h</span>
                </div>
                <div style={{ position: "relative" }}>
                  <input className="form-input" type="number" placeholder="0" min="0" max="59" value={form.minutes} onChange={e => setForm(p => ({ ...p, minutes: e.target.value }))} />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: "0.75rem", color: "var(--text-muted)" }}>m</span>
                </div>
                <div style={{ position: "relative" }}>
                  <input className="form-input" type="number" placeholder="0" min="0" max="59" value={form.seconds} onChange={e => setForm(p => ({ ...p, seconds: e.target.value }))} />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: "0.75rem", color: "var(--text-muted)" }}>s</span>
                </div>
              </div>
            </div>
            <div>
              <label className="form-label">Distance (km) — optional</label>
              <input className="form-input" type="number" step="0.01" placeholder="0.00" min="0" value={form.distance} onChange={e => setForm(p => ({ ...p, distance: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Notes (optional)</label>
              <input className="form-input" placeholder="How did it feel?" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={submitCardio} disabled={saving}>{saving ? "Saving..." : "Save Activity"}</button>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏃</div>
          <div>No cardio logged yet.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activities.map(a => (
            <div key={a.id} className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>{a.type}</span>
                    {a.distance_km && (
                      <span style={{ fontSize: "0.85rem", color: "var(--accent-cyan)", fontWeight: 600 }}>
                        {a.distance_km.toFixed(2)} km
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>{formatDuration(a.duration_seconds)}</span>
                    {a.pace_per_km && <span>{formatPace(a.pace_per_km)}</span>}
                    {a.notes && <span style={{ fontStyle: "italic" }}>{a.notes}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{formatDate(a.created_at)}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--xp-color)" }}>+{a.xp_earned} XP</div>
                  <button
                    onClick={() => deleteActivity(a.id)}
                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.75rem", padding: 0 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
