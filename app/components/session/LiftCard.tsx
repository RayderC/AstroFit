"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Icon from "@/app/components/Icon";
import Modal, { Sheet } from "@/app/components/Modal";
import ExercisePicker from "@/app/components/ExercisePicker";
import { useMe } from "@/app/components/MeContext";
import { api, parseNum } from "@/lib/client";
import { fmtDuration, fmtWeight, parseDuration, toKg } from "@/lib/units";
import type { ExerciseDTO, LiftBlockDTO, SessionDTO, SetDTO, SetKind } from "@/lib/types";

type Draft = { w: string; r: string; d: string };

const KIND_LABEL: Record<SetKind, string> = { normal: "", warmup: "W", drop: "D", failure: "F" };

export function setLabels(sets: { kind: SetKind }[]) {
  let n = 0;
  return sets.map(s => (s.kind === "warmup" ? "W" : s.kind === "drop" ? "D" : (++n, s.kind === "failure" ? `${n}F` : String(n))));
}

export default function LiftCard({ sessionId, block, finished, onSession, onSetsChanged, onSetDone, canSupersetNext, inSuperset }: {
  sessionId: number;
  block: LiftBlockDTO;
  finished: boolean;
  onSession: (s: SessionDTO) => void;
  onSetsChanged: (blockId: number, sets: SetDTO[]) => void;
  onSetDone: (block: LiftBlockDTO) => void;
  canSupersetNext: boolean;
  inSuperset: boolean;
}) {
  const { me } = useMe();
  const unit = me.weightUnit;
  const lt = block.exercise.logType;
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [menu, setMenu] = useState(false);
  const [setSheet, setSetSheet] = useState<SetDTO | null>(null);
  const [modal, setModal] = useState<null | "range" | "rest" | "note" | "swap">(null);
  const [alts, setAlts] = useState<ExerciseDTO[] | null>(null);
  const [err, setErr] = useState("");
  // Swipe a set left to reveal Delete, like Strong. Only one row is open at a time.
  const [swipe, setSwipe] = useState<{ id: number; dx: number } | null>(null);
  const touch = useRef<{ id: number; x: number; y: number; base: number; horizontal: boolean | null } | null>(null);

  // Keep drafts in sync with server sets (new/removed sets), without clobbering what's being typed.
  useEffect(() => {
    setDrafts(prev => {
      const next: Record<number, Draft> = {};
      for (const s of block.sets) {
        next[s.id] = prev[s.id] ?? {
          w: s.weightKg != null ? fmtWeight(s.weightKg, unit) : "",
          r: s.reps != null ? String(s.reps) : "",
          d: s.durationS != null ? fmtDuration(s.durationS) : "",
        };
      }
      return next;
    });
  }, [block.sets, unit]);

  const labels = setLabels(block.sets);

  function valuesFor(s: SetDTO, i: number) {
    const d = drafts[s.id] ?? { w: "", r: "", d: "" };
    const prev = block.previous[i];
    const w = parseNum(d.w);
    const r = parseNum(d.r);
    const dur = d.d ? parseDuration(d.d) : null;
    return {
      weightKg: w != null ? toKg(w, unit) : prev?.weightKg ?? null,
      reps: r != null ? Math.round(r) : prev?.reps ?? null,
      durationS: dur ?? prev?.durationS ?? null,
    };
  }

  async function patchSet(s: SetDTO, body: Partial<SetDTO>) {
    setErr("");
    const updated = block.sets.map(x => (x.id === s.id ? { ...x, ...body } : x));
    onSetsChanged(block.id, updated);
    try { await api(`/api/sets/${s.id}`, { method: "PATCH", body }); }
    catch (e) { setErr((e as Error).message); onSetsChanged(block.id, block.sets); }
  }

  function commit(s: SetDTO) {
    const d = drafts[s.id];
    if (!d) return;
    const w = parseNum(d.w);
    const r = parseNum(d.r);
    const body: Partial<SetDTO> = {
      weightKg: w != null ? toKg(w, unit) : null,
      reps: r != null ? Math.round(r) : null,
      durationS: d.d ? parseDuration(d.d) : null,
    };
    if (body.weightKg === s.weightKg && body.reps === s.reps && body.durationS === s.durationS) return;
    patchSet(s, body);
  }

  async function toggleDone(s: SetDTO, i: number) {
    if (s.done) return patchSet(s, { done: false });
    const v = valuesFor(s, i);
    if (lt === "time" ? !v.durationS : !v.reps) { setErr(lt === "time" ? "Enter a time first" : "Enter reps first"); return; }
    setDrafts(p => ({
      ...p,
      [s.id]: {
        w: v.weightKg != null ? fmtWeight(v.weightKg, unit) : p[s.id]?.w ?? "",
        r: v.reps != null ? String(v.reps) : "",
        d: v.durationS != null ? fmtDuration(v.durationS) : "",
      },
    }));
    await patchSet(s, { ...v, done: true });
    if (!finished) onSetDone(block);
  }

  async function blockPatch(body: Record<string, unknown>) {
    try { onSession(await api<SessionDTO>(`/api/blocks/${block.id}`, { method: "PATCH", body })); }
    catch (e) { setErr((e as Error).message); }
  }

  async function addSet() {
    onSession(await api<SessionDTO>(`/api/blocks/${block.id}/sets`, { body: {} }));
  }

  async function removeSet(s: SetDTO) {
    setErr("");
    setSwipe(null);
    try {
      await api(`/api/sets/${s.id}`, { method: "DELETE" });
      onSetsChanged(block.id, block.sets.filter(x => x.id !== s.id));
    } catch (e) { setErr((e as Error).message); }
  }

  function removeLastSet() {
    const last = block.sets[block.sets.length - 1];
    if (!last) return;
    if (last.done && !confirm("The last set is already logged. Remove it anyway?")) return;
    removeSet(last);
  }

  const SWIPE_OPEN = -84;
  function onTouchStart(s: SetDTO, e: React.TouchEvent) {
    const t = e.touches[0];
    touch.current = { id: s.id, x: t.clientX, y: t.clientY, base: swipe?.id === s.id ? swipe.dx : 0, horizontal: null };
    if (swipe && swipe.id !== s.id) setSwipe(null);
  }
  function onTouchMove(e: React.TouchEvent) {
    const st = touch.current;
    if (!st) return;
    const t = e.touches[0];
    const dx = t.clientX - st.x, dy = t.clientY - st.y;
    // Decide once per gesture, so scrolling the page never drags a row sideways.
    if (st.horizontal === null && Math.abs(dx) + Math.abs(dy) > 8) st.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
    if (!st.horizontal) return;
    setSwipe({ id: st.id, dx: Math.max(-120, Math.min(0, st.base + dx)) });
  }
  function onTouchEnd() {
    const st = touch.current;
    touch.current = null;
    if (!st?.horizontal) return;
    setSwipe(w => (w && w.id === st.id && w.dx < SWIPE_OPEN / 2 ? { id: st.id, dx: SWIPE_OPEN } : null));
  }

  async function openSwap() {
    setAlts(await api<ExerciseDTO[]>(`/api/exercises/${block.exercise.id}/alternatives`));
    setModal("swap");
  }

  const sug = block.suggestion;
  const wLabel = unit.toUpperCase();

  return (
    <div className={`lift-card ${inSuperset ? "in-superset" : ""}`}>
      <div className="lift-head">
        <Link href={`/exercises/${block.exercise.id}`} className="lift-name">{block.exercise.displayName}</Link>
        <button className="icon-btn" onClick={() => setMenu(true)} aria-label="Exercise options"><Icon name="more" /></button>
      </div>

      <div className="lift-chips">
        {lt === "weight_reps" && (
          <button className="mini-chip" onClick={() => setModal("range")}>
            {block.repMin != null ? `${block.repMin}–${block.repMax} reps` : sug ? `${sug.repMin}–${sug.repMax} reps (auto)` : "Set rep range"}
          </button>
        )}
        {!finished && <button className="mini-chip" onClick={() => setModal("rest")}><Icon name="timer" size={12} /> {block.restS ? fmtDuration(block.restS) : "Off"}</button>}
        {block.stickyNote
          ? <button className="mini-chip note" onClick={() => setModal("note")}><Icon name="note" size={12} /> {block.stickyNote}</button>
          : <button className="mini-chip ghost" onClick={() => setModal("note")}><Icon name="note" size={12} /> Note</button>}
      </div>

      {!finished && sug && !sug.stalled && (
        <div className={`coach coach-${sug.status}`}>
          {sug.status === "increase" && <span><Icon name="up" size={14} /> <b>Add weight:</b> you hit {sug.repMax} reps at {fmtWeight(sug.lastWeightKg, unit)} {unit} — try <b>{fmtWeight(sug.nextWeightKg, unit)} {unit}</b></span>}
          {sug.status === "build" && <span>Stay at {fmtWeight(sug.lastWeightKg, unit)} {unit} and push every set to {sug.repMax} reps.</span>}
          {sug.status === "hold" && <span>Repeat {fmtWeight(sug.lastWeightKg, unit)} {unit} — get every set to at least {sug.repMin} reps.</span>}
        </div>
      )}
      {!finished && sug?.stalled && (
        <div className="coach coach-stalled">
          <span><b>No new best in {sug.stalled.sessions} sessions.</b> A lighter week often fixes that: {fmtWeight(sug.stalled.resetWeightKg, unit)} {unit}, then build back up.</span>
          <button type="button" className="mini-chip" onClick={() => setDrafts(x => {
            const next = { ...x };
            for (const s of block.sets) if (!s.done) next[s.id] = { ...(next[s.id] ?? { w: "", r: "", d: "" }), w: fmtWeight(sug.stalled!.resetWeightKg, unit) };
            return next;
          })}>Use {fmtWeight(sug.stalled.resetWeightKg, unit)} {unit}</button>
        </div>
      )}

      {err && <p className="form-error" style={{ margin: "6px 0" }}>{err}</p>}

      <div className={`set-table lt-${lt}`}>
        <div className="set-row set-head">
          <span>Set</span><span>Previous</span>
          {lt === "weight_reps" && <><span>{wLabel}</span><span>Reps</span></>}
          {lt === "reps" && <><span>+{wLabel}</span><span>Reps</span></>}
          {lt === "time" && <span className="span2">Time</span>}
          <span><Icon name="check" size={14} /></span>
        </div>
        {block.sets.map((s, i) => {
          const d = drafts[s.id] ?? { w: "", r: "", d: "" };
          const p = block.previous[i];
          const prevText = !p ? "—" : lt === "time" ? fmtDuration(p.durationS) : lt === "reps" ? `${p.weightKg ? `+${fmtWeight(p.weightKg, unit)} × ` : ""}${p.reps ?? "–"}` : `${fmtWeight(p.weightKg, unit) || 0} × ${p.reps ?? "–"}`;
          const ph = (k: "w" | "r" | "d") => !p ? "" : k === "w" ? fmtWeight(p.weightKg, unit) : k === "r" ? String(p.reps ?? "") : fmtDuration(p.durationS);
          const setD = (k: keyof Draft, v: string) => setDrafts(x => ({ ...x, [s.id]: { ...d, [k]: v } }));
          const dx = swipe?.id === s.id ? swipe.dx : 0;
          return (
            <div key={s.id} className="set-swipe">
            {dx < 0 && <button className="set-swipe-del" onClick={() => removeSet(s)} aria-label={`Delete set ${labels[i]}`}><Icon name="trash" size={16} /> Delete</button>}
            <div className={`set-row ${s.done ? "done" : ""} kind-${s.kind}`} style={dx ? { transform: `translateX(${dx}px)` } : undefined}
              onTouchStart={e => onTouchStart(s, e)} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
              <button className="set-label" onClick={() => setSetSheet(s)}>{labels[i]}</button>
              <span className="set-prev">{prevText}</span>
              {lt !== "time" && (
                <input className="set-input" inputMode="decimal" value={d.w} placeholder={ph("w")}
                  onChange={e => setD("w", e.target.value.replace(/[^\d.,]/g, ""))} onBlur={() => commit(s)} aria-label="Weight" />
              )}
              {lt !== "time" && (
                <input className="set-input" inputMode="numeric" value={d.r} placeholder={ph("r")}
                  onChange={e => setD("r", e.target.value.replace(/\D/g, ""))} onBlur={() => commit(s)} aria-label="Reps" />
              )}
              {lt === "time" && (
                <input className="set-input span2" inputMode="numeric" value={d.d} placeholder={ph("d") || "m:ss"}
                  onChange={e => setD("d", e.target.value.replace(/[^\d:]/g, ""))} onBlur={() => commit(s)} aria-label="Time" />
              )}
              <button className={`set-check ${s.done ? "on" : ""}`} onClick={() => toggleDone(s, i)} aria-label={s.done ? "Mark not done" : "Complete set"}>
                <Icon name="check" size={16} />
              </button>
            </div>
            </div>
          );
        })}
      </div>
      <div className="set-btns">
        <button className="add-set-btn" onClick={addSet}>+ Add set</button>
        {block.sets.length > 0 && <button className="add-set-btn remove-set-btn" onClick={removeLastSet} aria-label="Remove the last set">− Remove set</button>}
      </div>
      {block.sets.length > 1 && <p className="set-hint">Swipe a set left to delete it.</p>}

      {menu && (
        <Sheet title={block.exercise.displayName} onClose={() => setMenu(false)} actions={[
          { label: inSuperset ? "Remove from superset" : "Superset with next exercise", onClick: () => blockPatch({ superset: true }), hidden: !inSuperset && !canSupersetNext },
          { label: "Replace exercise", onClick: openSwap },
          { label: "Rep range", onClick: () => setModal("range"), hidden: lt !== "weight_reps" },
          { label: "Rest timer", onClick: () => setModal("rest") },
          { label: "Note", onClick: () => setModal("note") },
          { label: "Move up", onClick: () => blockPatch({ move: "up" }) },
          { label: "Move down", onClick: () => blockPatch({ move: "down" }) },
          { label: "Exercise history", onClick: () => { window.location.href = `/exercises/${block.exercise.id}`; } },
          { label: "Remove exercise", danger: true, onClick: async () => onSession(await api<SessionDTO>(`/api/blocks/${block.id}`, { method: "DELETE" })) },
        ]} />
      )}

      {setSheet && (
        <Sheet title={`Set ${labels[block.sets.indexOf(setSheet)]}`} onClose={() => setSetSheet(null)} actions={[
          ...(["warmup", "normal", "drop", "failure"] as SetKind[]).map(k => ({
            label: `${k === setSheet.kind ? "✓ " : ""}${{ warmup: "Warm-up set", normal: "Normal set", drop: "Drop set", failure: "Failure set" }[k]}`,
            onClick: () => patchSet(setSheet, { kind: k }),
          })),
          { label: "Delete set", danger: true, onClick: () => removeSet(setSheet) },
        ]} />
      )}

      {modal === "range" && <RangeModal block={block} onClose={() => setModal(null)} onSave={(lo, hi) => blockPatch({ repMin: lo, repMax: hi })} />}
      {modal === "rest" && <RestModal value={block.restS} onClose={() => setModal(null)} onSave={(v, def) => blockPatch({ restS: v, saveRestDefault: def })} />}
      {modal === "note" && <NoteModal exerciseId={block.exercise.id} value={block.stickyNote ?? ""} onClose={() => setModal(null)}
        onSaved={async () => onSession(await api<SessionDTO>(`/api/sessions/${sessionId}`))} />}
      {modal === "swap" && alts && (
        <ExercisePicker title="Replace with…" multi={false} only={alts} onClose={() => setModal(null)}
          onPick={async ([id]) => { setModal(null); await blockPatch({ exerciseId: id }); }} />
      )}
    </div>
  );
}

