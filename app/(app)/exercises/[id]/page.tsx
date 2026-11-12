"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/app/components/Icon";
import Chart from "@/app/components/Chart";
import Modal from "@/app/components/Modal";
import { RestModal, setLabels } from "@/app/components/session/LiftCard";
import { muscleLabel } from "@/app/components/ExercisePicker";
import { useMe } from "@/app/components/MeContext";
import { api, fmtDate, parseNum, useApi } from "@/lib/client";
import { equipmentLabel, MUSCLES } from "@/lib/exerciseSeed";
import { fmtDuration, fmtWeight, kgTo, toKg } from "@/lib/units";
import type { ExerciseDTO, SetKind, Suggestion } from "@/lib/types";

type Detail = {
  exercise: ExerciseDTO;
  prefs: { restS: number | null; incrementKg: number | null; note: string | null; effectiveIncrementKg: number };
  suggestion: Suggestion | null;
  history: { sessionId: number; date: string; name: string; sets: { kind: SetKind; weightKg: number | null; reps: number | null; durationS: number | null; rpe: number | null }[] }[];
  chart: { date: string; topKg: number; e1rmKg: number; volumeKg: number; maxReps: number; totalReps: number; maxDurationS: number }[];
  records: {
    heaviest: { weightKg: number; reps: number; date: string } | null;
    e1rm: { valueKg: number; weightKg: number; reps: number; date: string } | null;
    setVolume: { valueKg: number; weightKg: number; reps: number; date: string } | null;
    sessionVolume: { valueKg: number; date: string } | null;
    mostReps: { reps: number; weightKg: number | null; date: string } | null;
    longest: { durationS: number; date: string } | null;
    repRecords: { reps: number; weightKg: number; date: string }[];
  };
  totalSessions: number;
};

