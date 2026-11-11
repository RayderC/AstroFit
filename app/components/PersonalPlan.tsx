"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { MUSCLES } from "@/lib/exerciseSeed";
import type { CoachProfile } from "@/lib/types";
import { kgTo, toKg, trim, type WeightUnit } from "@/lib/units";

const LEVEL = { beginner: "Newer lifter", intermediate: "Intermediate", advanced: "Experienced" };
const BAND = { lean: "lean", fit: "fit", average: "average", high: "on the high side" };

/** "About you" and what the builder read from your log, shown when "Base it on me" is ticked. */
export default function PersonalPlan({ profile, unit, today, onSaved }: {
  profile: CoachProfile;
  unit: WeightUnit;
  today: string;
  onSaved: (p: CoachProfile) => void;
}) {
  const a = profile.about, s = profile.stats, r = profile.recommendation;
  const imperial = unit === "lb";
  const [ft, setFt] = useState(""), [inch, setInch] = useState(""), [cm, setCm] = useState("");
  const [sex, setSex] = useState(""), [year, setYear] = useState("");
  const [weight, setWeight] = useState(""), [fat, setFat] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // Fill the form from what's saved whenever that changes.
  useEffect(() => {
    if (a.heightCm) {
      const totalIn = a.heightCm / 2.54;
      setFt(String(Math.floor(totalIn / 12))); setInch(trim(totalIn % 12, 0)); setCm(trim(a.heightCm, 0));
    }
    setSex(a.sex ?? ""); setYear(a.birthYear ? String(a.birthYear) : "");
    setWeight(a.weightKg ? trim(kgTo(a.weightKg, unit), 1) : ""); setFat(a.bodyFatPct ? trim(a.bodyFatPct, 1) : "");
    // Ask for anything missing straight away.
    setEditing(!a.heightCm || a.weightKg === null);
  }, [a.heightCm, a.sex, a.birthYear, a.weightKg, a.bodyFatPct, unit]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const heightCm = imperial
        ? (ft || inch ? ((Number(ft) || 0) * 12 + (Number(inch) || 0)) * 2.54 : null)
        : (cm ? Number(cm) : null);
      const p = await api<CoachProfile>("/api/builder/profile", { method: "PUT", body: {
        today, heightCm, sex: sex || null, birthYear: year ? Number(year) : null,
        weightKg: weight ? toKg(Number(weight), unit) : null, bodyFatPct: fat ? Number(fat) : null,
      } });
      setEditing(false);
      onSaved(p);
    } catch (x) { setErr((x as Error).message); }
    finally { setBusy(false); }
  }

  const age = a.birthYear ? Number(today.slice(0, 4)) - a.birthYear : null;
  const height = a.heightCm ? (imperial ? `${Math.floor(a.heightCm / 2.54 / 12)}′${Math.round((a.heightCm / 2.54) % 12)}″` : `${Math.round(a.heightCm)} cm`) : null;
  const facts = [
    a.weightKg !== null && `${trim(kgTo(a.weightKg, unit), 1)} ${unit}`,
    height,
    a.bodyFatPct !== null && `${trim(a.bodyFatPct, 1)}% body fat${r.fatBand ? ` (${BAND[r.fatBand]})` : ""}`,
    age !== null && `${age} years old`,
    r.bmi !== null && `BMI ${r.bmi}`,
    r.ffmi !== null && `FFMI ${r.ffmi}`,
  ].filter(Boolean) as string[];
  const topMuscles = MUSCLES.map(m => ({ label: m.label, n: s.weeklySets[m.id] ?? 0 })).filter(m => m.n > 0).sort((x, y) => y.n - x.n).slice(0, 4);

  return (
    <div className="personal">
      <div className="personal-head">
        <span className="form-label">About you</span>
        {!editing && <button type="button" className="link-btn" onClick={() => setEditing(true)}>Edit</button>}
      </div>
      {editing ? (
        <form className="form-stack" onSubmit={save}>
          <div className="form-grid-2">
            {imperial ? (
              <div className="form-group">
                <label className="form-label">Height</label>
                <div className="height-ftin">
                  <input className="form-input" inputMode="numeric" aria-label="Feet" placeholder="ft" value={ft} onChange={e => setFt(e.target.value)} />
                  <input className="form-input" inputMode="decimal" aria-label="Inches" placeholder="in" value={inch} onChange={e => setInch(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="form-group"><label className="form-label" htmlFor="pp-cm">Height (cm)</label><input id="pp-cm" className="form-input" inputMode="decimal" value={cm} onChange={e => setCm(e.target.value)} /></div>
            )}
            <div className="form-group"><label className="form-label" htmlFor="pp-w">Weight ({unit})</label><input id="pp-w" className="form-input" inputMode="decimal" value={weight} onChange={e => setWeight(e.target.value)} /></div>
            <div className="form-group"><label className="form-label" htmlFor="pp-bf">Body fat %</label><input id="pp-bf" className="form-input" inputMode="decimal" placeholder="Optional" value={fat} onChange={e => setFat(e.target.value)} /></div>
            <div className="form-group"><label className="form-label" htmlFor="pp-y">Birth year</label><input id="pp-y" className="form-input" inputMode="numeric" placeholder="Optional" value={year} onChange={e => setYear(e.target.value)} /></div>
            <div className="form-group">
              <label className="form-label" htmlFor="pp-sex">Sex</label>
              <select id="pp-sex" className="form-select" value={sex} onChange={e => setSex(e.target.value)}>
                <option value="">Prefer not to say</option><option value="male">Male</option><option value="female">Female</option>
              </select>
            </div>
          </div>
          <p className="form-hint">Weight and body fat go in your body log for today when they change. Sex is only used to read your body fat.</p>
          {err && <p className="form-error">{err}</p>}
          <button className="btn-secondary" disabled={busy}>{busy ? "Saving…" : "Save and update the plan"}</button>
        </form>
      ) : (
        <p className="personal-facts">{facts.length ? facts.join(" · ") : "Nothing yet."}</p>
      )}

      <div className="personal-head" style={{ marginTop: 14 }}><span className="form-label">From your log</span></div>
      {s.totalSessions === 0 ? <p className="form-hint">No finished workouts yet, so the plan starts from the basics.</p> : (
        <div className="personal-stats">
          <div><b>{s.sessionsPerWeek}</b><span>workouts a week</span></div>
          <div><b>{s.trainingMonths < 1 ? "<1" : Math.round(s.trainingMonths)}</b><span>months training</span></div>
          <div><b>{s.cardioMinutesPerWeek}</b><span>cardio min a week</span></div>
          <div><b>{LEVEL[r.level]}</b><span>{s.totalSessions} workouts logged</span></div>
        </div>
      )}
      {topMuscles.length > 0 && <p className="form-hint">Most trained lately: {topMuscles.map(m => `${m.label} ${m.n}`).join(", ")} sets a week.</p>}

      <div className="personal-head" style={{ marginTop: 14 }}><span className="form-label">Why this plan</span></div>
      <ul className="personal-why">{r.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
      <p className="form-hint">The settings below are filled in from this. Change anything you like.</p>
    </div>
  );
}
