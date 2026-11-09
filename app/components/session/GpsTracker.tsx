"use client";

import { useEffect, useRef, useState } from "react";
import RouteSvg from "./RouteSvg";
import { useMe } from "@/app/components/MeContext";
import { haversine, showsSpeed, type RoutePoint } from "@/lib/geo";
import { fmtDistance, fmtDuration, fmtPace, M_PER_MI } from "@/lib/units";

export type GpsResult = { durationS: number; distanceM: number; elevationM: number; route: RoutePoint[] };

type Status = "waiting" | "running" | "paused" | "autopaused" | "error";

/** Everything needed to pick a track back up after the page reloads or the phone kills the tab. */
type Saved = {
  v: 1; savedAt: number; startMs: number; pausedMs: number; pauseStart: number | null; manualPause: boolean;
  route: RoutePoint[]; dist: number; elev: number; lastAlt: number | null; splits: number[]; lastSplitT: number;
};

const KEY = (blockId: number) => `astrofit-gps-${blockId}`;
/** A track older than this is a forgotten one, not a run in progress. */
const STALE_MS = 6 * 3600_000;
const AUTO_PAUSE_AFTER_MS = 12_000;
const CURRENT_PACE_WINDOW_MS = 30_000;

export function savedTrack(blockId: number): Saved | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY(blockId)) ?? "null") as Saved | null;
    if (!s || s.v !== 1 || Date.now() - s.savedAt > STALE_MS) return null;
    return s;
  } catch { return null; }
}
export function clearSavedTrack(blockId: number) {
  try { localStorage.removeItem(KEY(blockId)); } catch { /* storage can be unavailable */ }
}

const pref = (k: string, def: boolean) => { try { const v = localStorage.getItem(k); return v == null ? def : v === "1"; } catch { return def; } };
const setPref = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? "1" : "0"); } catch { /* ignore */ } };

function speak(text: string) {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    s.speak(u);
  } catch { /* no voice on this device */ }
}

/** "8 minutes 32 seconds", for reading aloud. */
function spoken(sec: number) {
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  const h = Math.floor(m / 60);
  const parts = [h && `${h} hour${h > 1 ? "s" : ""}`, m % 60 && `${m % 60} minute${m % 60 > 1 ? "s" : ""}`, s && `${s} second${s > 1 ? "s" : ""}`].filter(Boolean);
  return parts.join(" ") || "0 seconds";
}

