"use client";

import { useEffect, useRef, useState } from "react";
import RouteSvg, { haversine } from "./RouteSvg";
import { useMe } from "@/app/components/MeContext";
import { fmtDistance, fmtDuration, fmtPace, M_PER_MI } from "@/lib/units";

type Pt = [number, number, number];
export type GpsResult = { durationS: number; distanceM: number; elevationM: number; route: Pt[] };

/** Full-screen live GPS tracking for a cardio block. */
export default function GpsTracker({ title, onFinish, onCancel }: { title: string; onFinish: (r: GpsResult) => void; onCancel: () => void }) {
  const { me } = useMe();
  const unitM = me.distanceUnit === "mi" ? M_PER_MI : 1000;
  const [status, setStatus] = useState<"waiting" | "running" | "paused" | "error">("waiting");
  const [error, setError] = useState("");
  const [, setTick] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const route = useRef<Pt[]>([]);
  const dist = useRef(0);
  const elev = useRef(0);
  const lastAlt = useRef<number | null>(null);
  const startMs = useRef<number | null>(null);
  const pausedMs = useRef(0);
  const pauseStart = useRef<number | null>(null);
  const splits = useRef<number[]>([]);
  const lastSplitT = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;

  const elapsed = () => {
    if (!startMs.current) return 0;
    const now = pauseStart.current ?? Date.now();
    return Math.max(0, (now - startMs.current - pausedMs.current) / 1000);
  };

  useEffect(() => {
    if (!("geolocation" in navigator)) { setStatus("error"); setError("This browser has no GPS access."); return; }
    let wake: { release: () => Promise<void> } | null = null;
    (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof wake> } }).wakeLock?.request("screen").then(w => { wake = w; }).catch(() => {});

    const id = navigator.geolocation.watchPosition(pos => {
      const { latitude, longitude, accuracy: acc, altitude } = pos.coords;
      setAccuracy(acc);
      if (acc > 35) return; // too noisy
      if (statusRef.current === "waiting") {
        startMs.current = Date.now();
        lastSplitT.current = 0;
        setStatus("running");
      }
      if (statusRef.current === "paused") return;
      const p: Pt = [latitude, longitude, Date.now()];
      const prev = route.current[route.current.length - 1];
      if (prev) {
        const d = haversine([prev[0], prev[1]], [p[0], p[1]]);
        if (d < Math.max(3, acc / 3)) return; // jitter
        const before = dist.current;
        dist.current += d;
        if (Math.floor(dist.current / unitM) > Math.floor(before / unitM)) {
          const t = elapsed();
          splits.current.push(t - lastSplitT.current);
          lastSplitT.current = t;
          try { navigator.vibrate?.(300); } catch { /* ignore */ }
        }
      }
      if (altitude != null) {
        if (lastAlt.current != null && altitude - lastAlt.current > 1) elev.current += altitude - lastAlt.current;
        if (lastAlt.current == null || Math.abs(altitude - lastAlt.current) > 1) lastAlt.current = altitude;
      }
      route.current.push(p);
    }, err => {
      setStatus("error");
      setError(err.code === 1 ? "Location permission denied. Allow location for this site and try again." : "Couldn't get a GPS fix.");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });

    const t = setInterval(() => setTick(x => x + 1), 1000);
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => {
      navigator.geolocation.clearWatch(id);
      clearInterval(t);
      window.removeEventListener("beforeunload", warn);
      wake?.release().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePause() {
    if (status === "running") { pauseStart.current = Date.now(); setStatus("paused"); }
    else if (status === "paused" && pauseStart.current) {
      pausedMs.current += Date.now() - pauseStart.current;
      pauseStart.current = null;
      setStatus("running");
    }
  }

  function finish() {
    onFinish({ durationS: Math.round(elapsed()), distanceM: Math.round(dist.current), elevationM: Math.round(elev.current), route: route.current });
  }

  const secs = elapsed();
  const pace = dist.current > 20 ? secs / (dist.current / unitM) : null;
  const curSplit = secs - lastSplitT.current;

  return (
    <div className="gps-screen">
      <div className="gps-top">
        <span className="section-label" style={{ margin: 0 }}>{title}</span>
        <span className={`gps-acc ${accuracy != null && accuracy <= 15 ? "good" : ""}`}>
          {status === "waiting" ? "Finding GPS…" : accuracy != null ? `±${Math.round(accuracy)} m` : ""}
        </span>
      </div>
      {status === "error" ? <p className="form-error" style={{ padding: 20 }}>{error}</p> : (
        <>
          <div className="gps-big">{fmtDuration(secs)}</div>
          <div className="gps-stats">
            <div><div className="stat-card-label">Distance</div><div className="gps-val">{fmtDistance(dist.current, me.distanceUnit)} <small>{me.distanceUnit}</small></div></div>
            <div><div className="stat-card-label">Avg pace</div><div className="gps-val">{fmtPace(pace, me.distanceUnit)}</div></div>
            <div><div className="stat-card-label">Split {splits.current.length + 1}</div><div className="gps-val">{fmtDuration(curSplit)}</div></div>
          </div>
          {route.current.length > 1 && <RouteSvg route={route.current} height={180} />}
          {splits.current.length > 0 && (
            <div className="gps-splits">
              {splits.current.map((s, i) => <div key={i}><span>{me.distanceUnit} {i + 1}</span><b>{fmtDuration(s)}</b></div>)}
            </div>
          )}
        </>
      )}
      <div className="gps-actions">
        <button className="btn-ghost" onClick={() => { if (route.current.length < 2 || confirm("Discard this GPS track?")) onCancel(); }}>Cancel</button>
        {status !== "error" && status !== "waiting" && <button className="btn-secondary btn-lg" onClick={togglePause}>{status === "paused" ? "Resume" : "Pause"}</button>}
        {status !== "error" && status !== "waiting" && <button className="btn-primary btn-lg" onClick={finish}>Finish</button>}
      </div>
    </div>
  );
}
