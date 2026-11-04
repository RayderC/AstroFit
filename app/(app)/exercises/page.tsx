"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreateExercise, muscleLabel } from "@/app/components/ExercisePicker";
import { useApi } from "@/lib/client";
import { EQUIPMENT, MUSCLES } from "@/lib/exerciseSeed";
import type { ExerciseDTO } from "@/lib/types";

type Ex = ExerciseDTO & { timesDone: number; lastDone: string | null };

export default function ExercisesPage() {
  const router = useRouter();
  const { data } = useApi<Ex[]>("/api/exercises");
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);
  const [sort, setSort] = useState<"name" | "used">("name");
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const l = (data ?? []).filter(e =>
      (!muscle || e.primary.includes(muscle) || e.secondary.includes(muscle)) && (!equip || e.equipment === equip) &&
      words.every(w => e.displayName.toLowerCase().includes(w)));
    return sort === "used" ? [...l].sort((a, b) => b.timesDone - a.timesDone || a.displayName.localeCompare(b.displayName)) : l;
  }, [data, q, muscle, equip, sort]);

  return (
    <div className="page">
      <div className="dash-header">
        <div><h1 className="dash-title">Exercises</h1><p className="dash-subtitle">{data?.length ?? "…"} in your library</p></div>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ New</button>
      </div>
      <div className="flex gap-2">
        <input className="form-input" placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
        <div className="seg">
          <button className={sort === "name" ? "on" : ""} onClick={() => setSort("name")}>A–Z</button>
          <button className={sort === "used" ? "on" : ""} onClick={() => setSort("used")}>Most used</button>
        </div>
      </div>
      <div className="chip-scroll">
        <button className={`filter-chip ${!muscle ? "active" : ""}`} onClick={() => setMuscle(null)}>All muscles</button>
        {MUSCLES.map(m => <button key={m.id} className={`filter-chip ${muscle === m.id ? "active" : ""}`} onClick={() => setMuscle(muscle === m.id ? null : m.id)}>{m.label}</button>)}
      </div>
      <div className="chip-scroll" style={{ marginBottom: 14 }}>
        <button className={`filter-chip ${!equip ? "active" : ""}`} onClick={() => setEquip(null)}>Any equipment</button>
        {EQUIPMENT.map(m => <button key={m.id} className={`filter-chip ${equip === m.id ? "active" : ""}`} onClick={() => setEquip(equip === m.id ? null : m.id)}>{m.label}</button>)}
      </div>
      {!data ? <div className="loading">Loading…</div> : (
        <div className="row-list">
          {list.map(e => (
            <Link key={e.id} href={`/exercises/${e.id}`} className="row-card">
              <div className="row-top">
                <span className="row-title">{e.displayName}</span>
                {!e.isBuiltin && <span className="badge badge-purple">Custom</span>}
              </div>
              <div className="row-stats">
                <span>{e.primary.map(muscleLabel).join(", ") || "—"}</span>
                {e.timesDone > 0 && <span><b>{e.timesDone}</b>× · last {new Date(e.lastDone!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}
              </div>
            </Link>
          ))}
          {!list.length && <div className="empty-state"><div className="empty-state-desc">No exercises match.</div></div>}
        </div>
      )}
      {creating && <CreateExercise initialName={q} onClose={() => setCreating(false)} onCreated={e => router.push(`/exercises/${e.id}`)} />}
    </div>
  );
}
