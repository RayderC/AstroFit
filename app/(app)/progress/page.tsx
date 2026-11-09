"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Chart from "@/app/components/Chart";
import MuscleHeatmap from "@/app/components/MuscleHeatmap";
import { useMe } from "@/app/components/MeContext";
import { fmtDate, useApi } from "@/lib/client";
import { MUSCLES } from "@/lib/exerciseSeed";
import { fmtDistance, fmtDuration, fmtPace, fmtWeight, kgTo, mTo, paceSecPer } from "@/lib/units";

type Activity = {
  id: number; name: string; hasDistance: boolean; count: number;
  points: { date: string; durationS: number; distanceM: number }[];
  longestDistance: { distanceM: number; durationS: number | null; date: string } | null;
  longestTime: { durationS: number; distanceM: number | null; date: string } | null;
  fastest: { distanceM: number; durationS: number; date: string } | null;
  efforts: { label: string; meters: number; timeS: number; date: string; fromGps: boolean }[];
};
type Data = {
  weeks: number;
  lifting: {
    weekly: { week: string; volumeKg: number; sets: number; sessions: number }[];
    muscles: Record<string, number>;
    best: { exerciseId: number; name: string; e1rmKg: number; weightKg: number; reps: number; date: string; heaviestKg: number }[];
  };
  cardio: {
    weekly: { week: string; durationS: number; distanceM: number; sessions: number }[];
    activities: Activity[];
  };
  heatmap: Record<string, number>;
};

const RANGES = [{ w: 12, l: "12W" }, { w: 26, l: "6M" }, { w: 52, l: "1Y" }, { w: 0, l: "All" }];
const compact = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v)));
const weekOf = (d: string) => `Week of ${fmtDate(d, { month: "short", day: "numeric" })}`;

export default function ProgressPage() {
  const [tab, setTab] = useState<"lifting" | "cardio">("lifting");
  const [weeks, setWeeks] = useState(12);
  const url = useMemo(() => `/api/progress?weeks=${weeks}&tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`, [weeks]);
  const { data, error } = useApi<Data>(url);

  return (
    <div className="page">
      <div className="dash-header">
        <div><h1 className="dash-title">Progress</h1><p className="dash-subtitle">Lifting and cardio over time</p></div>
        <div className="seg">{RANGES.map(r => <button key={r.w} className={weeks === r.w ? "on" : ""} onClick={() => setWeeks(r.w)}>{r.l}</button>)}</div>
      </div>
      <div className="tabs">
        <button className={`tab ${tab === "lifting" ? "active" : ""}`} onClick={() => setTab("lifting")}>Lifting</button>
        <button className={`tab ${tab === "cardio" ? "active" : ""}`} onClick={() => setTab("cardio")}>Cardio</button>
      </div>
      {error && <p className="form-error">{error}</p>}
      {!data ? !error && <div className="loading">Loading…</div> : tab === "lifting" ? <Lifting d={data} /> : <Cardio d={data} />}
    </div>
  );
}

