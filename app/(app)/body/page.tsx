"use client";

import { useEffect, useMemo, useState } from "react";
import Chart from "@/app/components/Chart";
import Icon from "@/app/components/Icon";
import { useMe } from "@/app/components/MeContext";
import { api, fmtDate, localDay, parseNum, useApi } from "@/lib/client";
import { fmtWeight, kgTo, lengthToM, lengthUnitFor, mToLength, toKg, trim } from "@/lib/units";

// Same ids as lib/repo/body.ts, which can't be imported here because it opens the database.
const MEASUREMENTS = [
  { id: "neck", label: "Neck" }, { id: "chest", label: "Chest" }, { id: "waist", label: "Waist" }, { id: "hips", label: "Hips" },
  { id: "arms", label: "Arms" }, { id: "thighs", label: "Thighs" }, { id: "calves", label: "Calves" },
];

type Entry = { id: number; date: string; weightKg: number | null; bodyFatPct: number | null; measurements: Record<string, number>; notes: string | null };
type Form = { weight: string; fat: string; notes: string; m: Record<string, string> };

const EMPTY: Form = { weight: "", fat: "", notes: "", m: {} };

export default function BodyPage() {
  const { me } = useMe();
  const wu = me.weightUnit;
  const lu = lengthUnitFor(me.distanceUnit);
  const { data, reload } = useApi<Entry[]>("/api/body");
  const [date, setDate] = useState(() => localDay());
  const [form, setForm] = useState<Form>(EMPTY);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [all, setAll] = useState(false);

  const current = data?.find(e => e.date === date);

  const initial = useMemo<Form>(() => current ? {
    weight: current.weightKg != null ? fmtWeight(current.weightKg, wu) : "",
    fat: current.bodyFatPct != null ? trim(current.bodyFatPct, 1) : "",
    notes: current.notes ?? "",
    m: Object.fromEntries(Object.entries(current.measurements).map(([k, v]) => [k, trim(mToLength(v, lu), 1)])),
  } : EMPTY, [current, wu, lu]);

  // Editing a date that already has an entry starts from what's saved there.
  useEffect(() => { setForm(initial); }, [initial]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setErr("");
    // Send only what changed, so re-saving can't shift stored values through display rounding.
    const body: Record<string, unknown> = { date };
    const num = (s: string) => {
      const n = parseNum(s);
      if (s.trim() && n == null) throw new Error(`“${s}” isn't a number`);
      return n;
    };
    try {
      if (form.weight !== initial.weight) { const n = num(form.weight); body.weightKg = n != null ? toKg(n, wu) : null; }
      if (form.fat !== initial.fat) body.bodyFatPct = num(form.fat);
      if (form.notes !== initial.notes) body.notes = form.notes.trim() || null;
      const m: Record<string, number | null> = {};
      for (const { id } of MEASUREMENTS) {
        if ((form.m[id] ?? "") === (initial.m[id] ?? "")) continue;
        const n = num(form.m[id] ?? "");
        m[id] = n != null ? lengthToM(n, lu) : null;
      }
      if (Object.keys(m).length) body.measurements = m;
      if (Object.keys(body).length === 1) { setMsg("Nothing changed"); return; }
      await api("/api/body", { body });
      await reload();
      setMsg("Saved");
    } catch (x) { setErr((x as Error).message); }
  }

  async function remove(en: Entry) {
    if (!confirm(`Delete the entry for ${fmtDate(en.date)}?`)) return;
    try { await api(`/api/body/${en.id}`, { method: "DELETE" }); await reload(); }
    catch (x) { setErr((x as Error).message); }
  }

  if (!data) return <div className="loading">Loading…</div>;

  const series = (f: (e: Entry) => number | null | undefined) => data.flatMap(e => { const v = f(e); return v != null ? [{ x: e.date, y: v }] : []; });
  const dec1 = (v: number) => String(Math.round(v * 10) / 10);
  const charts = [
    { key: "weight", title: "Body weight", unit: wu, points: series(e => (e.weightKg != null ? kgTo(e.weightKg, wu) : null)) },
    { key: "fat", title: "Body fat", unit: "%", points: series(e => e.bodyFatPct) },
    ...MEASUREMENTS.map(m => ({ key: m.id, title: m.label, unit: lu as string, points: series(e => (e.measurements[m.id] != null ? mToLength(e.measurements[m.id], lu) : null)) })),
  ].filter(c => c.points.length > 0);

  const recent = [...data].reverse();

  return (
    <div className="page">
      <div className="dash-header"><div><h1 className="dash-title">Body</h1><p className="dash-subtitle">Weight, body fat and tape measurements</p></div></div>

      <form className="card section" onSubmit={save}>
        <div className="form-stack">
          <div className="form-grid-3">
            <div className="form-group"><label className="form-label" htmlFor="b-date">Date</label>
              <input id="b-date" type="date" className="form-input" value={date} max={localDay()} required onChange={e => { setDate(e.target.value); setMsg(""); }} /></div>
            <div className="form-group"><label className="form-label" htmlFor="b-weight">Weight ({wu})</label>
              <input id="b-weight" className="form-input" inputMode="decimal" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} /></div>
            <div className="form-group"><label className="form-label" htmlFor="b-fat">Body fat (%)</label>
              <input id="b-fat" className="form-input" inputMode="decimal" value={form.fat} onChange={e => setForm({ ...form, fat: e.target.value })} /></div>
          </div>
          <div className="section-label" style={{ margin: 0 }}>Measurements ({lu})</div>
          <div className="measure-grid">
            {MEASUREMENTS.map(m => (
              <div key={m.id} className="form-group"><label className="form-label" htmlFor={`b-${m.id}`}>{m.label}</label>
                <input id={`b-${m.id}`} className="form-input" inputMode="decimal" value={form.m[m.id] ?? ""} onChange={e => setForm({ ...form, m: { ...form.m, [m.id]: e.target.value } })} /></div>
            ))}
          </div>
          <div className="form-group"><label className="form-label" htmlFor="b-notes">Notes</label>
            <input id="b-notes" className="form-input" value={form.notes} maxLength={500} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          {err && <p className="form-error">{err}</p>}
          <div className="flex gap-2 items-center">
            <button className="btn-primary">{current ? "Update entry" : "Save entry"}</button>
            {msg && <span className="text-muted" style={{ fontSize: 13 }}>{msg}</span>}
          </div>
        </div>
      </form>

      {charts.length === 0 ? (
        <div className="empty-state"><div className="empty-state-title">Nothing logged yet</div><div className="empty-state-desc">Each thing you track gets its own chart here.</div></div>
      ) : (
        <div className="grid-2 section">
          {charts.map(c => (
            <div key={c.key} className="card">
              <div className="card-header">
                <span className="card-title">{c.title}</span>
                <span className="row-sub">{dec1(c.points[c.points.length - 1].y)} {c.unit}</span>
              </div>
              <Chart points={c.points} fmt={dec1} height={150} color={c.key === "weight" || c.key === "fat" ? undefined : "var(--accent-cyan)"}
                label={p => `${fmtDate(p.x)} · ${dec1(p.y)} ${c.unit}`} />
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="section">
          <div className="section-label">Entries</div>
          <div className="row-list">
            {(all ? recent : recent.slice(0, 10)).map(e => (
              <div key={e.id} className="row-card body-row">
                <button className="body-row-main" onClick={() => { setDate(e.date); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  <span className="row-title">{fmtDate(e.date)}</span>
                  <span className="row-stats">
                    {e.weightKg != null && <span><b>{fmtWeight(e.weightKg, wu)}</b> {wu}</span>}
                    {e.bodyFatPct != null && <span><b>{trim(e.bodyFatPct, 1)}</b>%</span>}
                    {MEASUREMENTS.filter(m => e.measurements[m.id] != null).map(m => <span key={m.id}>{m.label} <b>{trim(mToLength(e.measurements[m.id], lu), 1)}</b></span>)}
                  </span>
                  {e.notes && <span className="row-body">{e.notes}</span>}
                </button>
                <button className="icon-btn" aria-label={`Delete entry for ${fmtDate(e.date)}`} onClick={() => remove(e)}><Icon name="trash" size={14} /></button>
              </div>
            ))}
          </div>
          {!all && recent.length > 10 && <button className="btn-ghost btn-full" style={{ marginTop: 8 }} onClick={() => setAll(true)}>Show all {recent.length}</button>}
        </div>
      )}
    </div>
  );
}
