"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/app/components/Icon";
import Modal from "@/app/components/Modal";
import MuscleHeatmap from "@/app/components/MuscleHeatmap";
import SessionRow from "@/app/components/SessionRow";
import ActivityPicker from "@/app/components/ActivityPicker";
import { useMe } from "@/app/components/MeContext";
import { api, useApi } from "@/lib/client";
import { fmtDistance, fmtDuration, fmtWeight, kgTo, parseDuration, toM } from "@/lib/units";
import type { RoutineDTO, SessionSummary, Suggestion } from "@/lib/types";

type Today = {
  week: SessionSummary[];
  recent: SessionSummary[];
  ready: (Suggestion & { exerciseId: number; name: string })[];
  program: { id: number; name: string; goal: string; schedule: { weekday: number; routineId: number; name: string; hasCardio: boolean; hasLift: boolean }[] } | null;
  todayRoutine: RoutineDTO | null;
  muscles: Record<string, number>;
  body: { date: string; weight_kg: number }[];
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekStartIso() {
  const d = new Date();
  const back = (d.getDay() + 6) % 7; // Monday start
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - back);
  return d.toISOString();
}

export default function TodayPage() {
  const { me } = useMe();
  const router = useRouter();
  const weekday = new Date().getDay();
  const url = useMemo(() => `/api/today?weekStart=${encodeURIComponent(weekStartIso())}&weekday=${weekday}`, [weekday]);
  const { data, reload } = useApi<Today>(url);
  const [cardio, setCardio] = useState<number | null | "pick">(null);
  const [err, setErr] = useState("");

  async function start(body: object) {
    setErr("");
    try {
      const s = await api<{ id: number }>("/api/sessions", { body });
      router.push(`/session/${s.id}`);
    } catch (e) { setErr((e as Error).message); }
  }

  if (!data) return <div className="loading">Loading…</div>;

  const w = data.week;
  const liftSets = w.reduce((a, s) => a + s.liftSets, 0);
  const vol = w.reduce((a, s) => a + s.volumeKg, 0);
  const cardioS = w.reduce((a, s) => a + s.cardioS, 0);
  const cardioM = w.reduce((a, s) => a + s.cardioM, 0);
  const days = new Set(w.map(s => new Date(s.startedAt).getDay()));
  const hello = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";
  const bw = data.body[0];

  return (
    <div className="page">
      <div className="dash-header">
        <div>
          <h1 className="dash-title">{hello}, {me.username}</h1>
          <p className="dash-subtitle">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
      </div>
      {err && <p className="form-error" style={{ marginBottom: 12 }}>{err}</p>}

      <div className="today-start">
        {data.todayRoutine ? (
          <button className="start-card primary" onClick={() => start({ routineId: data.todayRoutine!.id })}>
            <span className="start-card-title"><Icon name="play" /> Today: {data.todayRoutine.name}</span>
            <span className="start-card-sub">{data.todayRoutine.blocks.map(b => b.exercise?.displayName ?? b.activity?.name).slice(0, 5).join(" · ")}</span>
          </button>
        ) : (
          <button className="start-card primary" onClick={() => start({})}>
            <span className="start-card-title"><Icon name="plus" /> Start empty workout</span>
            <span className="start-card-sub">{data.program ? "Rest day on your program — or train anyway" : "Add lifts and cardio as you go"}</span>
          </button>
        )}
        {data.todayRoutine && (
          <button className="start-card" onClick={() => start({})}>
            <span className="start-card-title"><Icon name="plus" /> Empty workout</span>
            <span className="start-card-sub">Skip the plan today</span>
          </button>
        )}
        <Link className="start-card" href="/routines">
          <span className="start-card-title"><Icon name="routines" /> From a routine</span>
          <span className="start-card-sub">Pick one of your saved plans</span>
        </Link>
        <button className="start-card" onClick={() => setCardio("pick")}>
          <span className="start-card-title"><Icon name="run" /> Log cardio</span>
          <span className="start-card-sub">Quick entry for a run, ride, row…</span>
        </button>
        <Link className="start-card" href="/builder">
          <span className="start-card-title"><Icon name="builder" /> Build me a workout</span>
          <span className="start-card-sub">Generate one, or a full program</span>
        </Link>
      </div>

      {data.program && (
        <div className="section">
          <div className="section-header"><span className="section-title">{data.program.name}</span><Link href="/builder" className="view-all-link">Manage</Link></div>
          <div className="week-strip">
            {[1, 2, 3, 4, 5, 6, 0].map(d => {
              const day = data.program!.schedule.find(x => x.weekday === d);
              return (
                <div key={d} className={`week-day ${day ? (day.hasLift ? "on" : "cardio") : ""} ${d === weekday ? "now" : ""}`}>
                  {DOW[d]}{days.has(d) ? " ✓" : ""}<b>{day ? day.name.replace(/^.*?—\s*/, "") : "Rest"}</b>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="section">
        <div className="section-label">This week</div>
        <div className="stats-grid">
          <div className="stat-card accent-purple"><div className="stat-card-label">Workouts</div><div className="stat-card-value">{w.length}</div><div className="stat-card-sub">{days.size} day{days.size === 1 ? "" : "s"}</div></div>
          <div className="stat-card accent-purple"><div className="stat-card-label">Lift volume</div><div className="stat-card-value">{Math.round(kgTo(vol, me.weightUnit)).toLocaleString()}</div><div className="stat-card-sub">{me.weightUnit} · {liftSets} sets</div></div>
          <div className="stat-card accent-cyan"><div className="stat-card-label">Cardio</div><div className="stat-card-value">{fmtDuration(cardioS, { long: true }) || "0m"}</div><div className="stat-card-sub">{fmtDistance(cardioM, me.distanceUnit) || 0} {me.distanceUnit}</div></div>
          <Link href="/body" className="stat-card accent-cyan"><div className="stat-card-label">Body weight</div><div className="stat-card-value">{bw ? fmtWeight(bw.weight_kg, me.weightUnit) : "—"}</div>
            <div className="stat-card-sub">{bw ? `${me.weightUnit}${data.body[1] ? ` · ${bw.weight_kg >= data.body[1].weight_kg ? "+" : ""}${fmtWeight(bw.weight_kg - data.body[1].weight_kg, me.weightUnit)}` : ""}` : "Tap to log"}</div></Link>
        </div>
      </div>

      <div className="grid-2 section">
        <div className="card">
          <div className="card-header"><span className="card-title">Ready to go up</span><Icon name="up" className="text-cyan" /></div>
          {data.ready.length === 0
            ? <p className="text-muted" style={{ fontSize: 13 }}>Nothing yet. When you hit the top of your rep range on every set, the exercise shows up here with the weight to use next time.</p>
            : data.ready.map(r => (
              <Link key={r.exerciseId} href={`/exercises/${r.exerciseId}`} className="ready-row">
                <span>{r.name}</span>
                <b>{fmtWeight(r.lastWeightKg, me.weightUnit)} → {fmtWeight(r.nextWeightKg, me.weightUnit)} {me.weightUnit}</b>
              </Link>
            ))}
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Muscles · last 7 days</span><span className="row-sub">sets</span></div>
          <MuscleHeatmap data={data.muscles} />
        </div>
      </div>

      <div className="section">
        <div className="section-header"><span className="section-title">Recent</span><Link href="/history" className="view-all-link">All history</Link></div>
        {data.recent.length === 0
          ? <div className="empty-state"><div className="empty-state-title">No workouts yet</div><div className="empty-state-desc">Start one above, or import your Strong history from Settings.</div></div>
          : <div className="row-list">{data.recent.map(s => <SessionRow key={s.id} s={s} />)}</div>}
      </div>

      {cardio === "pick" && <ActivityPicker onClose={() => setCardio(null)} onPick={id => setCardio(id)} />}
      {typeof cardio === "number" && <QuickCardio activityTypeId={cardio} onClose={() => setCardio(null)} onSaved={() => { setCardio(null); reload(); }} />}
    </div>
  );
}

function QuickCardio({ activityTypeId, onClose, onSaved }: { activityTypeId: number; onClose: () => void; onSaved: () => void }) {
  const { me } = useMe();
  const [dur, setDur] = useState("");
  const [dist, setDist] = useState("");
  const [when, setWhen] = useState(() => {
    const d = new Date(); const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    const s = parseDuration(dur);
    if (!s) return setErr("Enter a time like 30:00");
    setBusy(true);
    try {
      const endsAt = new Date(when);
      await api("/api/sessions", { body: { cardio: { activityTypeId, durationS: s, distanceM: dist ? toM(Number(dist), me.distanceUnit) : null, startedAt: new Date(endsAt.getTime() - s * 1000).toISOString() } } });
      onSaved();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  return (
    <Modal title="Log cardio" onClose={onClose} footer={<button className="btn-primary" onClick={save} disabled={busy}>Save</button>}>
      <div className="form-stack">
        {err && <p className="form-error">{err}</p>}
        <div className="form-grid-2">
          <div className="form-group"><label className="form-label">Time (mm:ss or h:mm:ss)</label><input className="form-input" inputMode="numeric" value={dur} onChange={e => setDur(e.target.value)} placeholder="30:00" autoFocus /></div>
          <div className="form-group"><label className="form-label">Distance ({me.distanceUnit})</label><input className="form-input" inputMode="decimal" value={dist} onChange={e => setDist(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Finished at</label><input type="datetime-local" className="form-input" value={when} onChange={e => setWhen(e.target.value)} /></div>
        <p className="form-hint">Want GPS, heart rate or splits? Start a workout and add a cardio block instead.</p>
      </div>
    </Modal>
  );
}
