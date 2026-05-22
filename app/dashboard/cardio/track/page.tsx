"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface GpsPoint {
  lat: number;
  lon: number;
  ts: number;
  alt?: number;
}

function haversineKm(a: GpsPoint, b: GpsPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const sin1 = Math.sin(dLat / 2);
  const sin2 = Math.sin(dLon / 2);
  const c = sin1 * sin1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sin2 * sin2;
  return R * 2 * Math.atan2(Math.sqrt(c), Math.sqrt(1 - c));
}

const CARDIO_TYPES = ["Running", "Cycling", "Walking", "Hiking", "Other"];

export default function GpsTrackPage() {
  const router = useRouter();
  const [activityType, setActivityType] = useState("Running");
  const [status, setStatus] = useState<"idle" | "tracking" | "paused" | "done">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [distanceKm, setDistanceKm] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [points, setPoints] = useState<GpsPoint[]>([]);
  const [saving, setSaving] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedElapsedRef = useRef(0);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, []);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setGpsError("Geolocation is not supported by your browser.");
      return;
    }
    setGpsError(null);
    setStatus("tracking");
    startTimeRef.current = Date.now() - pausedElapsedRef.current * 1000;

    elapsedIntervalRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const pt: GpsPoint = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          ts: pos.timestamp,
          alt: pos.coords.altitude ?? undefined,
        };
        setPoints(prev => {
          const next = [...prev, pt];
          if (next.length >= 2) {
            let total = 0;
            for (let i = 1; i < next.length; i++) total += haversineKm(next[i - 1], next[i]);
            setDistanceKm(total);
          }
          return next;
        });
      },
      err => {
        setGpsError(`GPS error: ${err.message}`);
      },
      { enableHighAccuracy: true, maximumAge: 0 }
    );
  };

  const pauseTracking = () => {
    setStatus("paused");
    pausedElapsedRef.current = elapsed;
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (elapsedIntervalRef.current) { clearInterval(elapsedIntervalRef.current); elapsedIntervalRef.current = null; }
  };

  const stopTracking = () => {
    pauseTracking();
    setStatus("done");
  };

  const saveActivity = async () => {
    setSaving(true);
    const res = await fetch("/api/cardio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: activityType,
        durationSeconds: elapsed,
        distanceKm: distanceKm > 0 ? Math.round(distanceKm * 100) / 100 : undefined,
        gpsData: points.length > 0 ? points : undefined,
      }),
    });
    if (res.ok) router.push("/dashboard/cardio");
    else { alert("Failed to save"); setSaving(false); }
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const paceMinPerKm = distanceKm > 0 && elapsed > 0
    ? elapsed / 60 / distanceKm
    : null;
  const formatPace = (p: number) => `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")}/km`;

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <button onClick={() => router.push("/dashboard/cardio")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem", padding: 0 }}>
          ← Cardio
        </button>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginTop: 4 }}>GPS Tracking</h1>
      </div>

      {status === "idle" && (
        <div className="card" style={{ marginBottom: 20 }}>
          <label className="form-label">Activity Type</label>
          <select className="form-input" value={activityType} onChange={e => setActivityType(e.target.value)} style={{ marginBottom: 16 }}>
            {CARDIO_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
          {gpsError && <div style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: 12 }}>{gpsError}</div>}
          <button className="btn-success btn-lg" onClick={startTracking} style={{ width: "100%" }}>
            Start Tracking
          </button>
        </div>
      )}

      {(status === "tracking" || status === "paused" || status === "done") && (
        <>
          <div className="card" style={{ marginBottom: 20, textAlign: "center" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: "2rem", fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--accent-cyan)" }}>
                  {formatDuration(elapsed)}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Time</div>
              </div>
              <div>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--primary-light)" }}>
                  {distanceKm.toFixed(2)}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase" }}>km</div>
              </div>
              <div>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--xp-color)" }}>
                  {paceMinPerKm ? formatPace(paceMinPerKm) : "—"}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Pace</div>
              </div>
            </div>

            {status === "tracking" && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.82rem", color: "#4ade80" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", animation: "pulse 1.5s infinite" }} />
                Tracking · {points.length} GPS points
              </div>
            )}
            {status === "paused" && (
              <div style={{ fontSize: "0.82rem", color: "var(--xp-color)" }}>Paused</div>
            )}
            {status === "done" && (
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Activity stopped</div>
            )}
          </div>

          {gpsError && (
            <div style={{ color: "#f87171", fontSize: "0.85rem", marginBottom: 12, padding: "8px 12px", background: "rgba(248,113,113,0.1)", borderRadius: 8 }}>
              {gpsError}
            </div>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {status === "tracking" && (
              <>
                <button className="btn-secondary btn-lg" onClick={pauseTracking} style={{ width: "100%" }}>
                  Pause
                </button>
                <button className="btn-danger btn-lg" onClick={stopTracking} style={{ width: "100%" }}>
                  Stop & Save
                </button>
              </>
            )}
            {status === "paused" && (
              <>
                <button className="btn-primary btn-lg" onClick={startTracking} style={{ width: "100%" }}>
                  Resume
                </button>
                <button className="btn-danger" onClick={stopTracking} style={{ width: "100%" }}>
                  Stop & Save
                </button>
              </>
            )}
            {status === "done" && (
              <button className="btn-success btn-lg" onClick={saveActivity} disabled={saving} style={{ width: "100%" }}>
                {saving ? "Saving..." : `Save ${activityType}`}
              </button>
            )}
            {status !== "tracking" && (
              <button className="btn-secondary" onClick={() => router.push("/dashboard/cardio")} style={{ width: "100%" }}>
                Discard
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
