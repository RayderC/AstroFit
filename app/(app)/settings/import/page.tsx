"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Icon from "@/app/components/Icon";
import { useMe } from "@/app/components/MeContext";
import { api, fmtDate, useApi } from "@/lib/client";
import type { ActivityDTO, ExerciseDTO } from "@/lib/types";

type Match = { name: string; sets: number; workouts: number; shape: "lift" | "cardio"; target: string; matched: boolean; hasWeightedDistance: boolean };
type Preview = {
  delimiter: string; rows: number; sets: number; workouts: number; newWorkouts: number; duplicates: number; from: string; to: string;
  restRows: number; emptySets: number; ignoredRows: number; badDates: number; heaviest: number;
  weightUnit: "lb" | "kg" | null; distanceUnit: "mi" | "km" | null; sameFileImported: boolean; exercises: Match[];
};
type Result = { imported: number; skipped: number; skippedEmpty: number; sets: number; cardio: number; createdExercises: number; createdActivities: number; distanceDropped: number };

const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Excel can re-save a CSV as UTF-16; everything else is UTF-8. */
async function readText(f: File) {
  const buf = await f.arrayBuffer();
  const b = new Uint8Array(buf);
  const enc = b[0] === 0xff && b[1] === 0xfe ? "utf-16le" : b[0] === 0xfe && b[1] === 0xff ? "utf-16be" : "utf-8";
  return new TextDecoder(enc).decode(buf);
}

