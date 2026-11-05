"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/app/components/Icon";
import { fmtDuration } from "@/lib/units";
import { enablePush, pushState, refreshPushSubscription, showLocalNotification, type PushState } from "@/lib/pushClient";

type State = { endsAt: number; total: number; label: string; pausedLeft: number | null } | null;

// Once the page is visible near the end, the on-screen timer and beep take over from the notification.
const HAND_BACK_MS = 1500;
// Coming back long after rest ended shouldn't set off a beep.
const LATE_BEEP_MS = 5000;

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

// keepalive lets the request finish even if the phone is locked straight after a set is ticked off.
function send(method: "POST" | "DELETE", body?: unknown) {
  return fetch("/api/rest-timer", {
    method,
    keepalive: true,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => undefined);
}

export function useRestTimer(sessionId?: number) {
  const [state, setState] = useState<State>(null);
  const [, tick] = useState(0);
  const firedRef = useRef(false);
  const handedBackRef = useRef(false);
  const [push, setPush] = useState<PushState>("loading");

  useEffect(() => {
    pushState().then(s => {
      setPush(s);
      if (s === "on") refreshPushSubscription();
    });
  }, []);

  useEffect(() => {
    if (!state || state.pausedLeft != null) return;
    const t = setInterval(() => {
      tick(x => x + 1);
      const now = Date.now();
      if (push === "on" && !handedBackRef.current && !document.hidden && state.endsAt - now < HAND_BACK_MS) {
        handedBackRef.current = true;
        send("DELETE");
      }
      if (now >= state.endsAt && !firedRef.current) {
        firedRef.current = true;
        if (now - state.endsAt < LATE_BEEP_MS) beep();
        if (document.hidden) {
          showLocalNotification("Rest is over", state.label ? `Next set: ${state.label}` : "Time for your next set.", sessionId ? `/session/${sessionId}` : "/");
        }
        setTimeout(() => setState(s => (s && s.endsAt === state.endsAt ? null : s)), 1500);
      }
    }, 250);
    return () => clearInterval(t);
  }, [state, push, sessionId]);

  // Keeps the server's copy of the timer matching this one. Waits a moment so tapping +15 a few
  // times sends one request instead of several.
  const endsAt = state && state.pausedLeft == null ? state.endsAt : null;
  const label = state?.label ?? "";
  const hadTimer = useRef(false);
  useEffect(() => {
    if (push !== "on") return;
    if (endsAt == null) {
      if (hadTimer.current) send("DELETE");
      hadTimer.current = false;
      return;
    }
    hadTimer.current = true;
    handedBackRef.current = false;
    const t = setTimeout(() => {
      const seconds = Math.ceil((endsAt - Date.now()) / 1000);
      if (seconds >= 1) send("POST", { seconds, label, sessionId });
    }, 300);
    return () => clearTimeout(t);
  }, [endsAt, label, sessionId, push]);

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
    push,
    setPush,
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
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  if (!t.active) return null;
  const pct = t.total ? (t.left / t.total) * 100 : 0;

  // Offered right when it's useful. A refusal is final until the browser's settings change, so don't keep asking.
  const canAsk = t.push === "off" && !dismissed && "Notification" in window && Notification.permission !== "denied";

  async function notify() {
    setBusy(true);
    try {
      await enablePush();
      t.setPush("on");
    } catch {
      setDismissed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rest-timer-bar">
      <div className="rest-timer-bar-progress"><div className="rest-timer-bar-progress-fill" style={{ width: `${pct}%` }} /></div>
      <div className="rest-timer-bar-content">
        <div className="rest-timer-bar-label">Rest<span className="rest-timer-sub">{t.label}</span></div>
        <div className={`rest-timer-bar-time ${t.left === 0 ? "done" : ""}`}>{fmtDuration(t.left)}</div>
        {canAsk && <button className="rest-timer-bar-notify" onClick={notify} disabled={busy} aria-label="Notify me when rest ends"><Icon name="bell" size={14} /> Notify</button>}
        <button className="rest-timer-bar-adj" onClick={() => t.adjust(-15)}>−15</button>
        <button className="rest-timer-bar-adj" onClick={() => t.adjust(15)}>+15</button>
        <button className="rest-timer-bar-pause" onClick={t.togglePause} aria-label="Pause rest">{t.paused ? "▶" : "❚❚"}</button>
        <button className="rest-timer-bar-skip" onClick={t.stop}>Skip</button>
      </div>
    </div>
  );
}
