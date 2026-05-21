"use client";

import Link from "next/link";
import Navigation from "../../../components/Navigation";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface SetRow { reps: string; weight: string; duration: string }
interface ExerciseRow { name: string; muscleGroup: string; sets: SetRow[] }
interface RecentExercise {
  exercise_name: string; muscle_group: string;
  lastSets: { reps: number | null; weight_kg: number | null }[];
}

const MUSCLE_GROUPS = [
  "chest", "back", "shoulders", "biceps", "triceps",
  "forearms", "core", "quads", "hamstrings", "glutes", "calves", "full body",
];

const EXERCISE_PRESETS: Record<string, string[]> = {
  chest: ["Bench Press", "Incline Bench Press", "Push-Up", "Cable Fly", "Dumbbell Fly", "Chest Dip"],
  back: ["Pull-Up", "Barbell Row", "Lat Pulldown", "Seated Row", "Deadlift", "T-Bar Row", "Face Pull"],
  shoulders: ["Overhead Press", "Lateral Raise", "Front Raise", "Arnold Press", "Rear Delt Fly", "Upright Row"],
  biceps: ["Barbell Curl", "Dumbbell Curl", "Hammer Curl", "Preacher Curl", "Concentration Curl", "Cable Curl"],
  triceps: ["Tricep Pushdown", "Skull Crusher", "Overhead Extension", "Dips", "Close-Grip Bench", "Diamond Push-Up"],
  quads: ["Squat", "Leg Press", "Leg Extension", "Lunge", "Bulgarian Split Squat", "Hack Squat"],
  hamstrings: ["Romanian Deadlift", "Leg Curl", "Good Morning", "Nordic Curl", "Stiff-Leg Deadlift"],
  glutes: ["Hip Thrust", "Glute Bridge", "Cable Kickback", "Sumo Deadlift", "Step-Up"],
  calves: ["Calf Raise", "Seated Calf Raise", "Box Jump", "Jump Rope"],
  core: ["Plank", "Crunch", "Ab Wheel", "Russian Twist", "Hanging Leg Raise", "Dead Bug", "Bird Dog"],
  forearms: ["Wrist Curl", "Farmer Carry", "Reverse Curl", "Plate Pinch"],
  "full body": ["Burpee", "Kettlebell Swing", "Clean and Press", "Thruster", "Turkish Get-Up"],
};

function emptySet(): SetRow { return { reps: "", weight: "", duration: "" }; }
function emptyExercise(): ExerciseRow { return { name: "", muscleGroup: "", sets: [emptySet()] }; }

function calcVolume(sets: SetRow[]): number {
  return sets.reduce((sum, s) => {
    const r = parseInt(s.reps) || 0;
    const w = parseFloat(s.weight) || 0;
    return sum + r * w;
  }, 0);
}