export default function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { me } = useMe();
  const u = me.weightUnit;
  const { data, reload } = useApi<Detail>(`/api/exercises/${id}`);
  const [tab, setTab] = useState<"history" | "charts" | "records">("history");
  const [metric, setMetric] = useState<"e1rm" | "top" | "volume" | "reps">("e1rm");
  const [modal, setModal] = useState<null | "rest" | "inc" | "note" | "muscles">(null);

  if (!data) return <div className="loading">Loading…</div>;
  const ex = data.exercise;
  const lt = ex.logType;
  const w = (kg: number | null | undefined) => `${fmtWeight(kg ?? 0, u)} ${u}`;

  const series = data.chart.map(c => ({
    x: c.date,
    y: lt === "time" ? c.maxDurationS : lt === "reps" ? (metric === "volume" ? c.totalReps : c.maxReps)
      : metric === "e1rm" ? kgTo(c.e1rmKg, u) : metric === "top" ? kgTo(c.topKg, u) : metric === "volume" ? kgTo(c.volumeKg, u) : c.maxReps,
  }));

  async function savePrefs(p: Record<string, unknown>) {
    await api(`/api/exercises/${id}`, { method: "PATCH", body: { prefs: p } });
    reload();
  }

  return (
    <div className="page page-narrow">
      <Link href="/exercises" className="view-all-link"><Icon name="back" size={12} /> Exercises</Link>
      <div className="dash-header" style={{ marginTop: 10 }}>
        <div>
          <h1 className="dash-title">{ex.displayName}</h1>
          <p className="dash-subtitle">
            {ex.primary.map(muscleLabel).join(", ")}{ex.secondary.length ? ` · also ${ex.secondary.map(muscleLabel).join(", ")}` : ""} · {equipmentLabel(ex.equipment)}
          </p>
        </div>
        {!ex.isBuiltin && <button className="btn-danger btn-sm" onClick={async () => {
          if (!confirm("Remove this custom exercise? Your logged history stays.")) return;
          await api(`/api/exercises/${id}`, { method: "DELETE" }); router.push("/exercises");
        }}>Remove</button>}
      </div>

      {data.suggestion && !data.suggestion.stalled && (
        <div className={`coach coach-${data.suggestion.status}`} style={{ marginBottom: 14 }}>
          <span>
            {data.suggestion.status === "increase" && <><Icon name="up" size={14} /> <b>Next time:</b> {w(data.suggestion.nextWeightKg)} for {data.suggestion.repMin}+ reps</>}
            {data.suggestion.status === "build" && <>Next time: stay at {w(data.suggestion.lastWeightKg)}, aim for {data.suggestion.repMax} reps on every set</>}
            {data.suggestion.status === "hold" && <>Next time: repeat {w(data.suggestion.lastWeightKg)} and get every set to {data.suggestion.repMin}+ reps</>}
            <span className="text-muted"> · range {data.suggestion.repMin}–{data.suggestion.repMax}{data.suggestion.inferred ? " (from your history)" : ""}</span>
          </span>
        </div>
      )}
      {data.suggestion?.stalled && (
        <div className="coach coach-stalled" style={{ marginBottom: 14 }}>
          <span><b>Stuck for {data.suggestion.stalled.sessions} sessions.</b> Try a lighter week: {w(data.suggestion.stalled.resetWeightKg)} for {data.suggestion.repMax} reps, then build back up. Sleep, food and a deload week can help too.</span>
        </div>
      )}

      <div className="lift-chips" style={{ marginBottom: 16 }}>
        <button className="mini-chip" onClick={() => setModal("rest")}><Icon name="timer" size={12} /> Rest {data.prefs.restS != null ? fmtDuration(data.prefs.restS) : `${fmtDuration(me.restDefault)} (default)`}</button>
        {lt === "weight_reps" && <button className="mini-chip" onClick={() => setModal("inc")}><Icon name="up" size={12} /> Step +{fmtWeight(data.prefs.effectiveIncrementKg, u)} {u}</button>}
        <button className={`mini-chip ${data.prefs.note ? "note" : "ghost"}`} onClick={() => setModal("note")}><Icon name="note" size={12} /> {data.prefs.note || "Add note"}</button>
        {!ex.isBuiltin && <button className={`mini-chip ${ex.primary.length ? "" : "note"}`} onClick={() => setModal("muscles")}><Icon name="body" size={12} /> {ex.primary.length ? "Edit muscles" : "Set muscles"}</button>}
      </div>

      <div className="tabs">
        {(["history", "charts", "records"] as const).map(t => <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
      </div>

      {tab === "history" && (data.history.length === 0 ? <div className="empty-state"><div className="empty-state-desc">You haven&apos;t logged this yet.</div></div> : (
        <div className="row-list">
          {data.history.map(h => {
            const labels = setLabels(h.sets);
            return (
              <Link key={h.sessionId} href={`/session/${h.sessionId}`} className="row-card">
                <div className="row-top"><span className="row-title">{h.name}</span><span className="row-sub">{fmtDate(h.date)}</span></div>
                <div className="hist-sets">
                  {h.sets.map((s, i) => (
                    <div key={i} className={`hist-set kind-${s.kind}`}>
                      <span className="set-label sm">{labels[i]}</span>
                      <span>{lt === "time" ? fmtDuration(s.durationS) : lt === "reps" ? `${s.weightKg ? `+${w(s.weightKg)} × ` : ""}${s.reps} reps` : `${w(s.weightKg)} × ${s.reps}`}{s.rpe ? ` @${s.rpe}` : ""}</span>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      ))}

      {tab === "charts" && (
        <div className="card">
          {lt === "weight_reps" && (
            <div className="chip-wrap" style={{ marginBottom: 12 }}>
              {([["e1rm", "Est. 1RM"], ["top", "Heaviest set"], ["volume", "Volume"], ["reps", "Most reps"]] as const).map(([k, l]) =>
                <button key={k} className={`filter-chip ${metric === k ? "active" : ""}`} onClick={() => setMetric(k)}>{l}</button>)}
            </div>
          )}
          {lt === "reps" && (
            <div className="chip-wrap" style={{ marginBottom: 12 }}>
              <button className={`filter-chip ${metric !== "volume" ? "active" : ""}`} onClick={() => setMetric("reps")}>Best set</button>
              <button className={`filter-chip ${metric === "volume" ? "active" : ""}`} onClick={() => setMetric("volume")}>Total reps</button>
            </div>
          )}
          <Chart points={series} fmt={v => lt === "time" ? fmtDuration(v) : lt === "reps" || metric === "reps" ? String(Math.round(v)) : `${Math.round(v).toLocaleString()}`}
            label={p => `${fmtDate(p.x)} · ${lt === "time" ? fmtDuration(p.y) : lt === "reps" || metric === "reps" ? `${Math.round(p.y)} reps` : `${Math.round(p.y * 10) / 10} ${u}`}`} />
        </div>
      )}

      {tab === "records" && (
        <div className="card">
          {data.totalSessions === 0 ? <p className="text-muted">No records yet.</p> : (
            <>
              <div className="stats-grid" style={{ marginBottom: 16 }}>
                {lt === "weight_reps" && data.records.e1rm && <Rec label="Est. 1RM" value={w(data.records.e1rm.valueKg)} sub={`${w(data.records.e1rm.weightKg)} × ${data.records.e1rm.reps} · ${fmtDate(data.records.e1rm.date)}`} />}
                {data.records.heaviest && data.records.heaviest.weightKg > 0 && <Rec label="Heaviest weight" value={w(data.records.heaviest.weightKg)} sub={`× ${data.records.heaviest.reps} · ${fmtDate(data.records.heaviest.date)}`} />}
                {lt === "weight_reps" && data.records.setVolume && <Rec label="Best set volume" value={w(data.records.setVolume.valueKg)} sub={`${w(data.records.setVolume.weightKg)} × ${data.records.setVolume.reps}`} />}
                {lt === "weight_reps" && data.records.sessionVolume && <Rec label="Best workout volume" value={w(data.records.sessionVolume.valueKg)} sub={fmtDate(data.records.sessionVolume.date)} />}
                {lt !== "time" && data.records.mostReps && <Rec label="Most reps" value={String(data.records.mostReps.reps)} sub={fmtDate(data.records.mostReps.date)} />}
                {lt === "time" && data.records.longest && <Rec label="Longest" value={fmtDuration(data.records.longest.durationS)} sub={fmtDate(data.records.longest.date)} />}
                <Rec label="Times done" value={String(data.totalSessions)} sub="workouts" />
              </div>
              {lt === "weight_reps" && data.records.repRecords.length > 0 && (
                <table className="data-table">
                  <thead><tr><th>Reps</th><th>Best weight</th><th>Est. 1RM</th><th>Date</th></tr></thead>
                  <tbody>
                    {data.records.repRecords.map(r => (
                      <tr key={r.reps}><td className="text-mono">{r.reps}</td><td className="text-mono">{w(r.weightKg)}</td>
                        <td className="text-mono">{fmtWeight(r.reps === 1 ? r.weightKg : r.weightKg * (1 + r.reps / 30), u)}</td><td>{fmtDate(r.date)}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {modal === "rest" && <RestModal value={data.prefs.restS ?? me.restDefault} showDefault={false} onClose={() => setModal(null)} onSave={v => savePrefs({ restS: v })} />}
      {modal === "inc" && <IncModal kg={data.prefs.effectiveIncrementKg} custom={data.prefs.incrementKg != null} onClose={() => setModal(null)} onSave={v => savePrefs({ incrementKg: v })} />}
      {modal === "note" && <NoteEdit value={data.prefs.note ?? ""} onClose={() => setModal(null)} onSave={v => savePrefs({ note: v || null })} />}
      {modal === "muscles" && <MusclesEdit primary={ex.primary} secondary={ex.secondary} onClose={() => setModal(null)} onSave={async b => {
        await api(`/api/exercises/${id}`, { method: "PATCH", body: b }); reload(); setModal(null);
      }} />}
    </div>
  );
}

function Rec({ label, value, sub }: { label: string; value: string; sub: string }) {
  return <div className="stat-card"><div className="stat-card-label">{label}</div><div className="stat-card-value sm">{value}</div><div className="stat-card-sub">{sub}</div></div>;
}

function IncModal({ kg, custom, onClose, onSave }: { kg: number; custom: boolean; onClose: () => void; onSave: (kg: number | null) => void }) {
  const { me } = useMe();
  const [v, setV] = useState(fmtWeight(kg, me.weightUnit));
  const presets = me.weightUnit === "lb" ? [2.5, 5, 10] : [1, 1.25, 2.5, 5];
  return (
    <Modal title="Weight step" onClose={onClose} footer={<div className="flex gap-2">
      {custom && <button className="btn-ghost" onClick={() => { onSave(null); onClose(); }}>Use default</button>}
      <button className="btn-primary" onClick={() => { const n = parseNum(v); if (n && n > 0) { onSave(toKg(n, me.weightUnit)); onClose(); } }}>Save</button>
    </div>}>
      <p className="form-hint" style={{ marginBottom: 12 }}>How much to add when you&apos;re ready to go up. Smaller lifts like lateral raises usually need a smaller step.</p>
      <div className="chip-wrap" style={{ marginBottom: 12 }}>{presets.map(p => <button key={p} className={`filter-chip ${v === String(p) ? "active" : ""}`} onClick={() => setV(String(p))}>+{p} {me.weightUnit}</button>)}</div>
      <input className="form-input" inputMode="decimal" value={v} onChange={e => setV(e.target.value)} />
    </Modal>
  );
}

function MusclesEdit({ primary, secondary, onClose, onSave }: { primary: string[]; secondary: string[]; onClose: () => void; onSave: (b: { primary: string[]; secondary: string[] }) => void }) {
  const [p, setP] = useState(primary);
  const [s, setS] = useState(secondary);
  const chips = (arr: string[], set: (v: string[]) => void) => (
    <div className="chip-wrap">{MUSCLES.map(m => <button key={m.id} type="button" className={`filter-chip ${arr.includes(m.id) ? "active" : ""}`} onClick={() => set(arr.includes(m.id) ? arr.filter(x => x !== m.id) : [...arr, m.id])}>{m.label}</button>)}</div>
  );
  return (
    <Modal title="Muscles worked" onClose={onClose} footer={<button className="btn-primary" onClick={() => onSave({ primary: p, secondary: s })}>Save</button>}>
      <div className="form-stack">
        <div className="form-group"><label className="form-label">Primary</label>{chips(p, setP)}</div>
        <div className="form-group"><label className="form-label">Secondary</label>{chips(s, setS)}</div>
      </div>
    </Modal>
  );
}

function NoteEdit({ value, onClose, onSave }: { value: string; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <Modal title="Exercise note" onClose={onClose} footer={<button className="btn-primary" onClick={() => { onSave(v.trim()); onClose(); }}>Save</button>}>
      <textarea className="form-textarea" value={v} onChange={e => setV(e.target.value)} maxLength={500} autoFocus placeholder="Seat on 4, grip just outside shoulders…" />
    </Modal>
  );
}