function RangeModal({ block, onClose, onSave }: { block: LiftBlockDTO; onClose: () => void; onSave: (lo: number | null, hi: number | null) => void }) {
  const [lo, setLo] = useState(String(block.repMin ?? block.suggestion?.repMin ?? 8));
  const [hi, setHi] = useState(String(block.repMax ?? block.suggestion?.repMax ?? 12));
  const presets: [number, number][] = [[3, 5], [5, 8], [6, 10], [8, 12], [10, 15], [12, 20]];
  return (
    <Modal title="Rep range" onClose={onClose} footer={
      <div className="flex gap-2">
        {block.repMin != null && <button className="btn-ghost" onClick={() => { onSave(null, null); onClose(); }}>Clear</button>}
        <button className="btn-primary" onClick={() => { onSave(parseNum(lo), parseNum(hi)); onClose(); }}>Save</button>
      </div>}>
      <p className="form-hint" style={{ marginBottom: 12 }}>When every working set hits the top of the range, AstroFit tells you to add weight next time.</p>
      <div className="chip-wrap" style={{ marginBottom: 14 }}>
        {presets.map(([a, b]) => <button key={a + "-" + b} className={`filter-chip ${lo === String(a) && hi === String(b) ? "active" : ""}`} onClick={() => { setLo(String(a)); setHi(String(b)); }}>{a}–{b}</button>)}
      </div>
      <div className="form-grid-2">
        <div className="form-group"><label className="form-label">Bottom</label><input className="form-input" inputMode="numeric" value={lo} onChange={e => setLo(e.target.value)} /></div>
        <div className="form-group"><label className="form-label">Top</label><input className="form-input" inputMode="numeric" value={hi} onChange={e => setHi(e.target.value)} /></div>
      </div>
    </Modal>
  );
}

