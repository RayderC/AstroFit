"use client";

import Link from "next/link";
import Navigation from "../../../components/Navigation";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

type EntryMode = "manual" | "gps" | "gpx";

export default function LogRunPage() {
  const router = useRouter();
  const [mode, setMode] = useState<EntryMode>("manual");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Manual form
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [distKm, setDistKm] = useState("");
  const [durationH, setDurationH] = useState("0");
  const [durationM, setDurationM] = useState("");
  const [durationS, setDurationS] = useState("0");
  const [notes, setNotes] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [elevation, setElevation] = useState("");
  const [calories, setCalories] = useState("");

  // GPX import
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [gpxParsed, setGpxParsed] = useState<{ distKm: number; durationMin: number; elevGain: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Live GPS
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsSeconds, setGpsSeconds] = useState(0);
  const [gpsPoints, setGpsPoints] = useState<{ lat: number; lon: number; ele?: number; time: string }[]>([]);
  const [gpsDist, setGpsDist] = useState(0);
  const gpsWatchRef = useRef<number | null>(null);
  const gpsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (gpsWatchRef.current != null) navigator.geolocation.clearWatch(gpsWatchRef.current);
      if (gpsIntervalRef.current != null) clearInterval(gpsIntervalRef.current);
    };
  }, []);

  function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
    const R = 6371000;
    const φ1 = a.lat * Math.PI / 180, φ2 = b.lat * Math.PI / 180;
    const Δφ = (b.lat - a.lat) * Math.PI / 180, Δλ = (b.lon - a.lon) * Math.PI / 180;
    const x = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function startGps() {
    if (!navigator.geolocation) { setError("Geolocation not supported"); return; }
    setGpsActive(true);
    setGpsSeconds(0);
    setGpsPoints([]);
    setGpsDist(0);

    gpsIntervalRef.current = setInterval(() => setGpsSeconds((s) => s + 1), 1000);

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const pt = { lat: pos.coords.latitude, lon: pos.coords.longitude, ele: pos.coords.altitude ?? undefined, time: new Date().toISOString() };
        setGpsPoints((pts) => {
          const newPts = [...pts, pt];
          if (newPts.length > 1) {
            const d = haversine(newPts[newPts.length - 2], pt);
            setGpsDist((old) => old + d);
          }
          return newPts;
        });
      },
      (err) => setError(`GPS error: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function stopGps() {
    if (gpsWatchRef.current != null) navigator.geolocation.clearWatch(gpsWatchRef.current);
    if (gpsIntervalRef.current != null) clearInterval(gpsIntervalRef.current);
    setGpsActive(false);
    const totalMin = Math.floor(gpsSeconds / 60);
    setDistKm((gpsDist / 1000).toFixed(2));
    setDurationM(String(totalMin));
    setDurationS(String(gpsSeconds % 60));
  }

  async function handleGpxFile(f: File) {
    setGpxFile(f);
    const text = await f.text();
    const { parseGpx } = await import("@/lib/gpx");
    const data = parseGpx(text);
    setGpxParsed({ distKm: data.distanceMeters / 1000, durationMin: data.durationSeconds / 60, elevGain: data.elevationGainMeters });
    setDistKm((data.distanceMeters / 1000).toFixed(2));
    setDurationM(String(Math.floor(data.durationSeconds / 60)));
    setDurationS(String(data.durationSeconds % 60));
    setElevation(String(Math.round(data.elevationGainMeters)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");

    const durationSeconds =
      parseInt(durationH || "0") * 3600 +
      parseInt(durationM || "0") * 60 +
      parseInt(durationS || "0");

    const distMeters = parseFloat(distKm) * 1000;
    const paceSecPerKm = distMeters > 0 && durationSeconds > 0 ? durationSeconds / (distMeters / 1000) : null;

    let gpxText: string | null = null;
    if (mode === "gpx" && gpxFile) gpxText = await gpxFile.text();
    if (mode === "gps" && gpsPoints.length > 1) {
      gpxText = buildGpx(gpsPoints, title || "Run");
    }

    const body = {
      type: "run",
      title: title || "Run",
      started_at: new Date(date).toISOString(),
      duration_seconds: durationSeconds,
      distance_meters: distMeters || null,
      avg_pace_seconds_per_km: paceSecPerKm,
      avg_heart_rate: heartRate ? parseInt(heartRate) : null,
      elevation_gain_meters: elevation ? parseFloat(elevation) : null,
      calories: calories ? parseInt(calories) : null,
      notes,
      source: mode === "gps" ? "gps_live" : mode === "gpx" ? "gpx_import" : "manual",
      gpx_data: gpxText,
    };

    try {
      const res = await fetch("/api/workouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        const data = await res.json();
        router.push(`/workouts/${data.id}`);
      } else {
        setError((await res.json()).message || "Failed to save");
      }
    } catch { setError("Network error"); }
    setSaving(false);
  }

  function buildGpx(points: { lat: number; lon: number; ele?: number; time: string }[], name: string): string {
    const trkpts = points.map((p) =>
      `<trkpt lat="${p.lat}" lon="${p.lon}">${p.ele != null ? `<ele>${p.ele}</ele>` : ""}<time>${p.time}</time></trkpt>`
    ).join("\n");
    return `<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${name}</name><trkseg>${trkpts}</trkseg></trk></gpx>`;
  }

  const formatGpsTime = (s: number) => `${Math.floor(s / 3600).toString().padStart(2, "0")}:${Math.floor((s % 3600) / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div>
      <Navigation />
      <div className="log-workout-page">
        <Link href="/workouts/log" className="back-link">← Log Workout</Link>
        <div className="section-eyebrow">Running</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 24 }}>Log a Run</h1>

        {/* Entry mode tabs */}
        <div className="log-type-tabs" style={{ marginBottom: 28 }}>
          {(["manual", "gps", "gpx"] as const).map((m) => (
            <button key={m} className={`log-type-tab${mode === m ? " active" : ""}`} onClick={() => setMode(m)} type="button">
              {m === "manual" ? "✏️ Manual" : m === "gps" ? "📍 Live GPS" : "📁 Import GPX"}
            </button>
          ))}
        </div>

        {/* Live GPS panel */}
        {mode === "gps" && !gpsActive && gpsPoints.length === 0 && (
          <div className="gps-recording-panel" style={{ marginBottom: 24 }}>
            <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>Start recording your run with your device GPS</p>
            <button className="btn btn-primary btn-lg" onClick={startGps} type="button">Start GPS Recording</button>
          </div>
        )}

        {mode === "gps" && gpsActive && (
          <div className="gps-recording-panel" style={{ marginBottom: 24 }}>
            <div><span className="gps-status-dot" />Recording</div>
            <div className="gps-live-distance">{(gpsDist / 1000).toFixed(2)} km</div>
            <div className="gps-live-stats">
              <span>⏱ {formatGpsTime(gpsSeconds)}</span>
              <span>📍 {gpsPoints.length} points</span>
            </div>
            <button className="btn btn-danger" onClick={stopGps} style={{ marginTop: 16 }} type="button">Stop & Save Data</button>
          </div>
        )}

        {/* GPX import */}
        {mode === "gpx" && (
          <div style={{ marginBottom: 24 }}>
            <div
              style={{ border: "2px dashed var(--border-bright)", borderRadius: "var(--radius)", padding: 32, textAlign: "center", cursor: "pointer" }}
              onClick={() => fileRef.current?.click()}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
              <div style={{ fontSize: 14, color: "var(--text-muted)" }}>{gpxFile ? gpxFile.name : "Click to upload a GPX file"}</div>
              {gpxParsed && (
                <div style={{ marginTop: 12, fontSize: 13, color: "var(--accent-cyan)" }}>
                  {gpxParsed.distKm.toFixed(2)} km · {Math.floor(gpxParsed.durationMin)}min · +{Math.round(gpxParsed.elevGain)}m
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".gpx" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) handleGpxFile(e.target.files[0]); }} />
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {error && <p className="form-error">{error}</p>}

          <div className="form-group">
            <label className="form-label">Title (optional)</label>
            <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Morning Run, Tempo Run…" />
          </div>

          <div className="form-group">
            <label className="form-label">Date & Time</label>
            <input className="form-input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Distance (km)</label>
              <input className="form-input" type="number" min="0" step="0.01" value={distKm} onChange={(e) => setDistKm(e.target.value)} placeholder="5.00" />
            </div>
            <div className="form-group">
              <label className="form-label">Duration</label>
              <div style={{ display: "flex", gap: 4 }}>
                <input className="form-input" type="number" min="0" max="23" value={durationH} onChange={(e) => setDurationH(e.target.value)} placeholder="h" style={{ width: 60 }} />
                <input className="form-input" type="number" min="0" max="59" value={durationM} onChange={(e) => setDurationM(e.target.value)} placeholder="m" required />
                <input className="form-input" type="number" min="0" max="59" value={durationS} onChange={(e) => setDurationS(e.target.value)} placeholder="s" style={{ width: 60 }} />
              </div>
            </div>
          </div>

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

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel? Any observations…" style={{ minHeight: 80 }} />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? "Saving…" : "Save Run"}
          </button>
        </form>
      </div>
    </div>
  );
}
