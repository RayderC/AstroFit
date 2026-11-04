"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/app/components/Icon";
import { api, fmtDate, useApi } from "@/lib/client";
import type { RoutineDTO } from "@/lib/types";

export default function RoutinesPage() {
  const router = useRouter();
  const { data } = useApi<RoutineDTO[]>("/api/routines");
  const [err, setErr] = useState("");

  async function start(id: number) {
    setErr("");
    try { const s = await api<{ id: number }>("/api/sessions", { body: { routineId: id } }); router.push(`/session/${s.id}`); }
    catch (e) { setErr((e as Error).message); }
  }
  async function create() {
    const r = await api<{ id: number }>("/api/routines", { body: { name: "New routine", blocks: [] } });
    router.push(`/routines/${r.id}`);
  }

  const mine = (data ?? []).filter(r => !r.programId);
  const prog = (data ?? []).filter(r => r.programId);

  const card = (r: RoutineDTO) => (
    <div key={r.id} className="row-card">
      <div className="row-top">
        <Link href={`/routines/${r.id}`} className="row-title">{r.name}</Link>
        <button className="btn-primary btn-sm" onClick={() => start(r.id)}><Icon name="play" size={12} /> Start</button>
      </div>
      <div className="row-body">{r.blocks.map(b => b.kind === "lift" ? `${b.setsCount}× ${b.exercise?.displayName}` : b.activity?.name).join(" · ") || "Empty"}</div>
      <div className="row-stats">{r.lastDone ? <span>Last done {fmtDate(r.lastDone)}</span> : <span>Never done</span>}{r.programName && <span className="badge badge-purple">{r.programName}</span>}</div>
    </div>
  );

  return (
    <div className="page page-narrow">
      <div className="dash-header">
        <div><h1 className="dash-title">Routines</h1><p className="dash-subtitle">Reusable workouts — lifts, cardio, or both</p></div>
        <button className="btn-primary" onClick={create}>+ New</button>
      </div>
      {err && <p className="form-error">{err}</p>}
      {!data ? <div className="loading">Loading…</div> : (
        <>
          {mine.length === 0 && prog.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-title">No routines yet</div>
              <div className="empty-state-desc">Make one here, save a finished workout as a routine, or let the builder make a program.</div>
              <Link href="/builder" className="btn-secondary">Open builder</Link>
            </div>
          )}
          {mine.length > 0 && <div className="row-list section">{mine.map(card)}</div>}
          {prog.length > 0 && <><div className="section-label">From your program</div><div className="row-list">{prog.map(card)}</div></>}
        </>
      )}
    </div>
  );
}
