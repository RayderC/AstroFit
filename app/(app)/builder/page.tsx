"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/app/components/Icon";
import RoutineEditor from "@/app/components/RoutineEditor";
import { api, useApi } from "@/lib/client";
import { EQUIPMENT, MUSCLES } from "@/lib/exerciseSeed";
import type { ActivityDTO, RoutineBlockDTO } from "@/lib/types";

type Goal = "strength" | "muscle" | "general";

const GOALS: { id: Goal; label: string; hint: string }[] = [
  { id: "strength", label: "Strength", hint: "Heavy, low reps, long rest" },
  { id: "muscle", label: "Muscle", hint: "Moderate weight, 6–15 reps" },
  { id: "general", label: "General fitness", hint: "Fewer sets, shorter rest" },
];

const FOCUSES = [
  { id: "full", label: "Full body" },
  { id: "upper", label: "Upper" },
  { id: "lower", label: "Lower" },
  { id: "push", label: "Push" },
  { id: "pull", label: "Pull" },
  { id: "legs", label: "Legs" },
];

// Bodyweight is always available; the builder adds it on the server.
const EQUIPMENT_CHOICES = EQUIPMENT.filter(e => e.id !== "bodyweight");
const DEFAULT_EQUIPMENT = ["barbell", "dumbbell", "cable", "machine"];
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0];
const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function BuilderPage() {
  const [tab, setTab] = useState<"workout" | "program">("workout");
  return (
    <div className="page page-narrow">
      <div className="dash-header"><div>
        <h1 className="dash-title">Builder</h1>
        <p className="dash-subtitle">Generate one workout or a full weekly program, then edit anything you like.</p>
      </div></div>
      <div className="tabs">
        <button className={`tab ${tab === "workout" ? "active" : ""}`} onClick={() => setTab("workout")}>One workout</button>
        <button className={`tab ${tab === "program" ? "active" : ""}`} onClick={() => setTab("program")}>Program</button>
      </div>
      {/* Both stay mounted so switching tabs doesn't throw away a preview you've edited. */}
      <div hidden={tab !== "workout"}><WorkoutTab /></div>
      <div hidden={tab !== "program"}><ProgramTab /></div>
    </div>
  );
}

function GoalPicker({ value, onChange }: { value: Goal; onChange: (g: Goal) => void }) {
  return (
    <div className="form-group">
      <label className="form-label">Goal</label>
      <div className="chip-wrap">
        {GOALS.map(g => <button key={g.id} type="button" className={`filter-chip ${value === g.id ? "active" : ""}`} onClick={() => onChange(g.id)}>{g.label}</button>)}
      </div>
      <p className="form-hint">{GOALS.find(g => g.id === value)?.hint}</p>
    </div>
  );
}

function EquipmentPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="form-group">
      <label className="form-label">Equipment</label>
      <div className="chip-wrap">
        {EQUIPMENT_CHOICES.map(e => (
          <button key={e.id} type="button" className={`filter-chip ${value.includes(e.id) ? "active" : ""}`}
            onClick={() => onChange(value.includes(e.id) ? value.filter(x => x !== e.id) : [...value, e.id])}>{e.label}</button>
        ))}
      </div>
      <p className="form-hint">Bodyweight exercises are always included.</p>
    </div>
  );
}

function MinutesInput({ value, onChange, min, label = "Minutes" }: { value: number; onChange: (n: number) => void; min: number; label?: string }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}: <b className="text-cyan">{value}</b></label>
      <input type="range" className="range-input" min={min} max={120} step={5} value={value} onChange={e => onChange(Number(e.target.value))} />
    </div>
  );
}

// ── One workout ──────────────────────────────────────────────────────────────

