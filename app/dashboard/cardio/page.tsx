"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useUnits } from "@/app/context/UnitsContext";

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
  const { distanceUnit } = useUnits();
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

  const formatPace = (pacePerUnit: number) => {
    const m = Math.floor(pacePerUnit);
    const s = Math.round((pacePerUnit - m) * 60);
    return `${m}:${String(s).padStart(2, "0")}/${distanceUnit}`;
  };

  const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="content-narrow">
      <div className="dash-header">
        <h1 className="dash-title">Cardio</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/cardio/track" className="btn btn-secondary btn-sm">GPS Track</Link>
          <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
            + Log Activity
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <span className="card-title">Log Cardio Activity</span>
          </div>
          <div className="inline-form">
            <div className="form-group">
              <label className="form-label">Activity Type</label>
              <select className="form-select" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                {CARDIO_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Duration</label>
              <div className="form-grid-3">
                <input className="form-input" type="number" placeholder="0h" min="0" value={form.hours} onChange={e => setForm(p => ({ ...p, hours: e.target.value }))} />
                <input className="form-input" type="number" placeholder="0m" min="0" max="59" value={form.minutes} onChange={e => setForm(p => ({ ...p, minutes: e.target.value }))} />
                <input className="form-input" type="number" placeholder="0s" min="0" max="59" value={form.seconds} onChange={e => setForm(p => ({ ...p, seconds: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Distance ({distanceUnit}) — optional</label>
              <input className="form-input" type="number" step="0.01" placeholder="0.00" min="0" value={form.distance} onChange={e => setForm(p => ({ ...p, distance: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Notes (optional)</label>
              <input className="form-input" placeholder="How did it feel?" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary" onClick={submitCardio} disabled={saving}>{saving ? "Saving..." : "Save Activity"}</button>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {activities.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏃</div>
          <div className="empty-state-title">No cardio logged yet</div>
          <div className="empty-state-desc">Log your first activity or use GPS tracking above.</div>
        </div>
      ) : (
        <div className="flex-col gap-2">
          {activities.map(a => (
            <div key={a.id} className="card">
              <div className="cardio-row" style={{ padding: 0 }}>
                <div className="cardio-row-left">
                  <div className="flex items-center">
                    <span className="cardio-row-type">{a.type}</span>
                    {a.distance_km && (
                      <span className="cardio-row-distance">{a.distance_km.toFixed(2)} {distanceUnit}</span>
                    )}
                  </div>
                  <div className="cardio-row-meta">
                    <span>{formatDuration(a.duration_seconds)}</span>
                    {a.pace_per_km && <span>{formatPace(a.pace_per_km)}</span>}
                    {a.notes && <span className="cardio-row-notes">{a.notes}</span>}
                  </div>
                </div>
                <div className="cardio-row-right">
                  <div className="history-row-date">{formatDate(a.created_at)}</div>
                  <div className="xp-tag">+{a.xp_earned} XP</div>
                  <button className="btn btn-ghost btn-sm" onClick={() => deleteActivity(a.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