export function RestModal({ value, onClose, onSave, showDefault = true }: { value: number | null; onClose: () => void; onSave: (v: number, asDefault: boolean) => void; showDefault?: boolean }) {
  const [v, setV] = useState(value ?? 90);
  const [def, setDef] = useState(true);
  const opts = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
  return (
    <Modal title="Rest timer" onClose={onClose} footer={<button className="btn-primary" onClick={() => { onSave(v, def); onClose(); }}>Save</button>}>
      <div className="chip-wrap">
        {opts.map(o => <button key={o} className={`filter-chip ${v === o ? "active" : ""}`} onClick={() => setV(o)}>{o === 0 ? "Off" : fmtDuration(o)}</button>)}
      </div>
      {showDefault && (
        <label className="check-row"><input type="checkbox" checked={def} onChange={e => setDef(e.target.checked)} /> Use this rest every time I do this exercise</label>
      )}
    </Modal>
  );
}

function NoteModal({ exerciseId, value, onClose, onSaved }: { exerciseId: number; value: string; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState(value);
  return (
    <Modal title="Exercise note" onClose={onClose} footer={<button className="btn-primary" onClick={async () => {
      await api(`/api/exercises/${exerciseId}`, { method: "PATCH", body: { prefs: { note: v.trim() || null } } });
      onClose(); onSaved();
    }}>Save</button>}>
      <p className="form-hint" style={{ marginBottom: 10 }}>Shows every time you do this exercise — seat height, grip, cues.</p>
      <textarea className="form-textarea" value={v} onChange={e => setV(e.target.value)} maxLength={500} autoFocus />
    </Modal>
  );
}

export { KIND_LABEL };
