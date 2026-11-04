"use client";

import { useMemo, useState } from "react";
import Modal from "./Modal";
import { api, useApi } from "@/lib/client";
import { EQUIPMENT, MUSCLES } from "@/lib/exerciseSeed";
import type { ExerciseDTO } from "@/lib/types";

type Ex = ExerciseDTO & { timesDone?: number; lastDone?: string | null };

export function muscleLabel(id: string) {
  return MUSCLES.find(m => m.id === id)?.label ?? id;
}

/**
 * Searchable exercise list. multi=true lets you pick several and add them as a superset.
 * `only` restricts the list (used for swaps).
 */
export default function ExercisePicker({ title = "Add exercises", multi = true, onPick, onClose, only }: {
  title?: string;
  multi?: boolean;
  onPick: (ids: number[], asSuperset: boolean) => void | Promise<void>;
  onClose: () => void;
  only?: ExerciseDTO[];
}) {
  const { data, reload } = useApi<Ex[]>(only ? null : "/api/exercises");
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const src: Ex[] = only ?? data ?? [];
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return src.filter(e =>
      (!muscle || e.primary.includes(muscle) || e.secondary.includes(muscle)) &&
      (!equip || e.equipment === equip) &&
      words.every(w => e.displayName.toLowerCase().includes(w)));
  }, [data, only, q, muscle, equip]);

  const recent = useMemo(() => (q || muscle || equip || only) ? [] :
    [...list].filter(e => e.timesDone).sort((a, b) => (b.lastDone ?? "").localeCompare(a.lastDone ?? "")).slice(0, 8), [list, q, muscle, equip, only]);

  async function done(asSuperset: boolean) {
    if (!picked.length) return;
    setBusy(true);
    try { await onPick(picked, asSuperset); } finally { setBusy(false); }
  }

  function toggle(id: number) {
    if (!multi) { setPicked([id]); onPick([id], false); return; }
    setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  }

  const row = (e: Ex) => (
    <button key={e.id} className={`picker-row ${picked.includes(e.id) ? "picked" : ""}`} onClick={() => toggle(e.id)}>
      <div>
        <div className="picker-name">{e.displayName}</div>
        <div className="picker-meta">{e.primary.map(muscleLabel).join(", ")}{e.timesDone ? ` · ${e.timesDone}×` : ""}</div>
      </div>
      {multi && <span className="picker-check">{picked.includes(e.id) ? picked.indexOf(e.id) + 1 : ""}</span>}
    </button>
  );

  if (creating) return <CreateExercise onClose={() => setCreating(false)} onCreated={async ex => { setCreating(false); await reload(); toggle(ex.id); }} initialName={q} />;

  return (
    <Modal title={title} onClose={onClose} wide footer={multi ? (
      <div className="picker-footer">
        <span className="text-muted">{picked.length ? `${picked.length} selected` : "Tap to select"}</span>
        <div className="flex gap-2">
          {picked.length > 1 && <button className="btn-secondary" disabled={busy} onClick={() => done(true)}>Add as superset</button>}
          <button className="btn-primary" disabled={!picked.length || busy} onClick={() => done(false)}>Add {picked.length || ""}</button>
        </div>
      </div>
    ) : undefined}>
      <input className="form-input" placeholder="Search exercises" value={q} onChange={e => setQ(e.target.value)} autoFocus={!only} />
      {!only && (
        <>
          <div className="chip-scroll">
            <button className={`filter-chip ${!muscle ? "active" : ""}`} onClick={() => setMuscle(null)}>All muscles</button>
            {MUSCLES.map(m => <button key={m.id} className={`filter-chip ${muscle === m.id ? "active" : ""}`} onClick={() => setMuscle(muscle === m.id ? null : m.id)}>{m.label}</button>)}
          </div>
          <div className="chip-scroll">
            <button className={`filter-chip ${!equip ? "active" : ""}`} onClick={() => setEquip(null)}>Any equipment</button>
            {EQUIPMENT.map(m => <button key={m.id} className={`filter-chip ${equip === m.id ? "active" : ""}`} onClick={() => setEquip(equip === m.id ? null : m.id)}>{m.label}</button>)}
          </div>
        </>
      )}
      <div className="picker-list">
        {!data && !only && <div className="loading">Loading…</div>}
        {recent.length > 0 && <><div className="section-label">Recent</div>{recent.map(row)}<div className="section-label" style={{ marginTop: 12 }}>All exercises</div></>}
        {list.map(row)}
        {(data || only) && !list.length && <div className="empty-state-desc" style={{ padding: 20 }}>No matches.</div>}
        {!only && <button className="btn-ghost btn-full" style={{ marginTop: 8 }} onClick={() => setCreating(true)}>+ Create custom exercise{q ? ` “${q}”` : ""}</button>}
      </div>
    </Modal>
  );
}

export function CreateExercise({ onClose, onCreated, initialName = "" }: { onClose: () => void; onCreated: (e: ExerciseDTO) => void; initialName?: string }) {
  const [name, setName] = useState(initialName);
  const [equipment, setEquipment] = useState("dumbbell");
  const [logType, setLogType] = useState("weight_reps");
  const [primary, setPrimary] = useState<string[]>([]);
  const [secondary, setSecondary] = useState<string[]>([]);
  const [err, setErr] = useState("");

  async function save() {
    try {
      const ex = await api<ExerciseDTO>("/api/exercises", { body: { name, equipment, logType, primary, secondary } });
      onCreated(ex);
    } catch (e) { setErr((e as Error).message); }
  }
  const toggleIn = (arr: string[], set: (v: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

  return (
    <Modal title="New exercise" onClose={onClose} footer={<button className="btn-primary" onClick={save} disabled={!name.trim()}>Create</button>}>
      <div className="form-stack">
        {err && <p className="form-error">{err}</p>}
        <div className="form-group">
          <label className="form-label">Name</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} autoFocus />
        </div>
        <div className="form-grid-2">
          <div className="form-group">
            <label className="form-label">Equipment</label>
            <select className="form-select" value={equipment} onChange={e => setEquipment(e.target.value)}>
              {EQUIPMENT.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Logged as</label>
            <select className="form-select" value={logType} onChange={e => setLogType(e.target.value)}>
              <option value="weight_reps">Weight × reps</option>
              <option value="reps">Reps only</option>
              <option value="time">Time</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Primary muscles</label>
          <div className="chip-wrap">{MUSCLES.map(m => <button type="button" key={m.id} className={`filter-chip ${primary.includes(m.id) ? "active" : ""}`} onClick={() => toggleIn(primary, setPrimary, m.id)}>{m.label}</button>)}</div>
        </div>
        <div className="form-group">
          <label className="form-label">Secondary muscles</label>
          <div className="chip-wrap">{MUSCLES.map(m => <button type="button" key={m.id} className={`filter-chip ${secondary.includes(m.id) ? "active" : ""}`} onClick={() => toggleIn(secondary, setSecondary, m.id)}>{m.label}</button>)}</div>
        </div>
      </div>
    </Modal>
  );
}