function epley1RM(reps: number, weight: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

export default function LogStrengthPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [durationH, setDurationH] = useState("0");
  const [durationM, setDurationM] = useState("");
  const [durationS, setDurationS] = useState("0");
  const [notes, setNotes] = useState("");
  const [calories, setCalories] = useState("");
  const [exercises, setExercises] = useState<ExerciseRow[]>([emptyExercise()]);
  const [showPresets, setShowPresets] = useState<number | null>(null);
  const [recentExercises, setRecentExercises] = useState<RecentExercise[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetch("/api/exercises")
      .then((r) => r.ok ? r.json() : [])
      .then(setRecentExercises)
      .catch(() => {});
  }, []);

  const updateExercise = useCallback((i: number, field: keyof ExerciseRow, value: string) => {
    setExercises((prev) => prev.map((ex, idx) => idx === i ? { ...ex, [field]: value } : ex));
  }, []);

  function updateSet(exIdx: number, setIdx: number, field: keyof SetRow, value: string) {
    setExercises((prev) =>
      prev.map((ex, i) => i !== exIdx ? ex : {
        ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: value }),
      })
    );
  }

  function addSet(exIdx: number) {
    setExercises((prev) =>
      prev.map((ex, i) => {
        if (i !== exIdx) return ex;
        const lastSet = ex.sets[ex.sets.length - 1];
        return { ...ex, sets: [...ex.sets, { ...lastSet }] };
      })
    );
  }

  function removeSet(exIdx: number, setIdx: number) {
    setExercises((prev) =>
      prev.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) })
    );
  }

  function addExercise() { setExercises((prev) => [...prev, emptyExercise()]); }
  function removeExercise(i: number) { setExercises((prev) => prev.filter((_, idx) => idx !== i)); }

  function pickPreset(exIdx: number, name: string) {
    updateExercise(exIdx, "name", name);
    setShowPresets(null);
  }

  function quickAddRecent(recent: RecentExercise) {
    const lastSets = recent.lastSets.map((s) => ({
      reps: s.reps != null ? String(s.reps) : "",
      weight: s.weight_kg != null ? String(s.weight_kg) : "",
      duration: "",
    }));
    setExercises((prev) => [...prev, {
      name: recent.exercise_name,
      muscleGroup: recent.muscle_group || "",
      sets: lastSets.length > 0 ? lastSets : [emptySet()],
    }]);
    setShowHistory(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (exercises.every((ex) => !ex.name.trim())) { setError("Add at least one exercise"); return; }
    setSaving(true); setError("");

    const durationSeconds =
      parseInt(durationH || "0") * 3600 + parseInt(durationM || "0") * 60 + parseInt(durationS || "0");

    const body = {
      type: "strength",
      title: title || "Strength Session",
      started_at: new Date(date).toISOString(),
      duration_seconds: durationSeconds,
      calories: calories ? parseInt(calories) : null,
      notes,
      source: "manual",
      exercises: exercises.filter((ex) => ex.name.trim()).map((ex, i) => ({
        exercise_name: ex.name.trim(),
        muscle_group: ex.muscleGroup,
        order_index: i,
        sets: ex.sets.filter((s) => s.reps || s.weight || s.duration).map((s, j) => ({
          set_number: j + 1,
          reps: s.reps ? parseInt(s.reps) : null,
          weight_kg: s.weight ? parseFloat(s.weight) : null,
          duration_seconds: s.duration ? parseInt(s.duration) : null,
        })),
      })),
    };

    try {
      const res = await fetch("/api/workouts", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/workouts/${data.id}`);
      } else {
        setError((await res.json()).message || "Failed to save");
      }
    } catch { setError("Network error"); }
    setSaving(false);
  }

  const totalVolume = exercises.reduce((sum, ex) => sum + calcVolume(ex.sets), 0);

  return (
    <div>
      <Navigation />
      <div className="log-workout-page">
        <Link href="/workouts/log" className="back-link">← Log Workout</Link>
        <div className="section-eyebrow">Strength</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 24 }}>Log Strength Session</h1>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {error && <p className="form-error">{error}</p>}

          <div className="form-group">
            <label className="form-label">Title (optional)</label>
            <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Push Day, Leg Day, Full Body…" />
          </div>

          <div className="form-group">
            <label className="form-label">Date & Time</label>
            <input className="form-input" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Duration</label>
              <div style={{ display: "flex", gap: 4 }}>
                <input className="form-input" type="number" min="0" max="23" value={durationH} onChange={(e) => setDurationH(e.target.value)} placeholder="h" style={{ width: 60 }} />
                <input className="form-input" type="number" min="0" max="59" value={durationM} onChange={(e) => setDurationM(e.target.value)} placeholder="m" required />
                <input className="form-input" type="number" min="0" max="59" value={durationS} onChange={(e) => setDurationS(e.target.value)} placeholder="s" style={{ width: 60 }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Calories</label>
              <input className="form-input" type="number" min="0" value={calories} onChange={(e) => setCalories(e.target.value)} placeholder="—" />
            </div>
          </div>

          {/* Exercises */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text)" }}>
                Exercises
                {totalVolume > 0 && (
                  <span className="volume-badge" style={{ marginLeft: 10, fontSize: 11 }}>
                    {totalVolume >= 1000 ? (totalVolume / 1000).toFixed(1) + "t" : Math.round(totalVolume) + " kg"} total
                  </span>
                )}
              </div>
              {recentExercises.length > 0 && (
                <button type="button" className="exercise-history-btn" onClick={() => setShowHistory(!showHistory)}>
                  {showHistory ? "Hide" : "Quick-add ▸"}
                </button>
              )}
            </div>

            {/* Recent exercise quick-add panel */}
            {showHistory && recentExercises.length > 0 && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border-bright)", borderRadius: "var(--radius)", padding: 12, marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <div style={{ width: "100%", fontSize: 11, color: "var(--text-subtle)", marginBottom: 4, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Recent exercises — click to add</div>
                {recentExercises.slice(0, 12).map((ex) => (
                  <button
                    key={ex.exercise_name}
                    type="button"
                    onClick={() => quickAddRecent(ex)}
                    style={{
                      padding: "6px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600,
                      border: "1px solid var(--border-bright)", background: "var(--surface-2)",
                      color: "var(--text-muted)", cursor: "pointer", transition: "all 0.15s",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary-light)"; e.currentTarget.style.color = "var(--primary-light)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-bright)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                  >
                    {ex.exercise_name}
                    {ex.lastSets[0]?.weight_kg && (
                      <span style={{ marginLeft: 4, fontSize: 10, color: "var(--accent-cyan)" }}>
                        {ex.lastSets[0].weight_kg}kg
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {exercises.map((ex, exIdx) => {
                const vol = calcVolume(ex.sets);
                const bestSet = ex.sets.reduce((best, s) => {
                  const r = parseInt(s.reps) || 0;
                  const w = parseFloat(s.weight) || 0;
                  const est = epley1RM(r, w);
                  return est > best ? est : best;
                }, 0);

                return (
                  <div key={exIdx} className="exercise-block">
                    <div className="exercise-block-header">
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <div style={{ flex: 1, position: "relative" }}>
                            <input
                              className="form-input"
                              value={ex.name}
                              onChange={(e) => updateExercise(exIdx, "name", e.target.value)}
                              placeholder="Exercise name…"
                              onFocus={() => setShowPresets(exIdx)}
                            />
                            {showPresets === exIdx && ex.muscleGroup && EXERCISE_PRESETS[ex.muscleGroup] && (
                              <div style={{
                                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                                background: "var(--surface-2)", border: "1px solid var(--border-bright)",
                                borderRadius: "var(--radius)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                                maxHeight: 200, overflowY: "auto",
                              }}>
                                {EXERCISE_PRESETS[ex.muscleGroup].map((preset) => (
                                  <div key={preset} onClick={() => pickPreset(exIdx, preset)} style={{
                                    padding: "9px 14px", cursor: "pointer", fontSize: 14,
                                    color: "var(--text)", borderBottom: "1px solid var(--border)",
                                  }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(168,85,247,0.15)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                                    {preset}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {vol > 0 && <span className="volume-badge">{Math.round(vol)} kg</span>}
                            {exercises.length > 1 && (
                              <button type="button" onClick={() => removeExercise(exIdx)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>✕</button>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <select
                            className="form-input"
                            value={ex.muscleGroup}
                            onChange={(e) => { updateExercise(exIdx, "muscleGroup", e.target.value); setShowPresets(null); }}
                            style={{ fontSize: 13, flex: 1 }}
                          >
                            <option value="">Muscle group (optional)</option>
                            {MUSCLE_GROUPS.map((g) => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
                          </select>
                          {bestSet > 0 && (
                            <div style={{ fontSize: 11, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                              est. 1RM: {bestSet} kg
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <table className="sets-table" style={{ marginTop: 0 }}>
                      <thead>
                        <tr>
                          <th>Set</th>
                          <th>Reps</th>
                          <th>Weight (kg)</th>
                          <th>Time (s)</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ex.sets.map((s, setIdx) => (
                          <tr key={setIdx}>
                            <td style={{ color: "var(--text-subtle)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{setIdx + 1}</td>
                            <td>
                              <input type="number" min="0" max="999" value={s.reps}
                                onChange={(e) => updateSet(exIdx, setIdx, "reps", e.target.value)}
                                placeholder="—"
                                style={{ width: 60, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 6px", color: "var(--text)", fontSize: 13, textAlign: "center" }} />
                            </td>
                            <td>
                              <input type="number" min="0" step="0.5" value={s.weight}
                                onChange={(e) => updateSet(exIdx, setIdx, "weight", e.target.value)}
                                placeholder="BW"
                                style={{ width: 72, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 6px", color: "var(--text)", fontSize: 13, textAlign: "center" }} />
                            </td>
                            <td>
                              <input type="number" min="0" value={s.duration}
                                onChange={(e) => updateSet(exIdx, setIdx, "duration", e.target.value)}
                                placeholder="—"
                                style={{ width: 60, background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, padding: "4px 6px", color: "var(--text)", fontSize: 13, textAlign: "center" }} />
                            </td>
                            <td>
                              {ex.sets.length > 1 && (
                                <button type="button" onClick={() => removeSet(exIdx, setIdx)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 14 }}>✕</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div style={{ padding: "8px 12px" }}>
                      <button type="button" onClick={() => addSet(exIdx)} className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}>
                        + Add Set
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="button" onClick={addExercise} className="btn btn-secondary" style={{ marginTop: 16, width: "100%" }}>
              + Add Exercise
            </button>
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How did it feel? PRs, adjustments…" style={{ minHeight: 80 }} />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? "Saving…" : "Save Workout"}
          </button>
        </form>
      </div>
    </div>
  );
}
