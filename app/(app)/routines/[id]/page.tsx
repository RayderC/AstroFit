"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/app/components/Icon";
import RoutineEditor from "@/app/components/RoutineEditor";
import { api, useApi } from "@/lib/client";
import type { RoutineBlockDTO, RoutineDTO } from "@/lib/types";

export default function RoutinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data } = useApi<RoutineDTO>(`/api/routines/${id}`);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [blocks, setBlocks] = useState<RoutineBlockDTO[]>([]);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!data) return;
    setName(data.name); setNotes(data.notes ?? ""); setBlocks(data.blocks); setDirty(false);
  }, [data]);

  async function save() {
    setMsg("");
    try {
      await api(`/api/routines/${id}`, { method: "PUT", body: { name, notes: notes || null, blocks } });
      setDirty(false); setMsg("Saved");
    } catch (e) { setMsg((e as Error).message); }
  }

  async function start() {
    if (dirty) await save();
    try { const s = await api<{ id: number }>("/api/sessions", { body: { routineId: Number(id) } }); router.push(`/session/${s.id}`); }
    catch (e) { setMsg((e as Error).message); }
  }

  if (!data) return <div className="loading">Loading…</div>;

  return (
    <div className="page page-narrow">
      <Link href="/routines" className="view-all-link"><Icon name="back" size={12} /> Routines</Link>
      <div className="form-stack" style={{ margin: "14px 0 18px" }}>
        <input className="form-input routine-name" value={name} onChange={e => { setName(e.target.value); setDirty(true); }} />
        <textarea className="form-textarea" placeholder="Notes (optional)" value={notes} onChange={e => { setNotes(e.target.value); setDirty(true); }} style={{ minHeight: 50 }} />
        {data.programName && <p className="form-hint">Part of your program “{data.programName}”.</p>}
      </div>
      <RoutineEditor blocks={blocks} onChange={b => { setBlocks(b); setDirty(true); }} />
      <div className="flex gap-2 items-center" style={{ marginTop: 22, flexWrap: "wrap" }}>
        <button className="btn-primary" onClick={start} disabled={!blocks.length}><Icon name="play" size={14} /> Start workout</button>
        <button className="btn-secondary" onClick={save} disabled={!dirty}>Save</button>
        <button className="btn-danger" style={{ marginLeft: "auto" }} onClick={async () => {
          if (!confirm("Delete this routine? Past workouts stay in your history.")) return;
          await api(`/api/routines/${id}`, { method: "DELETE" }); router.push("/routines");
        }}>Delete</button>
        {msg && <span className="text-muted" style={{ fontSize: 13 }}>{msg}</span>}
      </div>
    </div>
  );
}