/** Full-screen live GPS tracking for a cardio block. */
export default function GpsTracker({ blockId, title, icon, onFinish, onCancel }: {
  blockId: number; title: string; icon: string; onFinish: (r: GpsResult) => void; onCancel: () => void;
}) {
  const { me } = useMe();
  const du = me.distanceUnit;
  const unitM = du === "mi" ? M_PER_MI : 1000;
  const speedMode = showsSpeed(icon);
  // Faster than this between two fixes is a GPS jump, not you.
  const maxSpeed = speedMode ? 30 : 12;

  const [status, setStatus] = useState<Status>("waiting");
  const [error, setError] = useState("");
  const [, setTick] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [voice, setVoice] = useState(() => pref("astrofit-gps-voice", true));
  const [autoPause, setAutoPause] = useState(() => pref("astrofit-gps-autopause", true));
  const [recovered, setRecovered] = useState(false);

  const route = useRef<RoutePoint[]>([]);
  const dist = useRef(0);
  const elev = useRef(0);
  const lastAlt = useRef<number | null>(null);
  const startMs = useRef<number | null>(null);
  const pausedMs = useRef(0);
  const pauseStart = useRef<number | null>(null);
  const splits = useRef<number[]>([]);
  const lastSplitT = useRef(0);
  const lastMove = useRef(0);
  const statusRef = useRef(status);
  statusRef.current = status;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;
  const autoRef = useRef(autoPause);
  autoRef.current = autoPause;

  const elapsed = () => {
    if (!startMs.current) return 0;
    const now = pauseStart.current ?? Date.now();
    return Math.max(0, (now - startMs.current - pausedMs.current) / 1000);
  };

  function save() {
    if (!startMs.current) return;
    const s: Saved = {
      v: 1, savedAt: Date.now(), startMs: startMs.current, pausedMs: pausedMs.current, pauseStart: pauseStart.current,
      manualPause: statusRef.current === "paused", route: route.current, dist: dist.current, elev: elev.current,
      lastAlt: lastAlt.current, splits: splits.current, lastSplitT: lastSplitT.current,
    };
    try { localStorage.setItem(KEY(blockId), JSON.stringify(s)); } catch { /* storage full: the track still finishes normally */ }
  }

  function pauseAt(ms: number, auto: boolean) {
    pauseStart.current = ms;
    setStatus(auto ? "autopaused" : "paused");
  }
  function resume() {
    if (pauseStart.current) pausedMs.current += Date.now() - pauseStart.current;
    pauseStart.current = null;
    lastMove.current = Date.now();
    setStatus("running");
  }

  useEffect(() => {
    // Pick up a track that was running when the page went away.
    const s = savedTrack(blockId);
    if (s) {
      startMs.current = s.startMs; pausedMs.current = s.pausedMs; pauseStart.current = s.pauseStart;
      route.current = s.route; dist.current = s.dist; elev.current = s.elev; lastAlt.current = s.lastAlt;
      splits.current = s.splits; lastSplitT.current = s.lastSplitT; lastMove.current = Date.now();
      // Set the ref now too: a GPS fix can arrive before the next render, and "waiting" would restart the clock.
      statusRef.current = s.manualPause ? "paused" : "running";
      setStatus(statusRef.current);
      if (!s.manualPause && s.pauseStart) resume();
      setRecovered(true);
    }

    if (!("geolocation" in navigator)) { setStatus("error"); setError("This browser has no GPS access."); return; }

    // The screen staying on is what keeps tracking alive: phones suspend web pages when locked.
    let wake: { release: () => Promise<void> } | null = null;
    const lock = () => (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<typeof wake> } }).wakeLock?.request("screen").then(w => { wake = w; }).catch(() => {});
    lock();
    const onVisible = () => { if (document.visibilityState === "visible") lock(); };
    document.addEventListener("visibilitychange", onVisible);

    const id = navigator.geolocation.watchPosition(pos => {
      const { latitude, longitude, accuracy: acc, altitude } = pos.coords;
      setAccuracy(acc);
      if (acc > 35) return; // too noisy to use
      const now = Date.now();
      if (statusRef.current === "waiting") {
        startMs.current = now;
        lastSplitT.current = 0;
        lastMove.current = now;
        setStatus("running");
        statusRef.current = "running";
      }
      if (statusRef.current === "paused") return;
      const p: RoutePoint = [latitude, longitude, now];
      const prev = route.current[route.current.length - 1];
      if (prev) {
        const d = haversine([prev[0], prev[1]], [p[0], p[1]]);
        if (d < Math.max(3, acc / 3)) return; // standing still, or jitter
        if (d / Math.max(1, (now - prev[2]) / 1000) > maxSpeed) return; // a jump, not movement
        if (statusRef.current === "autopaused") resume();
        lastMove.current = now;
        const before = dist.current;
        dist.current += d;
        if (Math.floor(dist.current / unitM) > Math.floor(before / unitM)) {
          const t = elapsed();
          const split = t - lastSplitT.current;
          splits.current.push(split);
          lastSplitT.current = t;
          try { navigator.vibrate?.(300); } catch { /* ignore */ }
          if (voiceRef.current) {
            const n = Math.floor(dist.current / unitM);
            const unitWord = du === "mi" ? (n === 1 ? "mile" : "miles") : (n === 1 ? "kilometer" : "kilometers");
            const avg = t / (dist.current / unitM);
            speak(speedMode
              ? `${n} ${unitWord}. Time ${spoken(t)}. Average speed ${Math.round((3600 / avg) * 10) / 10} ${du === "mi" ? "miles" : "kilometers"} per hour.`
              : `${n} ${unitWord}. Time ${spoken(t)}. Last split ${spoken(split)}. Average pace ${spoken(avg)}.`);
          }
        }
      } else {
        lastMove.current = now;
      }
      if (altitude != null) {
        if (lastAlt.current != null && altitude - lastAlt.current > 1) elev.current += altitude - lastAlt.current;
        if (lastAlt.current == null || Math.abs(altitude - lastAlt.current) > 1) lastAlt.current = altitude;
      }
      route.current.push(p);
    }, err => {
      if (route.current.length) return; // a hiccup mid-run; keep going with what we have
      setStatus("error");
      setError(err.code === 1 ? "Location permission denied. Allow location for this site and try again." : "Couldn't get a GPS fix.");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });

    const t = setInterval(() => {
      setTick(x => x + 1);
      // Stopped at a light or a gate: stop the clock from the moment you stopped moving.
      if (autoRef.current && statusRef.current === "running" && Date.now() - lastMove.current > AUTO_PAUSE_AFTER_MS) {
        pauseAt(lastMove.current, true);
      }
    }, 1000);
    const saver = setInterval(save, 5000);
    const warn = (e: BeforeUnloadEvent) => { save(); e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    window.addEventListener("pagehide", save);
    return () => {
      navigator.geolocation.clearWatch(id);
      clearInterval(t);
      clearInterval(saver);
      window.removeEventListener("beforeunload", warn);
      window.removeEventListener("pagehide", save);
      document.removeEventListener("visibilitychange", onVisible);
      wake?.release().catch(() => {});
      try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function togglePause() {
    if (status === "running") pauseAt(Date.now(), false);
    else resume();
  }

  function finish() {
    clearSavedTrack(blockId);
    onFinish({ durationS: Math.round(elapsed()), distanceM: Math.round(dist.current), elevationM: Math.round(elev.current), route: route.current });
  }

  function cancel() {
    if (route.current.length >= 2 && !confirm("Discard this GPS track?")) return;
    clearSavedTrack(blockId);
    onCancel();
  }

  const secs = elapsed();
  const avgPace = dist.current > 20 ? secs / (dist.current / unitM) : null;
  // Current pace: the last 30 seconds of the track, so it reacts when you speed up or slow down.
  const pts = route.current;
  let curPace: number | null = null;
  if (status === "running" && pts.length > 1) {
    const end = pts[pts.length - 1];
    let k = pts.length - 1, d = 0;
    while (k > 0 && end[2] - pts[k - 1][2] <= CURRENT_PACE_WINDOW_MS) { d += haversine([pts[k - 1][0], pts[k - 1][1]], [pts[k][0], pts[k][1]]); k--; }
    const dt = (end[2] - pts[k][2]) / 1000;
    if (d > 15 && dt > 5) curPace = dt / (d / unitM);
  }
  const speed = (pace: number | null) => (pace ? `${(Math.round((3600 / pace) * 10) / 10).toFixed(1)}` : "–");
  const elevShown = Math.round(du === "mi" ? elev.current * 3.28084 : elev.current);
  const curSplit = secs - lastSplitT.current;
  const live = status === "running" || status === "paused" || status === "autopaused";

  return (
    <div className="gps-screen">
      <div className="gps-top">
        <span className="section-label" style={{ margin: 0 }}>{title}</span>
        <span className={`gps-acc ${accuracy != null && accuracy <= 15 ? "good" : ""}`}>
          {status === "waiting" ? "Finding GPS…" : accuracy != null ? `±${Math.round(accuracy)} m` : ""}
        </span>
      </div>
      {recovered && <p className="gps-note">Picked up your track where it left off.</p>}
      {status === "error" ? <p className="form-error" style={{ padding: 20 }}>{error}</p> : (
        <>
          <div className={`gps-big ${status !== "running" && status !== "waiting" ? "paused" : ""}`}>{fmtDuration(secs)}</div>
          {status === "autopaused" && <div className="gps-state">Auto-paused. It starts again when you move.</div>}
          {status === "paused" && <div className="gps-state">Paused</div>}
          <div className="gps-stats">
            <div><div className="stat-card-label">Distance</div><div className="gps-val">{fmtDistance(dist.current, du)} <small>{du}</small></div></div>
            {speedMode ? (
              <>
                <div><div className="stat-card-label">Speed</div><div className="gps-val">{speed(curPace)} <small>{du === "mi" ? "mph" : "km/h"}</small></div></div>
                <div><div className="stat-card-label">Avg speed</div><div className="gps-val">{speed(avgPace)} <small>{du === "mi" ? "mph" : "km/h"}</small></div></div>
              </>
            ) : (
              <>
                <div><div className="stat-card-label">Pace</div><div className="gps-val">{fmtPace(curPace, du)}</div></div>
                <div><div className="stat-card-label">Avg pace</div><div className="gps-val">{fmtPace(avgPace, du)}</div></div>
              </>
            )}
            <div><div className="stat-card-label">Split {splits.current.length + 1}</div><div className="gps-val">{fmtDuration(curSplit)}</div></div>
            <div><div className="stat-card-label">Climb</div><div className="gps-val">{elevShown} <small>{du === "mi" ? "ft" : "m"}</small></div></div>
          </div>
          {route.current.length > 1 && <RouteSvg route={route.current} height={170} />}
          {splits.current.length > 0 && (
            <div className="gps-splits">
              {splits.current.map((s, i) => <div key={i}><span>{du} {i + 1}</span><b>{speedMode ? `${speed(s)} ${du === "mi" ? "mph" : "km/h"}` : fmtDuration(s)}</b></div>)}
            </div>
          )}
          <div className="gps-toggles">
            <label className="check-row"><input type="checkbox" checked={voice} onChange={e => { setVoice(e.target.checked); setPref("astrofit-gps-voice", e.target.checked); if (e.target.checked) speak("Voice updates on"); }} /> Read out each {du === "mi" ? "mile" : "kilometer"}</label>
            <label className="check-row"><input type="checkbox" checked={autoPause} onChange={e => { setAutoPause(e.target.checked); setPref("astrofit-gps-autopause", e.target.checked); }} /> Auto-pause when I stop</label>
          </div>
          <p className="gps-note">Keep this screen open. Phones stop tracking web apps once they&apos;re locked or in the background.</p>
        </>
      )}
      <div className="gps-actions">
        <button className="btn-ghost" onClick={cancel}>Cancel</button>
        {live && <button className="btn-secondary btn-lg" onClick={togglePause}>{status === "running" ? "Pause" : "Resume"}</button>}
        {live && <button className="btn-primary btn-lg" onClick={finish}>Finish</button>}
      </div>
    </div>
  );
}
