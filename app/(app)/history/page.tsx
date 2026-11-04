"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/app/components/Icon";
import Modal from "@/app/components/Modal";
import SessionRow from "@/app/components/SessionRow";
import { useMe } from "@/app/components/MeContext";
import { api, localDay, useApi } from "@/lib/client";
import { fmtDistance, fmtDuration, kgTo } from "@/lib/units";
import type { SessionSummary } from "@/lib/types";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

export default function HistoryPage() {
  const { me } = useMe();
  const router = useRouter();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState<string | null>(null);
  const [past, setPast] = useState(false);

  const from = month.toISOString();
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1).toISOString();
  const { data } = useApi<SessionSummary[]>(`/api/sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

  const byDay = useMemo(() => {
    const m = new Map<string, SessionSummary[]>();
    for (const s of data ?? []) { const k = localDay(new Date(s.startedAt)); m.set(k, [...(m.get(k) ?? []), s]); }
    return m;
  }, [data]);

  const cells = useMemo(() => {
    const first = new Date(month);
    const lead = (first.getDay() + 6) % 7;
    const start = new Date(first); start.setDate(1 - lead);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; })
      .filter((d, i) => i < 35 || d.getMonth() === month.getMonth());
  }, [month]);

  const shown = sel ? byDay.get(sel) ?? [] : data ?? [];
  const today = localDay();
  const totals = (data ?? []).reduce((a, s) => ({ n: a.n + 1, v: a.v + s.volumeKg, c: a.c + s.cardioS, m: a.m + s.cardioM }), { n: 0, v: 0, c: 0, m: 0 });

  return (
    <div className="page page-narrow">
      <div className="dash-header">
        <div><h1 className="dash-title">History</h1><p className="dash-subtitle">Tap a workout to view or edit it</p></div>
        <button className="btn-secondary" onClick={() => setPast(true)}>+ Log past workout</button>
      </div>

      <div className="card section">
        <div className="cal-head">
          <button className="icon-btn" onClick={() => { setSel(null); setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1)); }} aria-label="Previous month"><Icon name="back" /></button>
          <span className="cal-title">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
          <button className="icon-btn" onClick={() => { setSel(null); setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1)); }} aria-label="Next month"><Icon name="chevron" /></button>
        </div>
        <div className="cal">
          {DOW.map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
          {cells.map(d => {
            const k = localDay(d);
            const list = byDay.get(k);
            return (
              <button key={k} className={`cal-day ${d.getMonth() !== month.getMonth() ? "other" : ""} ${k === today ? "today" : ""} ${list ? "has" : ""} ${sel === k ? "sel" : ""}`}
                onClick={() => list && setSel(sel === k ? null : k)} disabled={!list}>
                <span>{d.getDate()}</span>
                <span className="cal-dots">
                  {list?.some(s => s.hasLift) && <i className="dot lift" />}
                  {list?.some(s => s.hasCardio) && <i className="dot cardio" />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="row-stats" style={{ marginTop: 12 }}>
          <span><b>{totals.n}</b> workouts</span>
          <span><b>{Math.round(kgTo(totals.v, me.weightUnit)).toLocaleString()}</b> {me.weightUnit} lifted</span>
          <span><b>{fmtDuration(totals.c, { long: true }) || "0m"}</b> cardio</span>
          {totals.m > 0 && <span><b>{fmtDistance(totals.m, me.distanceUnit)}</b> {me.distanceUnit}</span>}
        </div>
      </div>

      {sel && <div className="section-header"><span className="section-title">{new Date(sel + "T12:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span><button className="view-all-link" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setSel(null)}>Show month</button></div>}
      {!data ? <div className="loading">Loading…</div> : shown.length === 0
        ? <div className="empty-state"><div className="empty-state-desc">No workouts this month.</div></div>
        : <div className="row-list">{shown.map(s => <SessionRow key={s.id} s={s} />)}</div>}

      {past && <PastModal onClose={() => setPast(false)} onCreated={id => router.push(`/session/${id}`)} />}
    </div>
  );
}

function PastModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [name, setName] = useState("Workout");
  const [date, setDate] = useState(localDay());
  const [start, setStart] = useState("17:00");
  const [mins, setMins] = useState("60");
  const [err, setErr] = useState("");
  async function save() {
    const s = new Date(`${date}T${start}`);
    const e = new Date(s.getTime() + (Number(mins) || 60) * 60000);
    try { const r = await api<{ id: number }>("/api/sessions", { body: { name, past: { startedAt: s.toISOString(), endedAt: e.toISOString() } } }); onCreated(r.id); }
    catch (x) { setErr((x as Error).message); }
  }
  return (
    <Modal title="Log a past workout" onClose={onClose} footer={<button className="btn-primary" onClick={save}>Create & add exercises</button>}>
      <div className="form-stack">
        {err && <p className="form-error">{err}</p>}
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="form-grid-3">
          <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Start</label><input type="time" className="form-input" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Minutes</label><input className="form-input" inputMode="numeric" value={mins} onChange={e => setMins(e.target.value)} /></div>
        </div>
      </div>
    </Modal>
  );
}