function Lifting({ d }: { d: Data }) {
  const { me } = useMe();
  const u = me.weightUnit;
  const [metric, setMetric] = useState<"volume" | "sets">("volume");
  const points = d.lifting.weekly.map(w => ({ x: w.week, y: metric === "volume" ? kgTo(w.volumeKg, u) : w.sets }));
  const rows = MUSCLES.map(m => ({ ...m, perWeek: (d.lifting.muscles[m.id] ?? 0) / d.weeks })).sort((a, b) => b.perWeek - a.perWeek);
  const max = Math.max(1, ...rows.map(r => r.perWeek));
  const trained = rows.some(r => r.perWeek > 0);

  return (
    <>
      <div className="card section">
        <div className="card-header">
          <span className="card-title">Weekly {metric}</span>
          <div className="chip-wrap">
            <button className={`filter-chip ${metric === "volume" ? "active" : ""}`} onClick={() => setMetric("volume")}>Volume</button>
            <button className={`filter-chip ${metric === "sets" ? "active" : ""}`} onClick={() => setMetric("sets")}>Sets</button>
          </div>
        </div>
        <Chart kind="bar" points={points} fmt={compact}
          label={p => `${weekOf(p.x)} · ${Math.round(p.y).toLocaleString()} ${metric === "volume" ? u : "sets"}`} />
      </div>

      <div className="grid-2 section">
        <div className="card">
          <div className="card-header"><span className="card-title">Sets per muscle</span><span className="row-sub">avg per week</span></div>
          {!trained ? <p className="text-muted" style={{ fontSize: 13 }}>No lifting in this range.</p> : (
            <div className="bars">
              {rows.map(r => (
                <div key={r.id} className="bar-row">
                  <span className="bar-label">{r.label}</span>
                  <span className="bar-track"><i style={{ width: `${(r.perWeek / max) * 100}%` }} /></span>
                  <b className="bar-val">{Math.round(r.perWeek * 10) / 10}</b>
                </div>
              ))}
            </div>
          )}
          <p className="form-hint" style={{ marginTop: 10 }}>Secondary muscles count as half a set. Warm-ups aren&apos;t counted.</p>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Muscles · last 7 days</span><span className="row-sub">sets</span></div>
          <MuscleHeatmap data={d.heatmap} />
        </div>
      </div>

      <div className="card section">
        <div className="card-header"><span className="card-title">Best lifts</span><span className="row-sub">all time</span></div>
        {d.lifting.best.length === 0 ? <p className="text-muted" style={{ fontSize: 13 }}>Log some weighted sets to see your best lifts.</p> : (
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Exercise</th><th>Est. 1RM</th><th>Best set</th><th>Heaviest</th><th>Date</th></tr></thead>
              <tbody>
                {d.lifting.best.map(b => (
                  <tr key={b.exerciseId}>
                    <td><Link href={`/exercises/${b.exerciseId}`}>{b.name}</Link></td>
                    <td className="text-mono">{fmtWeight(b.e1rmKg, u)} {u}</td>
                    <td className="text-mono">{fmtWeight(b.weightKg, u)} × {b.reps}</td>
                    <td className="text-mono">{fmtWeight(b.heaviestKg, u)} {u}</td>
                    <td>{fmtDate(b.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Cardio({ d }: { d: Data }) {
  const { me } = useMe();
  const du = me.distanceUnit;
  const [metric, setMetric] = useState<"distance" | "time">("distance");
  const [sel, setSel] = useState<number | null>(null);
  const acts = d.cardio.activities;
  const a = acts.find(x => x.id === sel) ?? acts[0];
  const weekly = d.cardio.weekly.map(w => ({ x: w.week, y: metric === "distance" ? mTo(w.distanceM, du) : w.durationS / 60 }));
  const pace = (a?.points ?? []).map(p => ({ x: p.date, y: paceSecPer(p.distanceM, p.durationS, du) ?? 0 }));

  if (!acts.length) {
    return <div className="empty-state"><div className="empty-state-title">No cardio yet</div><div className="empty-state-desc">Log a run, ride or row and your trends show up here.</div></div>;
  }

  const total = d.cardio.weekly.reduce((t, w) => ({ s: t.s + w.durationS, m: t.m + w.distanceM, n: t.n + w.sessions }), { s: 0, m: 0, n: 0 });
  const weeksShown = Math.max(1, d.cardio.weekly.length);

  return (
    <>
      <div className="stats-grid section">
        <Best label="Sessions" value={String(total.n)} sub={`${Math.round((total.n / weeksShown) * 10) / 10} a week`} />
        <Best label="Time" value={fmtDuration(total.s, { long: true })} sub={`${fmtDuration(total.s / weeksShown, { long: true })} a week`} />
        <Best label="Distance" value={`${fmtDistance(total.m, du)} ${du}`} sub={`${fmtDistance(total.m / weeksShown, du)} ${du} a week`} />
      </div>
      <div className="card section">
        <div className="card-header">
          <span className="card-title">Weekly {metric}</span>
          <div className="chip-wrap">
            <button className={`filter-chip ${metric === "distance" ? "active" : ""}`} onClick={() => setMetric("distance")}>Distance</button>
            <button className={`filter-chip ${metric === "time" ? "active" : ""}`} onClick={() => setMetric("time")}>Time</button>
          </div>
        </div>
        <Chart kind="bar" color="var(--accent-cyan)" points={weekly}
          fmt={v => (metric === "distance" ? String(Math.round(v * 10) / 10) : `${Math.round(v)}m`)}
          label={p => `${weekOf(p.x)} · ${metric === "distance" ? `${Math.round(p.y * 100) / 100} ${du}` : fmtDuration(p.y * 60, { long: true })}`} />
      </div>

      <div className="chip-scroll section" style={{ marginBottom: 14 }}>
        {acts.map(x => <button key={x.id} className={`filter-chip ${a?.id === x.id ? "active" : ""}`} onClick={() => setSel(x.id)}>{x.name} · {x.count}</button>)}
      </div>

      {a && a.hasDistance && (
        <div className="card section">
          <div className="card-header"><span className="card-title">{a.name} pace</span><span className="row-sub">lower is faster</span></div>
          <Chart points={pace} color="var(--accent-cyan)" fmt={v => fmtDuration(v)}
            label={p => `${fmtDate(p.x)} · ${fmtPace(p.y, du)}`} />
        </div>
      )}

      {a && (
        <div className="card section">
          <div className="card-header"><span className="card-title">{a.name} best efforts</span><span className="row-sub">all time</span></div>
          <div className="stats-grid">
            {a.longestDistance && <Best label="Longest distance" value={`${fmtDistance(a.longestDistance.distanceM, du)} ${du}`} sub={fmtDate(a.longestDistance.date)} />}
            {a.longestTime && <Best label="Longest time" value={fmtDuration(a.longestTime.durationS, { long: true })} sub={fmtDate(a.longestTime.date)} />}
            {a.fastest && <Best label="Fastest pace" value={fmtPace(paceSecPer(a.fastest.distanceM, a.fastest.durationS, du), du)} sub={`${fmtDistance(a.fastest.distanceM, du)} ${du} · ${fmtDate(a.fastest.date)}`} />}
            {a.efforts.map(e => <Best key={e.label} label={e.label} value={fmtDuration(e.timeS)} sub={`${fmtDate(e.date)}${e.fromGps ? "" : " · est."}`} />)}
          </div>
          {a.efforts.length > 0 && <p className="form-hint" style={{ marginTop: 10 }}>Times come from the fastest stretch of a GPS track. Ones marked est. had no track, so they use that session&apos;s average pace.</p>}
        </div>
      )}
    </>
  );
}

function Best({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="stat-card"><div className="stat-card-label">{label}</div><div className="stat-card-value sm">{value}</div><div className="stat-card-sub">{sub}</div></div>;
}
