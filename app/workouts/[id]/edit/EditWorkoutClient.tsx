"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Workout {
  id: number; type: string; title: string; notes: string; started_at: string;
  duration_seconds: number; distance_meters: number | null;
  avg_pace_seconds_per_km: number | null; avg_heart_rate: number | null;
  elevation_gain_meters: number | null; calories: number | null;
}

export default function EditWorkoutClient({ workout }: { workout: Workout }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const initDate = workout.started_at.slice(0, 16);
  const initH = String(Math.floor(workout.duration_seconds / 3600));
  const initM = String(Math.floor((workout.duration_seconds % 3600) / 60));
  const initS = String(workout.duration_seconds % 60);

  const [title, setTitle] = useState(workout.title || "");
  const [date, setDate] = useState(initDate);
  const [durationH, setDurationH] = useState(initH);
  const [durationM, setDurationM] = useState(initM);
  const [durationS, setDurationS] = useState(initS);
  const [distKm, setDistKm] = useState(workout.distance_meters != null ? (workout.distance_meters / 1000).toFixed(2) : "");
  const [heartRate, setHeartRate] = useState(workout.avg_heart_rate != null ? String(workout.avg_heart_rate) : "");
  const [elevation, setElevation] = useState(workout.elevation_gain_meters != null ? String(Math.round(workout.elevation_gain_meters)) : "");
  const [calories, setCalories] = useState(workout.calories != null ? String(workout.calories) : "");
  const [notes, setNotes] = useState(workout.notes || "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const durationSeconds =
      parseInt(durationH || "0") * 3600 +
      parseInt(durationM || "0") * 60 +
      parseInt(durationS || "0");

    const body: Record<string, unknown> = {
      title: title || (workout.type === "run" ? "Run" : "Strength Session"),
      started_at: new Date(date).toISOString(),
      duration_seconds: durationSeconds,
      notes,
      calories: calories ? parseInt(calories) : null,
    };

    if (workout.type === "run") {
      const distMeters = distKm ? parseFloat(distKm) * 1000 : null;
      body.distance_meters = distMeters;
      body.avg_pace_seconds_per_km = distMeters && durationSeconds > 0 ? durationSeconds / (distMeters / 1000) : null;
      body.avg_heart_rate = heartRate ? parseInt(heartRate) : null;
      body.elevation_gain_meters = elevation ? parseFloat(elevation) : null;
    }

    try {
      const res = await fetch(`/api/workouts/${workout.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        router.push(`/workouts/${workout.id}`);
      } else {
        setError((await res.json()).message || "Failed to save");
      }
    } catch {
      setError("Network error");
    }
    setSaving(false);
  }

  const isRun = workout.type === "run";

  return (
    <div className="log-workout-page">
      <Link href={`/workouts/${workout.id}`} className="back-link">← Workout</Link>
      <div className="section-eyebrow">{isRun ? "Running" : "Strength"}</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 24 }}>Edit Workout</h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {error && <p className="form-error">{error}</p>}

        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isRun ? "Morning Run…" : "Push Day…"} />
        </div>

        <div className="form-group">
          <label className="form-label">Date & Time</label>
          <input className="form-input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isRun ? "1fr 1fr" : "1fr 1fr", gap: 12 }}>
          {isRun && (
            <div className="form-group">
              <label className="form-label">Distance (km)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={distKm} onChange={(e) => setDistKm(e.target.value)} placeholder="5.00" />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Duration</label>
            <div style={{ display: "flex", gap: 4 }}>
              <input className="form-input" type="number" min="0" max="23" value={durationH} onChange={(e) => setDurationH(e.target.value)} placeholder="h" style={{ width: 60 }} />
              <input className="form-input" type="number" min="0" max="59" value={durationM} onChange={(e) => setDurationM(e.target.value)} placeholder="m" required />
              <input className="form-input" type="number" min="0" max="59" value={durationS} onChange={(e) => setDurationS(e.target.value)} placeholder="s" style={{ width: 60 }} />
            </div>
          </div>
        </div>

        {isRun && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Avg HR (bpm)</label>
              <input className="form-input" type="number" min="40" max="230" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} placeholder="—" />
            </div>
            <div className="form-group">
              <label className="form-label">Elevation (m)</label>
              <input className="form-input" type="number" min="0" value={elevation} onChange={(e) => setElevation(e.target.value)} placeholder="—" />
            </div>
            <div className="form-group">
              <label className="form-label">Calories</label>
              <input className="form-input" type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="—" />
            </div>
          </div>
        )}

        {!isRun && (
          <div className="form-group">
            <label className="form-label">Calories</label>
            <input className="form-input" type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="—" />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ minHeight: 80 }} />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving} style={{ flex: 1 }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <Link href={`/workouts/${workout.id}`} className="btn btn-secondary btn-lg">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
