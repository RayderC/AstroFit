"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fmtDuration } from "@/lib/units";

type State = { endsAt: number; total: number; label: string; pausedLeft: number | null } | null;

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25, 0.5].forEach(t => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch { /* audio not allowed */ }
  try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignore */ }
}

export function useRestTimer() {
  const [state, setState] = useState<State>(null);
  const [, tick] = useState(0);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!state || state.pausedLeft != null) return;
    const t = setInterval(() => {
      tick(x => x + 1);
      if (Date.now() >= state.endsAt && !firedRef.current) {
        firedRef.current = true;
        beep();
        setTimeout(() => setState(s => (s && s.endsAt === state.endsAt ? null : s)), 1500);
      }
    }, 250);
    return () => clearInterval(t);
  }, [state]);

  const start = useCallback((seconds: number, label: string) => {
    if (seconds <= 0) return setState(null);
    firedRef.current = false;
    setState({ endsAt: Date.now() + seconds * 1000, total: seconds, label, pausedLeft: null });
  }, []);

  const left = state ? (state.pausedLeft ?? Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000))) : 0;

  return {
    active: !!state,
    left,
    total: state?.total ?? 0,
    label: state?.label ?? "",
    paused: state?.pausedLeft != null,
    start,
    stop: () => setState(null),
    adjust: (d: number) => setState(s => s && (s.pausedLeft != null
      ? { ...s, pausedLeft: Math.max(0, s.pausedLeft + d), total: Math.max(1, s.total + d) }
      : { ...s, endsAt: s.endsAt + d * 1000, total: Math.max(1, s.total + d) })),
    togglePause: () => setState(s => s && (s.pausedLeft != null
      ? { ...s, endsAt: Date.now() + s.pausedLeft * 1000, pausedLeft: null }
      : { ...s, pausedLeft: Math.max(0, Math.ceil((s.endsAt - Date.now()) / 1000)) })),
  };
}

export default function RestTimerBar({ t }: { t: ReturnType<typeof useRestTimer> }) {
  if (!t.active) return null;
  const pct = t.total ? (t.left / t.total) * 100 : 0;
  return (
    <div className="rest-timer-bar">
      <div className="rest-timer-bar-progress"><div className="rest-timer-bar-progress-fill" style={{ width: `${pct}%` }} /></div>
      <div className="rest-timer-bar-content">
        <div className="rest-timer-bar-label">Rest<span className="rest-timer-sub">{t.label}</span></div>
        <div className={`rest-timer-bar-time ${t.left === 0 ? "done" : ""}`}>{fmtDuration(t.left)}</div>
        <button className="rest-timer-bar-adj" onClick={() => t.adjust(-15)}>−15</button>
        <button className="rest-timer-bar-adj" onClick={() => t.adjust(15)}>+15</button>
        <button className="rest-timer-bar-pause" onClick={t.togglePause} aria-label="Pause rest">{t.paused ? "▶" : "❚❚"}</button>
        <button className="rest-timer-bar-skip" onClick={t.stop}>Skip</button>
      </div>
    </div>
  );
}