function WorkoutTab() {
  const router = useRouter();
  const [focus, setFocus] = useState("full");
  const [minutes, setMinutes] = useState(60);
  const [equipment, setEquipment] = useState(DEFAULT_EQUIPMENT);
  const [goal, setGoal] = useState<Goal>("muscle");
  const [seed, setSeed] = useState(0);
  const [plan, setPlan] = useState<{ name: string; blocks: RoutineBlockDTO[]; gen: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function generate(nextSeed: number) {
    setBusy(true); setErr("");
    try {
      const r = await api<{ name: string; blocks: RoutineBlockDTO[] }>("/api/builder/workout", { body: { focus, minutes, equipment, goal, seed: nextSeed } });
      setSeed(nextSeed);
      // gen remounts the editor so its uncontrolled rest/weight inputs start fresh
      setPlan(p => ({ ...r, gen: (p?.gen ?? 0) + 1 }));
      if (!r.blocks.length) setErr("Nothing matches that focus with this equipment. Try adding more equipment.");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function startNow() {
    if (!plan) return;
    setBusy(true); setErr("");
    try {
      const s = await api<{ id: number }>("/api/sessions", { body: { name: plan.name, blocks: plan.blocks } });
      router.push(`/session/${s.id}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  async function saveRoutine() {
    if (!plan) return;
    setBusy(true); setErr("");
    try {
      const r = await api<{ id: number }>("/api/routines", { body: { name: plan.name, blocks: plan.blocks } });
      router.push(`/routines/${r.id}`);
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  const muscleFocus = focus.startsWith("muscle:") ? focus.slice(7) : "";

  return (
    <div>
      <div className="card section">
        <div className="form-stack">
          <div className="form-group">
            <label className="form-label">Focus</label>
            <div className="chip-wrap">
              {FOCUSES.map(f => <button key={f.id} type="button" className={`filter-chip ${focus === f.id ? "active" : ""}`} onClick={() => setFocus(f.id)}>{f.label}</button>)}
            </div>
            <select className="form-select" style={{ marginTop: 8 }} value={muscleFocus} aria-label="Focus on one muscle"
              onChange={e => setFocus(e.target.value ? `muscle:${e.target.value}` : "full")}>
              <option value="">…or one muscle</option>
              {MUSCLES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </div>
          <MinutesInput value={minutes} onChange={setMinutes} min={20} />
          <EquipmentPicker value={equipment} onChange={setEquipment} />
          <GoalPicker value={goal} onChange={setGoal} />
          <button className="btn-primary" disabled={busy} onClick={() => generate(0)}><Icon name="builder" size={14} /> Build workout</button>
        </div>
      </div>

      {err && <p className="form-error" style={{ marginBottom: 12 }}>{err}</p>}

      {plan && plan.blocks.length > 0 && (
        <div className="section">
          <div className="section-header">
            <input className="form-input routine-name" aria-label="Workout name" value={plan.name} onChange={e => setPlan({ ...plan, name: e.target.value })} />
            <button className="btn-secondary btn-sm" style={{ marginLeft: 8, whiteSpace: "nowrap" }} disabled={busy} onClick={() => generate(seed + 1)}><Icon name="swap" size={14} /> Regenerate</button>
          </div>
          <RoutineEditor key={plan.gen} blocks={plan.blocks} onChange={blocks => setPlan({ ...plan, blocks })} />
          <div className="flex gap-2" style={{ marginTop: 18, flexWrap: "wrap" }}>
            <button className="btn-primary" disabled={busy || !plan.blocks.length} onClick={startNow}><Icon name="play" size={14} /> Start now</button>
            <button className="btn-secondary" disabled={busy || !plan.blocks.length} onClick={saveRoutine}>Save as routine</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Program ──────────────────────────────────────────────────────────────────

type DayPlan = { weekday: number; name: string; blocks: RoutineBlockDTO[]; key: number };
type ProgramPlan = { name: string; split: string; days: DayPlan[] };
type SavedProgram = {
  id: number; name: string; goal: string; active: boolean; createdAt: string;
  days: { weekday: number; routineId: number; name: string }[];
};

function ProgramTab() {
  const { data: activities } = useApi<ActivityDTO[]>("/api/activity-types");
  const { data: programs, reload } = useApi<SavedProgram[]>("/api/programs");
  const [goal, setGoal] = useState<Goal>("muscle");
  const [days, setDays] = useState(4);
  const [minutes, setMinutes] = useState(60);
  const [equipment, setEquipment] = useState(DEFAULT_EQUIPMENT);
  const [cardioDays, setCardioDays] = useState(0);
  const [cardioMinutes, setCardioMinutes] = useState(30);
  const [activityTypeId, setActivityTypeId] = useState<number | null>(null);
  const [plan, setPlan] = useState<ProgramPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (activityTypeId == null && activities?.length) setActivityTypeId(activities[0].id);
  }, [activities, activityTypeId]);

  const config = { goal, days, minutes, equipment, cardioDays, cardioMinutes, activityTypeId: cardioDays > 0 ? activityTypeId : null };

  async function generate() {
    setBusy(true); setErr(""); setMsg("");
    try {
      const r = await api<Omit<ProgramPlan, "days"> & { days: Omit<DayPlan, "key">[] }>("/api/builder/program", { body: config });
      setPlan({ ...r, days: r.days.map(d => ({ ...d, key: Math.random() })) });
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const setDay = (i: number, p: Partial<DayPlan>) => plan && setPlan({ ...plan, days: plan.days.map((d, j) => (j === i ? { ...d, ...p } : d)) });

  /** Each weekday holds one routine, so moving a day onto a taken weekday swaps the two. */
  function moveDay(i: number, weekday: number) {
    if (!plan) return;
    const from = plan.days[i].weekday;
    const days = plan.days.map((d, j) => j === i ? { ...d, weekday } : d.weekday === weekday ? { ...d, weekday: from } : d);
    setPlan({ ...plan, days: days.sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7)) });
  }

  async function save() {
    if (!plan) return;
    if (plan.days.some(d => !d.blocks.length)) return setErr("Every day needs at least one exercise.");
    setBusy(true); setErr("");
    try {
      await api("/api/programs", { body: { name: plan.name, goal, config, days: plan.days.map(({ weekday, name, blocks }) => ({ weekday, name, blocks })) } });
      setPlan(null);
      setMsg("Program saved and active. Today now shows it.");
      await reload();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function setActive(p: SavedProgram, active: boolean) {
    setErr("");
    try { await api(`/api/programs/${p.id}`, { method: "PATCH", body: { active } }); await reload(); }
    catch (e) { setErr((e as Error).message); }
  }

  async function remove(p: SavedProgram) {
    if (!confirm(`Delete “${p.name}” and its routines? Logged workouts stay in your history.`)) return;
    setErr("");
    try { await api(`/api/programs/${p.id}`, { method: "DELETE" }); await reload(); }
    catch (e) { setErr((e as Error).message); }
  }

  return (
    <div>
      <div className="card section">
        <div className="form-stack">
          <GoalPicker value={goal} onChange={setGoal} />
          <div className="form-group">
            <label className="form-label">Lifting days per week</label>
            <div className="seg">{[2, 3, 4, 5, 6].map(n => <button key={n} type="button" className={days === n ? "on" : ""} onClick={() => setDays(n)}>{n}</button>)}</div>
            <p className="form-hint">{days <= 3 ? "Full body" : days === 4 ? "Upper / lower" : days === 5 ? "Push / pull / legs + upper / lower" : "Push / pull / legs twice"}</p>
          </div>
          <MinutesInput value={minutes} onChange={setMinutes} min={30} label="Minutes per session" />
          <EquipmentPicker value={equipment} onChange={setEquipment} />
          <div className="form-group">
            <label className="form-label">Cardio days per week</label>
            <div className="seg">{[0, 1, 2, 3, 4].map(n => <button key={n} type="button" className={cardioDays === n ? "on" : ""} onClick={() => setCardioDays(n)}>{n}</button>)}</div>
          </div>
          {cardioDays > 0 && (
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">Activity</label>
                <select className="form-select" value={activityTypeId ?? ""} onChange={e => setActivityTypeId(Number(e.target.value))}>
                  {activities?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Minutes</label>
                <input className="form-input" type="number" min={10} max={90} step={5} value={cardioMinutes} onChange={e => setCardioMinutes(Number(e.target.value))} />
              </div>
            </div>
          )}
          <button className="btn-primary" disabled={busy} onClick={generate}><Icon name="builder" size={14} /> {plan ? "Rebuild program" : "Build program"}</button>
        </div>
      </div>

      {err && <p className="form-error" style={{ marginBottom: 12 }}>{err}</p>}
      {msg && <p className="text-cyan" style={{ marginBottom: 12, fontSize: 13 }}>{msg}</p>}

      {plan && (
        <div className="section">
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Program name</label>
            <input className="form-input routine-name" value={plan.name} onChange={e => setPlan({ ...plan, name: e.target.value })} />
          </div>
          {plan.days.map((d, i) => (
            <div key={d.key} className="card day-card">
              <div className="day-head" style={{ alignItems: "center" }}>
                <input className="form-input day-name" aria-label="Day name" value={d.name} onChange={e => setDay(i, { name: e.target.value })} />
                <select className="form-select weekday-select" aria-label={`Weekday for ${d.name}`} value={d.weekday} onChange={e => moveDay(i, Number(e.target.value))}>
                  {WEEKDAYS.map(w => <option key={w} value={w}>{DOW[w]}</option>)}
                </select>
              </div>
              <RoutineEditor blocks={d.blocks} onChange={blocks => setDay(i, { blocks })} />
            </div>
          ))}
          <button className="btn-primary btn-full" disabled={busy} onClick={save}>Save program</button>
          <p className="form-hint" style={{ marginTop: 8 }}>Saving makes this your active program.</p>
        </div>
      )}

      <div className="section">
        <div className="section-label">Your programs</div>
        {!programs ? <div className="loading">Loading…</div> : programs.length === 0 ? (
          <div className="empty-state-desc">No programs yet.</div>
        ) : (
          <div className="row-list">
            {programs.map(p => (
              <div key={p.id} className="row-card">
                <div className="row-top">
                  <span className="row-title">{p.name}</span>
                  {p.active && <span className="badge badge-cyan">Active</span>}
                </div>
                <div className="program-days">
                  {p.days.map(d => (
                    <Link key={d.weekday} href={`/routines/${d.routineId}`} className="mini-chip">
                      {DOW[d.weekday].slice(0, 3)} · {d.name.replace(/^.*?—\s*/, "")}
                    </Link>
                  ))}
                </div>
                <div className="flex gap-2" style={{ marginTop: 10 }}>
                  {p.active
                    ? <button className="btn-secondary btn-sm" onClick={() => setActive(p, false)}>Deactivate</button>
                    : <button className="btn-secondary btn-sm" onClick={() => setActive(p, true)}>Activate</button>}
                  <button className="btn-danger btn-sm" onClick={() => remove(p)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
