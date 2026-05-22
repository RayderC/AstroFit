"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface WorkoutExercise {
  id: number;
  exercise_id: number;
  order_index: number;
  exercise_name: string;
  category: string;
  muscle_groups: string;
  notes: string | null;
}

interface WorkoutSet {
  id: number;
  workout_exercise_id: number;
  set_number: number;
  weight: number | null;
  reps: number | null;
  completed: number;
  is_warmup: number;
  rpe: number | null;
}

interface Workout {
  id: number;
  name: string;
  started_at: string;
  completed_at: string | null;
  exercises: WorkoutExercise[];
  sets: WorkoutSet[];
}

interface ExerciseResult {
  id: number;
  name: string;
  category: string;
  muscle_groups: string;
}

interface CompletionResult {
  xpEarned: number;
  prCount: number;
  streak: number;
}

interface SetRowState {
  weight: string;
  reps: string;
}

export default function WorkoutSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workoutId = Number(params?.id);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [restSeconds, setRestSeconds] = useState(0);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseResults, setExerciseResults] = useState<ExerciseResult[]>([]);
  const [completing, setCompleting] = useState(false);
  const [completionData, setCompletionData] = useState<CompletionResult | null>(null);
  const [setInputs, setSetInputs] = useState<Record<number, SetRowState>>({});
  const [savingSet, setSavingSet] = useState<number | null>(null);
  const [restDuration] = useState(90);

  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchWorkout = useCallback(async () => {
    const res = await fetch(`/api/workouts/${workoutId}`);
    if (res.status === 404) { router.push("/dashboard/workout"); return; }
    const data: Workout = await res.json();
    if (data.completed_at) { router.push("/dashboard/history"); return; }
    setWorkout(data);
    // Initialize input state for any sets that already have values
    setSetInputs(prev => {
      const next = { ...prev };
      for (const s of data.sets) {
        if (!next[s.id]) {
          next[s.id] = { weight: s.weight?.toString() ?? "", reps: s.reps?.toString() ?? "" };
        }
      }
      return next;
    });
    setLoading(false);
  }, [workoutId, router]);

  useEffect(() => { fetchWorkout(); }, [fetchWorkout]);

  // Elapsed timer
  useEffect(() => {
    if (!workout) return;
    const startMs = new Date(workout.started_at).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000));
    tick();
    elapsedRef.current = setInterval(tick, 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [workout?.started_at]);

  // Rest timer countdown
  useEffect(() => {
    if (!showRestTimer || restSeconds <= 0) return;
    restRef.current = setInterval(() => {
      setRestSeconds(s => {
        if (s <= 1) {
          clearInterval(restRef.current!);
          setShowRestTimer(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (restRef.current) clearInterval(restRef.current); };
  }, [showRestTimer]);

  // Exercise search with debounce
  useEffect(() => {
    if (!exerciseQuery.trim()) { setExerciseResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/exercises?q=${encodeURIComponent(exerciseQuery)}&limit=8`);
      if (res.ok) setExerciseResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [exerciseQuery]);

  const completeSet = async (setId: number) => {
    const inputs = setInputs[setId] ?? { weight: "", reps: "" };
    const weight = inputs.weight ? Number(inputs.weight) : null;
    const reps = inputs.reps ? Number(inputs.reps) : null;
    setSavingSet(setId);
    await fetch(`/api/workouts/${workoutId}/sets/${setId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight, reps, completed: true }),
    });
    setWorkout(prev => {
      if (!prev) return prev;
      return { ...prev, sets: prev.sets.map(s => s.id === setId ? { ...s, completed: 1, weight, reps } : s) };
    });
    setSavingSet(null);
    // Start rest timer
    setRestSeconds(restDuration);
    setShowRestTimer(true);
  };

  const uncompleteSet = async (setId: number) => {
    await fetch(`/api/workouts/${workoutId}/sets/${setId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    setWorkout(prev => {
      if (!prev) return prev;
      return { ...prev, sets: prev.sets.map(s => s.id === setId ? { ...s, completed: 0 } : s) };
    });
  };

  const addSet = async (weId: number) => {
    const res = await fetch(`/api/workouts/${workoutId}/sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workoutExerciseId: weId }),
    });
    const newSet: WorkoutSet = await res.json();
    setWorkout(prev => {
      if (!prev) return prev;
      return { ...prev, sets: [...prev.sets, newSet] };
    });
    setSetInputs(prev => ({ ...prev, [newSet.id]: { weight: "", reps: "" } }));
  };

  const addExercise = async (exerciseId: number) => {
    await fetch(`/api/workouts/${workoutId}/exercises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exerciseId }),
    });
    setShowAddExercise(false);
    setExerciseQuery("");
    setExerciseResults([]);
    await fetchWorkout();
  };

  const finishWorkout = async () => {
    const completedSets = workout?.sets.filter(s => s.completed).length ?? 0;
    if (completedSets === 0) {
      if (!confirm("No sets have been completed. Finish anyway?")) return;
    } else {
      if (!confirm(`Finish workout with ${completedSets} completed set${completedSets !== 1 ? "s" : ""}?`)) return;
    }
    setCompleting(true);
    const res = await fetch(`/api/workouts/${workoutId}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    setCompletionData(data);
    setCompleting(false);
  };

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const restPct = restSeconds / restDuration;
  const circumference = 2 * Math.PI * 52;

  if (loading) return <div className="loading">Loading workout...</div>;
  if (!workout) return null;

  if (completionData) {
    return (
      <div style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
        <div className="card" style={{ padding: "40px 32px" }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>Workout Complete!</h2>
          <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>{workout.name}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--xp-color)" }}>
                +{completionData.xpEarned}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>XP Earned</div>
            </div>
            <div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--primary-light)" }}>
                {completionData.prCount}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>New PRs</div>
            </div>
            <div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--accent-cyan)" }}>
                {completionData.streak}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Day Streak</div>
            </div>
          </div>
          {completionData.prCount > 0 && (
            <div style={{ background: "rgba(124,14,179,0.15)", border: "1px solid var(--primary)", borderRadius: 8, padding: "10px 16px", marginBottom: 20, fontSize: "0.9rem", color: "var(--primary-light)" }}>
              🏆 Personal record{completionData.prCount > 1 ? "s" : ""}! Check Progress for details.
            </div>
          )}
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button className="btn-secondary" onClick={() => router.push("/dashboard/history")}>
              History
            </button>
            <button className="btn-primary" onClick={() => router.push("/dashboard/workout")}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  const exerciseSets = (weId: number) => workout.sets.filter(s => s.workout_exercise_id === weId);

  return (
    <div style={{ maxWidth: 680, paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700 }}>{workout.name}</h1>
          <div style={{ fontSize: "0.9rem", color: "var(--accent-cyan)", fontVariantNumeric: "tabular-nums" }}>
            {formatElapsed(elapsed)}
          </div>
        </div>
        <button className="btn-success" onClick={finishWorkout} disabled={completing} style={{ minWidth: 120 }}>
          {completing ? "Saving..." : "Finish"}
        </button>
      </div>

      {/* Exercise blocks */}
      {workout.exercises.map(ex => {
        const sets = exerciseSets(ex.id);
        return (
          <div key={ex.id} className="exercise-block">
            <div className="exercise-block-header">
              <div>
                <div style={{ fontWeight: 700, fontSize: "1rem" }}>{ex.exercise_name}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>{ex.category}</div>
              </div>
            </div>

            {/* Set column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 48px 36px", gap: 8, padding: "4px 0", fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <span>Set</span>
              <span>Weight (kg)</span>
              <span>Reps</span>
              <span style={{ textAlign: "center" }}>Done</span>
              <span></span>
            </div>

            {sets.map((s, i) => {
              const inputState = setInputs[s.id] ?? { weight: s.weight?.toString() ?? "", reps: s.reps?.toString() ?? "" };
              const isDone = s.completed === 1;
              return (
                <div key={s.id} className={`set-row${isDone ? " completed" : ""}`}>
                  <div style={{ display: "grid", gridTemplateColumns: "28px 1fr 1fr 48px 36px", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>
                      {s.is_warmup ? "W" : i + 1 - sets.slice(0, i).filter(x => x.is_warmup).length}
                    </span>
                    <input
                      type="number"
                      className="set-input"
                      placeholder="—"
                      value={inputState.weight}
                      onChange={e => setSetInputs(prev => ({ ...prev, [s.id]: { ...inputState, weight: e.target.value } }))}
                      disabled={isDone}
                      step="0.5"
                      min="0"
                    />
                    <input
                      type="number"
                      className="set-input"
                      placeholder="—"
                      value={inputState.reps}
                      onChange={e => setSetInputs(prev => ({ ...prev, [s.id]: { ...inputState, reps: e.target.value } }))}
                      disabled={isDone}
                      min="0"
                    />
                    <button
                      className={`set-complete-btn${isDone ? " done" : ""}`}
                      onClick={() => isDone ? uncompleteSet(s.id) : completeSet(s.id)}
                      disabled={savingSet === s.id}
                      title={isDone ? "Undo" : "Complete set"}
                    >
                      {isDone ? "✓" : "○"}
                    </button>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", textAlign: "center" }}>
                      {s.is_warmup ? "W" : ""}
                    </span>
                  </div>
                </div>
              );
            })}

            <button
              className="btn-secondary btn-sm"
              onClick={() => addSet(ex.id)}
              style={{ marginTop: 8, width: "100%" }}
            >
              + Add Set
            </button>
          </div>
        );
      })}

      {/* Add Exercise */}
      <button
        className="btn-secondary"
        onClick={() => setShowAddExercise(true)}
        style={{ width: "100%", marginTop: 16 }}
      >
        + Add Exercise
      </button>

      {/* Add Exercise Modal */}
      {showAddExercise && (
        <div className="modal-overlay" onClick={() => setShowAddExercise(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700 }}>Add Exercise</h3>
              <button onClick={() => setShowAddExercise(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
            </div>
            <input
              className="form-input"
              placeholder="Search exercises..."
              value={exerciseQuery}
              onChange={e => setExerciseQuery(e.target.value)}
              autoFocus
            />
            <div style={{ marginTop: 12, maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {exerciseResults.map(ex => (
                <button
                  key={ex.id}
                  onClick={() => addExercise(ex.id)}
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", textAlign: "left", cursor: "pointer", transition: "border-color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--primary-light)")}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)" }}>{ex.name}</div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 2 }}>{ex.category}</div>
                </button>
              ))}
              {exerciseQuery && exerciseResults.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", padding: "12px 0", textAlign: "center" }}>
                  No exercises found
                </div>
              )}
              {!exerciseQuery && (
                <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", padding: "8px 0", textAlign: "center" }}>
                  Start typing to search
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rest Timer Overlay */}
      {showRestTimer && (
        <div className="rest-timer-overlay">
          <div style={{ textAlign: "center" }}>
            <div style={{ marginBottom: 12, fontSize: "0.9rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Rest Timer</div>
            <div style={{ position: "relative", display: "inline-block", marginBottom: 20 }}>
              <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
                <circle cx="60" cy="60" r="52" fill="none" stroke="var(--border)" strokeWidth="6" />
                <circle
                  cx="60" cy="60" r="52" fill="none"
                  stroke="var(--accent-cyan)" strokeWidth="6"
                  strokeDasharray={circumference}
                  strokeDashoffset={circumference * (1 - restPct)}
                  style={{ transition: "stroke-dashoffset 0.5s linear" }}
                />
              </svg>
              <div className="rest-timer-count" style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(90deg)" }}>
                {restSeconds}
              </div>
            </div>
            <div>
              <button
                className="btn-secondary btn-sm"
                onClick={() => { setShowRestTimer(false); setRestSeconds(0); if (restRef.current) clearInterval(restRef.current); }}
              >
                Skip Rest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
