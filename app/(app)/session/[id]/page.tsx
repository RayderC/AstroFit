"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Icon from "@/app/components/Icon";
import Modal, { Sheet } from "@/app/components/Modal";
import ExercisePicker from "@/app/components/ExercisePicker";
import RestTimerBar, { useRestTimer } from "@/app/components/RestTimer";
import LiftCard from "@/app/components/session/LiftCard";
import CardioCard from "@/app/components/session/CardioCard";
import ActivityPicker from "@/app/components/ActivityPicker";
import { useMe } from "@/app/components/MeContext";
import { api, useApi } from "@/lib/client";
import { fmtDistance, fmtDuration, fmtPace, fmtWeight, kgTo, M_PER_MI, type DistanceUnit, type WeightUnit } from "@/lib/units";
import type { BlockDTO, CardioDTO, LiftBlockDTO, RecordHit, SessionDTO, SessionSummary, SetDTO } from "@/lib/types";

function elapsedOf(s: SessionDTO) {
  const end = s.endedAt ? Date.parse(s.endedAt) : Date.now();
  let paused = s.pausedS;
  if (!s.endedAt && s.pausedAt) paused += (Date.now() - Date.parse(s.pausedAt)) / 1000;
  return Math.max(0, (end - Date.parse(s.startedAt)) / 1000 - paused);
}

