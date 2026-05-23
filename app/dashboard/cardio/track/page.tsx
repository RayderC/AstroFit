"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUnits } from "@/app/context/UnitsContext";

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
  const { distanceUnit } = useUnits();
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

  const displayDistance = distanceUnit === "mi" ? distanceKm * 0.621371 : distanceKm;

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
      err => { setGpsError(`GPS error: ${err.message}`); },
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
    const savedDistance = distanceUnit === "mi" ? displayDistance : distanceKm;
    const res = await fetch("/api/cardio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: activityType,
        durationSeconds: elapsed,
        distanceKm: savedDistance > 0 ? Math.round(savedDistance * 100) / 100 : undefined,
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

  const paceMinPerUnit = displayDistance > 0 && elapsed > 0 ? elapsed / 60 / displayDistance : null;
  const formatPace = (p: number) => `${Math.floor(p)}:${String(Math.round((p % 1) * 60)).padStart(2, "0")}/${distanceUnit}`;

  return (
    <div className="gps-tracker">
      <div style={{ marginBottom: 20 }}>
        <button className="back-link" onClick={() => router.push("/dashboard/cardio")}>
          ← Cardio
        </button>
        <h1 className="dash-title" style={{ marginTop: 8 }}>GPS Tracking</h1>
      </div>

      {status === "idle" && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Activity Type</label>
            <select className="form-select" value={activityType} onChange={e => setActivityType(e.target.value)}>
              {CARDIO_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          {gpsError && <div className="gps-error">{gpsError}</div>}
          <button className="btn btn-success btn-lg btn-full" onClick={startTracking}>
            Start Tracking
          </button>
        </div>
      )}

      {(status === "tracking" || status === "paused" || status === "done") && (
        <>
          <div className="card" style={{ marginBottom: 20, textAlign: "center" }}>
            <div className="gps-stats">
              <div>
                <div className="gps-stat-value text-cyan">{formatDuration(elapsed)}</div>
                <div className="gps-stat-label">Time</div>
              </div>
              <div>
                <div className="gps-stat-value text-purple">{displayDistance.toFixed(2)}</div>
                <div className="gps-stat-label">{distanceUnit}</div>
              </div>
              <div>
                <div className="gps-stat-value text-gold">{paceMinPerUnit ? formatPace(paceMinPerUnit) : "—"}</div>
                <div className="gps-stat-label">Pace</div>
              </div>
            </div>

            {status === "tracking" && (
              <div className="gps-status">
                <div className="gps-status-dot" style={{ background: "var(--success)" }} />
                <span className="text-success">Tracking · {points.length} GPS points</span>
              </div>
            )}
            {status === "paused" && (
              <div className="gps-status">
                <span className="text-gold">Paused</span>
              </div>
            )}
            {status === "done" && (
              <div className="gps-status">
                <span className="text-muted">Activity stopped</span>
              </div>
            )}
          </div>

          {gpsError && <div className="gps-error">{gpsError}</div>}

          <div className="gps-actions">
            {status === "tracking" && (
              <>
                <button className="btn btn-secondary btn-lg btn-full" onClick={pauseTracking}>Pause</button>
                <button className="btn btn-danger btn-lg btn-full" onClick={stopTracking}>Stop & Save</button>
              </>
            )}
            {status === "paused" && (
              <>
                <button className="btn btn-primary btn-lg btn-full" onClick={startTracking}>Resume</button>
                <button className="btn btn-danger btn-full" onClick={stopTracking}>Stop & Save</button>
              </>
            )}
            {status === "done" && (
              <button className="btn btn-success btn-lg btn-full" onClick={saveActivity} disabled={saving}>
                {saving ? "Saving..." : `Save ${activityType}`}
              </button>
            )}
            {status !== "tracking" && (
              <button className="btn btn-secondary btn-full" onClick={() => router.push("/dashboard/cardio")}>
                Discard
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
