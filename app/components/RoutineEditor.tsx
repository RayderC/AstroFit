"use client";

import { useState } from "react";
import Icon from "./Icon";
import ExercisePicker from "./ExercisePicker";
import ActivityPicker from "./ActivityPicker";
import { useMe } from "./MeContext";
import { api, parseNum } from "@/lib/client";
import { fmtDistance, fmtDuration, fmtWeight, parseDuration, toKg, toM } from "@/lib/units";
import type { ActivityDTO, ExerciseDTO, RoutineBlockDTO } from "@/lib/types";

/** Editable list of routine blocks. Used by the routine page and the workout builder preview. */
export default function RoutineEditor({ blocks, onChange }: { blocks: RoutineBlockDTO[]; onChange: (b: RoutineBlockDTO[]) => void }) {
  const { me } = useMe();
  const [picker, setPicker] = useState<null | "add" | number>(null);
  const [alts, setAlts] = useState<ExerciseDTO[] | null>(null);
  const [cardio, setCardio] = useState(false);

  const set = (i: number, p: Partial<RoutineBlockDTO>) => onChange(blocks.map((b, j) => (j === i ? { ...b, ...p } : b)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    const n = [...blocks]; [n[i], n[j]] = [n[j], n[i]]; onChange(n);
  };
  const toggleSuperset = (i: number) => {
    const a = blocks[i], b = blocks[i + 1];
    if (!b) return;
    if (a.superset != null && a.superset === b.superset) return onChange(blocks.map((x, j) => (j === i + 1 || (j === i && blocks[i - 1]?.superset !== a.superset) ? { ...x, superset: null } : x)));
    const g = a.superset ?? b.superset ?? Date.now() % 1_000_000;
    onChange(blocks.map((x, j) => (j === i || j === i + 1 ? { ...x, superset: g } : x)));
  };

  async function addExercises(ids: number[], superset: boolean) {
    const all = await api<ExerciseDTO[]>("/api/exercises");
    const g = superset ? Date.now() % 1_000_000 : null;
    onChange([...blocks, ...ids.map(id => ({
      kind: "lift" as const, superset: g, exerciseId: id, activityTypeId: null, exercise: all.find(e => e.id === id) ?? null,
      setsCount: 3, repMin: 8, repMax: 12, targetWeightKg: null, restS: null, targetDurationS: null, targetDistanceM: null, notes: null,
    }))]);
    setPicker(null);
  }

  async function addCardio(id: number) {
    const all = await api<ActivityDTO[]>("/api/activity-types");
    onChange([...blocks, { kind: "cardio", superset: null, exerciseId: null, activityTypeId: id, activity: all.find(a => a.id === id) ?? null,
      setsCount: 1, repMin: null, repMax: null, targetWeightKg: null, restS: null, targetDurationS: 20 * 60, targetDistanceM: null, notes: null }]);
    setCardio(false);
  }

  async function swap(i: number) {
    setAlts(await api<ExerciseDTO[]>(`/api/exercises/${blocks[i].exerciseId}/alternatives`));
    setPicker(i);
  }

  return (
    <div>
      <div className="row-list">
        {blocks.map((b, i) => {
          const inSS = b.superset != null && (blocks[i - 1]?.superset === b.superset || blocks[i + 1]?.superset === b.superset);
          return (
            <div key={`${i}-${b.exerciseId ?? "c" + b.activityTypeId}-${blocks.length}`} className={`rb-row ${inSS ? "in-superset" : ""}`}>
              <div>
                <div className="rb-name">
                  {b.kind === "lift" ? b.exercise?.displayName : <><Icon name="run" size={13} /> {b.activity?.name}</>}
                  {inSS && <span className="badge badge-purple" style={{ marginLeft: 8 }}>Superset</span>}
                </div>
                {b.kind === "lift" ? (
                  <div className="rb-fields">
                    <label>Sets <input inputMode="numeric" value={b.setsCount} onChange={e => set(i, { setsCount: Number(e.target.value.replace(/\D/g, "")) || 1 })} /></label>
                    <label>Reps <input inputMode="numeric" value={b.repMin ?? ""} onChange={e => set(i, { repMin: parseNum(e.target.value) })} />–<input inputMode="numeric" value={b.repMax ?? ""} onChange={e => set(i, { repMax: parseNum(e.target.value) })} /></label>
                    <label>Rest <input inputMode="numeric" placeholder="auto" defaultValue={b.restS != null ? fmtDuration(b.restS) : ""} onBlur={e => set(i, { restS: e.target.value ? parseDuration(e.target.value) : null })} /></label>
                    <label>{me.weightUnit} <input inputMode="decimal" placeholder="auto" defaultValue={b.targetWeightKg != null ? fmtWeight(b.targetWeightKg, me.weightUnit) : ""} onBlur={e => { const n = parseNum(e.target.value); set(i, { targetWeightKg: n != null ? toKg(n, me.weightUnit) : null }); }} /></label>
                  </div>
                ) : (
                  <div className="rb-fields">
                    <label>Time <input inputMode="numeric" defaultValue={b.targetDurationS != null ? fmtDuration(b.targetDurationS) : ""} onBlur={e => set(i, { targetDurationS: e.target.value ? parseDuration(e.target.value) : null })} /></label>
                    {b.activity?.hasDistance && <label>{me.distanceUnit} <input inputMode="decimal" defaultValue={b.targetDistanceM != null ? fmtDistance(b.targetDistanceM, me.distanceUnit) : ""} onBlur={e => { const n = parseNum(e.target.value); set(i, { targetDistanceM: n != null ? toM(n, me.distanceUnit) : null }); }} /></label>}
                  </div>
                )}
              </div>
              <div className="rb-actions">
                <button className="icon-btn" onClick={() => move(i, -1)} aria-label="Move up"><Icon name="up" size={14} /></button>
                {b.kind === "lift" && <button className="icon-btn" onClick={() => swap(i)} aria-label="Swap exercise"><Icon name="swap" size={14} /></button>}
                {b.kind === "lift" && blocks[i + 1]?.kind === "lift" && <button className={`icon-btn ${inSS && blocks[i + 1]?.superset === b.superset ? "text-cyan" : ""}`} onClick={() => toggleSuperset(i)} aria-label="Superset with next"><Icon name="link" size={14} /></button>}
                <button className="icon-btn" onClick={() => onChange(blocks.filter((_, j) => j !== i))} aria-label="Remove"><Icon name="trash" size={14} /></button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2" style={{ marginTop: 12, flexWrap: "wrap" }}>
        <button className="btn-secondary" onClick={() => setPicker("add")}><Icon name="plus" size={14} /> Exercises</button>
        <button className="btn-secondary" onClick={() => setCardio(true)}><Icon name="run" size={14} /> Cardio</button>
      </div>
      {picker === "add" && <ExercisePicker onClose={() => setPicker(null)} onPick={addExercises} />}
      {typeof picker === "number" && alts && (
        <ExercisePicker title="Swap for…" multi={false} only={alts} onClose={() => setPicker(null)}
          onPick={([id]) => { set(picker, { exerciseId: id, exercise: alts.find(a => a.id === id) ?? null }); setPicker(null); }} />
      )}
      {cardio && <ActivityPicker onClose={() => setCardio(false)} onPick={addCardio} />}
    </div>
  );
}