export default function ImportPage() {
  const { me } = useMe();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [wu, setWu] = useState<"lb" | "kg">(me.weightUnit);
  const [du, setDu] = useState<"mi" | "km">(me.distanceUnit);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: exercises } = useApi<ExerciseDTO[]>(preview ? "/api/exercises" : null);
  const { data: activities } = useApi<ActivityDTO[]>(preview ? "/api/activity-types" : null);

  async function choose(f: File | undefined) {
    if (!f) return;
    setErr(""); setPreview(null); setResult(null); setBusy(true);
    try {
      const text = await readText(f);
      const p = await api<Preview>("/api/import/strong", { body: { csv: text, tz: tz() } });
      setCsv(text); setFileName(f.name); setPreview(p);
      setMapping(Object.fromEntries(p.exercises.map(e => [e.name, e.target])));
      if (p.weightUnit) setWu(p.weightUnit);
      if (p.distanceUnit) setDu(p.distanceUnit);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function runImport() {
    setErr(""); setBusy(true);
    try {
      setResult(await api<Result>("/api/import/strong", { body: { csv, tz: tz(), commit: true, weightUnit: wu, distanceUnit: du, mapping } }));
      setPreview(null); setCsv("");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const options = useMemo(() => (
    <>
      <option value="new-ex">Create custom exercise</option>
      <option value="new-act">Create cardio activity</option>
      <option value="skip">Don&apos;t import</option>
      <optgroup label="Cardio">{activities?.map(a => <option key={a.id} value={`act:${a.id}`}>{a.name}</option>)}</optgroup>
      <optgroup label="Exercises">{exercises?.map(e => <option key={e.id} value={`ex:${e.id}`}>{e.displayName}</option>)}</optgroup>
    </>
  ), [exercises, activities]);

  const toReview = preview?.exercises.filter(e => !e.matched).length ?? 0;
  const weightedDistance = preview?.exercises.filter(e => e.hasWeightedDistance).map(e => e.name) ?? [];

  return (
    <div className="page page-narrow">
      <Link href="/settings" className="view-all-link"><Icon name="back" size={12} /> Settings</Link>
      <div className="dash-header" style={{ marginTop: 10 }}><div>
        <h1 className="dash-title">Import from Strong</h1>
        <p className="dash-subtitle">Export your data as a CSV from Strong&apos;s settings, then choose that file here.</p>
      </div></div>

      {err && <p className="form-error" style={{ marginBottom: 12 }}>{err}</p>}

      {result ? (
        <div className="card section">
          <div className="card-title" style={{ marginBottom: 12 }}>Import complete</div>
          <div className="summary-grid">
            <div><div className="stat-card-label">Workouts</div><div className="stat-card-value sm">{result.imported}</div></div>
            <div><div className="stat-card-label">Sets</div><div className="stat-card-value sm">{result.sets}</div></div>
            <div><div className="stat-card-label">Cardio</div><div className="stat-card-value sm">{result.cardio}</div></div>
            <div><div className="stat-card-label">Already had</div><div className="stat-card-value sm">{result.skipped}</div></div>
          </div>
          <p className="form-hint" style={{ marginTop: 14 }}>
            {result.createdExercises} custom exercises and {result.createdActivities} activities created.
            {result.createdExercises > 0 && " Set their muscles under Exercises so they count on the heatmap."}
            {result.distanceDropped > 0 && ` ${result.distanceDropped} distances on weighted sets were left out, because lifting sets don't store distance.`}
          </p>
          <div className="flex gap-2" style={{ marginTop: 14 }}>
            <Link href="/history" className="btn-primary">View history</Link>
            <button className="btn-secondary" onClick={() => setResult(null)}>Import another</button>
          </div>
        </div>
      ) : !preview ? (
        <label className="card section import-drop">
          <Icon name="upload" size={24} />
          <span className="row-title">{busy ? "Reading…" : "Choose your Strong CSV"}</span>
          <span className="form-hint">Nothing is saved until you confirm on the next screen.</span>
          <input type="file" accept=".csv,text/csv" disabled={busy} onChange={e => { choose(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      ) : (
        <>
          <div className="card section">
            <div className="row-top"><span className="card-title">{fileName}</span><span className="row-sub">{fmtDate(preview.from)} – {fmtDate(preview.to)}</span></div>
            <div className="summary-grid" style={{ marginTop: 12 }}>
              <div><div className="stat-card-label">Workouts</div><div className="stat-card-value sm">{preview.workouts}</div></div>
              <div><div className="stat-card-label">New</div><div className="stat-card-value sm">{preview.newWorkouts}</div></div>
              <div><div className="stat-card-label">Already imported</div><div className="stat-card-value sm">{preview.duplicates}</div></div>
              <div><div className="stat-card-label">Sets</div><div className="stat-card-value sm">{preview.sets}</div></div>
              <div><div className="stat-card-label">Exercises</div><div className="stat-card-value sm">{preview.exercises.length}</div></div>
            </div>
            {preview.sameFileImported && <p className="form-hint" style={{ marginTop: 10 }}>You&apos;ve imported this exact file before.</p>}
            {preview.badDates > 0 && <p className="form-error" style={{ marginTop: 10 }}>{preview.badDates} workouts have a date that can&apos;t be read and will be left out.</p>}
            {(preview.ignoredRows > 0 || preview.emptySets > 0) && <p className="form-hint" style={{ marginTop: 10 }}>{preview.emptySets} empty sets and {preview.ignoredRows} unrecognised rows will be left out.</p>}
            {weightedDistance.length > 0 && <p className="form-hint" style={{ marginTop: 10 }}>Distance on weighted sets won&apos;t be kept: {weightedDistance.join(", ")}.</p>}
          </div>

          <div className="card section">
            <div className="card-title" style={{ marginBottom: 4 }}>Units in this file</div>
            <p className="form-hint">Strong exports whatever units the app was set to. Your heaviest set in the file is <b>{preview.heaviest}</b>, which may help you tell.</p>
            <div className="settings-row">
              <div className="settings-label">Weight{preview.heaviest > 0 && <span className="row-sub"> · {preview.heaviest} {wu}</span>}</div>
              <div className="seg">{(["lb", "kg"] as const).map(u => <button key={u} className={wu === u ? "on" : ""} onClick={() => setWu(u)}>{u}</button>)}</div>
            </div>
            <div className="settings-row">
              <div className="settings-label">Distance</div>
              <div className="seg">{(["mi", "km"] as const).map(u => <button key={u} className={du === u ? "on" : ""} onClick={() => setDu(u)}>{u}</button>)}</div>
            </div>
          </div>

          <div className="card section">
            <div className="card-header">
              <span className="card-title">Exercise matching</span>
              <span className="row-sub">{toReview ? `${toReview} new` : "all matched"}</span>
            </div>
            <p className="form-hint" style={{ marginBottom: 8 }}>New ones are listed first and will be created for you. Change any match you disagree with.</p>
            {preview.exercises.map(e => (
              <div key={e.name} className="map-row">
                <div>
                  {e.name}
                  <div className="row-sub">{e.sets} {e.shape === "cardio" ? "entries" : "sets"} · {e.workouts} workouts{!e.matched && <span className="new"> · new</span>}</div>
                </div>
                <select className="form-select" aria-label={`Match for ${e.name}`} value={mapping[e.name] ?? e.target} onChange={x => setMapping({ ...mapping, [e.name]: x.target.value })}>{options}</select>
              </div>
            ))}
          </div>

          <div className="flex gap-2" style={{ marginBottom: 28 }}>
            <button className="btn-primary" disabled={busy || !preview.newWorkouts} onClick={runImport}>{busy ? "Importing…" : `Import ${preview.newWorkouts} workouts`}</button>
            <button className="btn-secondary" disabled={busy} onClick={() => setPreview(null)}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