/** datetime-local value in local time */
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { me } = useMe();
  const { data: s, setData, error } = useApi<SessionDTO>(`/api/sessions/${id}`);
  const rest = useRestTimer(Number(id));
  const [, tick] = useState(0);
  const [picker, setPicker] = useState(false);
  const [cardioPick, setCardioPick] = useState(false);
  const [menu, setMenu] = useState(false);
  const [rename, setRename] = useState(false);
  const [summary, setSummary] = useState<{ summary: SessionSummary; records: RecordHit[] } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const finished = !!s?.endedAt;

  useEffect(() => {
    if (finished) return;
    const t = setInterval(() => tick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [finished]);

  const onSetsChanged = useCallback((blockId: number, sets: SetDTO[]) => {
    setData(prev => prev && { ...prev, blocks: prev.blocks.map(b => (b.id === blockId && b.kind === "lift" ? { ...b, sets } : b)) });
  }, [setData]);

  const onCardioChanged = useCallback((blockId: number, cardio: CardioDTO) => {
    setData(prev => prev && { ...prev, blocks: prev.blocks.map(b => (b.id === blockId && b.kind === "cardio" ? { ...b, cardio } : b)) });
  }, [setData]);

  // Rest after a completed set. Inside a superset, only rest after the last exercise of the round.
  const onSetDone = useCallback((block: LiftBlockDTO) => {
    if (!s) return;
    if (block.superset != null) {
      const group = s.blocks.filter(b => b.superset === block.superset);
      const idx = group.findIndex(b => b.id === block.id);
      if (idx < group.length - 1) {
        const next = group[idx + 1];
        document.getElementById(`block-${next.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    rest.start(block.restS, block.exercise.displayName);
  }, [s, rest]);

  // Group consecutive superset blocks for rendering.
  const groups = useMemo(() => {
    const out: BlockDTO[][] = [];
    for (const b of s?.blocks ?? []) {
      const last = out[out.length - 1];
      if (last && b.superset != null && last[0].superset === b.superset) last.push(b);
      else out.push([b]);
    }
    return out;
  }, [s?.blocks]);

  if (error) return <div className="empty-state"><div className="empty-state-title">{error}</div><Link href="/" className="btn-secondary">Back</Link></div>;
  if (!s) return <div className="loading">Loading…</div>;

  const pending = s.blocks.reduce((n, b) => n + (b.kind === "lift" ? b.sets.filter(x => !x.done).length : b.cardio.done ? 0 : 1), 0);
  const doneSets = s.blocks.reduce((n, b) => n + (b.kind === "lift" ? b.sets.filter(x => x.done && x.kind !== "warmup").length : 0), 0);
  const volume = s.blocks.reduce((v, b) => v + (b.kind === "lift" ? b.sets.filter(x => x.done && x.kind !== "warmup").reduce((a, x) => a + (x.weightKg ?? 0) * (x.reps ?? 0), 0) : 0), 0);

  async function patch(body: Record<string, unknown>) {
    setErr("");
    try { setData(await api<SessionDTO>(`/api/sessions/${id}`, { method: "PATCH", body })); }
    catch (e) { setErr((e as Error).message); }
  }

  async function finish() {
    if (pending > 0 && !confirm(`${pending} unfinished ${pending === 1 ? "entry" : "entries"} will be removed. Finish anyway?`)) return;
    setBusy(true); setErr("");
    rest.stop();
    try {
      // blur any focused input first so its value is saved
      (document.activeElement as HTMLElement | null)?.blur();
      await new Promise(r => setTimeout(r, 150));
      const res = await api<{ summary: SessionSummary; records: RecordHit[] }>(`/api/sessions/${id}`, { method: "PATCH", body: { action: "finish" } });
      setSummary(res);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function discard() {
    if (!confirm(finished ? "Delete this workout permanently?" : "Discard this workout? Nothing will be saved.")) return;
    rest.stop();
    await api(`/api/sessions/${id}`, { method: "DELETE" });
    router.replace(finished ? "/history" : "/");
  }

  async function addExercises(ids: number[], superset: boolean) {
    const next = await api<SessionDTO>(`/api/sessions/${id}/blocks`, { body: { exerciseIds: ids, superset } });
    setData(next);
    setPicker(false);
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 50);
  }

  async function addCardio(activityTypeId: number) {
    setData(await api<SessionDTO>(`/api/sessions/${id}/blocks`, { body: { activityTypeId } }));
    setCardioPick(false);
  }

  return (
    <div className={`session-page ${rest.active ? "has-rest" : ""}`}>
      <div className="session-head-top">
        <button className="icon-btn" onClick={() => router.push(finished ? "/history" : "/")} aria-label="Back"><Icon name="back" /></button>
        {!finished ? (
          <div className="session-clock">
            <span className={`clock ${s.pausedAt ? "paused" : ""}`}>{fmtDuration(elapsedOf(s))}</span>
            <button className="icon-btn" onClick={() => patch({ action: s.pausedAt ? "resume" : "pause" })} aria-label={s.pausedAt ? "Resume" : "Pause"}>
              <Icon name={s.pausedAt ? "play" : "pause"} size={16} />
            </button>
          </div>
        ) : <span className="badge badge-cyan">Editing</span>}
        {!finished
          ? <button className="btn-primary btn-sm finish-btn" onClick={finish} disabled={busy}>{busy ? "Saving…" : "Finish"}</button>
          : <button className="btn-secondary btn-sm" onClick={() => router.push("/history")}>Done</button>}
      </div>
      <div className="session-head">
        <button className="session-title" onClick={() => setRename(true)}>{s.name} <Icon name="edit" size={14} /></button>
        <div className="session-meta">
          {doneSets} sets · {fmtWeight(volume, me.weightUnit) || 0} {me.weightUnit}
          {finished && <> · {new Date(s.startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} · {fmtDuration(elapsedOf(s), { long: true })}</>}
          <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Workout options"><Icon name="more" size={16} /></button>
        </div>
        {s.notes && <p className="session-notes" onClick={() => setRename(true)}>{s.notes}</p>}
        {err && <p className="form-error">{err}</p>}
      </div>

      {s.blocks.length === 0 && (
        <div className="empty-state" style={{ padding: "40px 16px" }}>
          <div className="empty-state-title">Empty workout</div>
          <div className="empty-state-desc">Add lifts, cardio, or both.</div>
        </div>
      )}

      <div className="blocks">
        {groups.map(g => {
          const cards = g.map(b => (
            <div key={b.id} id={`block-${b.id}`}>
              {b.kind === "lift"
                ? <LiftCard sessionId={s.id} block={b} finished={finished} onSession={setData} onSetsChanged={onSetsChanged} onSetDone={onSetDone}
                    canSupersetNext={(() => { const all = s.blocks; const k = all.findIndex(x => x.id === b.id); return all[k + 1]?.kind === "lift"; })()}
                    inSuperset={g.length > 1} />
                : <CardioCard block={b} finished={finished} onSession={setData} onChange={onCardioChanged} />}
            </div>
          ));
          return g.length > 1
            ? <div key={"g" + g[0].id} className="superset-group"><div className="superset-label"><Icon name="link" size={12} /> Superset</div>{cards}</div>
            : cards[0];
        })}
      </div>

      <div className="session-actions">
        <button className="btn-secondary btn-lg" onClick={() => setPicker(true)}><Icon name="plus" /> Add exercises</button>
        <button className="btn-secondary btn-lg" onClick={() => setCardioPick(true)}><Icon name="run" /> Add cardio</button>
        <button className="btn-danger" onClick={discard}>{finished ? "Delete workout" : "Discard workout"}</button>
      </div>

      <RestTimerBar t={rest} />

      {picker && <ExercisePicker onClose={() => setPicker(false)} onPick={addExercises} />}
      {cardioPick && <ActivityPicker onClose={() => setCardioPick(false)} onPick={addCardio} />}
      {menu && <Sheet title="Workout" onClose={() => setMenu(false)} actions={[
        { label: "Rename / notes", onClick: () => setRename(true) },
        { label: "Save as routine", onClick: async () => { const r = await api<{ id: number }>("/api/routines", { body: { fromSessionId: s.id } }); router.push(`/routines/${r.id}`); } },
        { label: finished ? "Delete workout" : "Discard workout", danger: true, onClick: discard },
      ]} />}
      {rename && <MetaModal s={s} onClose={() => setRename(false)} onSave={async b => { await patch(b); setRename(false); }} />}
      {summary && <SummaryModal data={summary} onClose={() => router.replace("/")} />}
    </div>
  );
}

function MetaModal({ s, onClose, onSave }: { s: SessionDTO; onClose: () => void; onSave: (b: Record<string, unknown>) => void }) {
  const [name, setName] = useState(s.name);
  const [notes, setNotes] = useState(s.notes ?? "");
  const [start, setStart] = useState(toLocalInput(s.startedAt));
  const [end, setEnd] = useState(s.endedAt ? toLocalInput(s.endedAt) : "");
  return (
    <Modal title="Workout details" onClose={onClose} footer={<button className="btn-primary" onClick={() => onSave({
      name, notes: notes.trim() || null,
      ...(s.endedAt ? { startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString() } : {}),
    })}>Save</button>}>
      <div className="form-stack">
        <div className="form-group"><label className="form-label">Name</label><input className="form-input" value={name} onChange={e => setName(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={notes} onChange={e => setNotes(e.target.value)} /></div>
        {s.endedAt && (
          <div className="form-grid-2">
            <div className="form-group"><label className="form-label">Started</label><input type="datetime-local" className="form-input" value={start} onChange={e => setStart(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Ended</label><input type="datetime-local" className="form-input" value={end} onChange={e => setEnd(e.target.value)} /></div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function recordValue(r: RecordHit, wu: WeightUnit, du: DistanceUnit) {
  const v = Number(r.value);
  if (r.kind === "distance") return `${fmtDistance(v, du)} ${du}`;
  if (r.kind === "duration") return fmtDuration(v);
  if (r.kind === "pace") return fmtPace(v * (du === "mi" ? M_PER_MI : 1000), du);
  return `${fmtWeight(v, wu)} ${wu}`;
}

function SummaryModal({ data, onClose }: { data: { summary: SessionSummary; records: RecordHit[] }; onClose: () => void }) {
  const { me } = useMe();
  const s = data.summary;
  return (
    <Modal title="Workout complete" onClose={onClose} footer={<button className="btn-primary btn-full" onClick={onClose}>Done</button>}>
      <div className="summary-name">{s.name}</div>
      <div className="summary-grid">
        <div><div className="stat-card-label">Time</div><div className="stat-card-value sm">{fmtDuration(s.durationS, { long: true })}</div></div>
        {s.hasLift && <div><div className="stat-card-label">Sets</div><div className="stat-card-value sm">{s.liftSets}</div></div>}
        {s.hasLift && <div><div className="stat-card-label">Volume</div><div className="stat-card-value sm">{Math.round(kgTo(s.volumeKg, me.weightUnit)).toLocaleString()} <small>{me.weightUnit}</small></div></div>}
        {s.hasCardio && <div><div className="stat-card-label">Cardio</div><div className="stat-card-value sm">{fmtDuration(s.cardioS, { long: true })}</div></div>}
        {s.cardioM > 0 && <div><div className="stat-card-label">Distance</div><div className="stat-card-value sm">{fmtDistance(s.cardioM, me.distanceUnit)} <small>{me.distanceUnit}</small></div></div>}
      </div>
      {data.records.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 18 }}>New records</div>
          <ul className="record-list">
            {data.records.map((r, i) => (
              <li key={i}><span>{r.exercise}</span><span className="text-muted">{r.label}</span><b>{recordValue(r, me.weightUnit, me.distanceUnit)}</b></li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
