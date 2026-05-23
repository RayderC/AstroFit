"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUnits } from "@/app/context/UnitsContext";

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

function parseStartedAt(raw: string): number {
  // SQLite datetime('now') returns UTC like "2024-01-15 10:30:00" without Z.
  // Appending Z prevents JS from treating it as local time.
  return new Date(raw.replace(" ", "T") + "Z").getTime();
}

export default function WorkoutSessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const workoutId = Number(params?.id);

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [restSeconds, setRestSeconds] = useState(0);
  const [restPaused, setRestPaused] = useState(false);
  const [showRestTimer, setShowRestTimer] = useState(false);
  const [restDuration, setRestDuration] = useState(90);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseResults, setExerciseResults] = useState<ExerciseResult[]>([]);
  const [completing, setCompleting] = useState(false);
  const [completionData, setCompletionData] = useState<CompletionResult | null>(null);
  const [setInputs, setSetInputs] = useState<Record<number, SetRowState>>({});
  const [savingSet, setSavingSet] = useState<number | null>(null);

  const { weightUnit } = useUnits();
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPausedRef = useRef(false);
  const pauseOffsetRef = useRef(0);
  const pauseStartRef = useRef<number | null>(null);

  const fetchWorkout = useCallback(async () => {
    const res = await fetch(`/api/workouts/${workoutId}`);
    if (res.status === 404) { router.push("/dashboard/workout"); return; }
    const data: Workout = await res.json();
    if (data.completed_at) { router.push("/dashboard/history"); return; }
    setWorkout(data);
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

  // Elapsed timer — pause-aware
  useEffect(() => {
    if (!workout) return;
    const startMs = parseStartedAt(workout.started_at);
    const tick = () => {
      if (!isPausedRef.current) {
        setElapsed(Math.floor((Date.now() - startMs) / 1000) - pauseOffsetRef.current);
      }
    };
    tick();
    elapsedRef.current = setInterval(tick, 1000);
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [workout?.started_at]);

  const togglePause = () => {
    if (!isPausedRef.current) {
      isPausedRef.current = true;
      setIsPaused(true);
      pauseStartRef.current = Date.now();
    } else {
      if (pauseStartRef.current) {
        pauseOffsetRef.current += Math.floor((Date.now() - pauseStartRef.current) / 1000);
        pauseStartRef.current = null;
      }
      isPausedRef.current = false;
      setIsPaused(false);
    }
  };

  // Rest countdown tick
  useEffect(() => {
    if (!showRestTimer || restPaused) return;
    const id = setInterval(() => {
      setRestSeconds(s => {
        if (s <= 1) {
          clearInterval(id);
          setShowRestTimer(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    restRef.current = id;
    return () => clearInterval(id);
  }, [showRestTimer, restPaused]);

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
    setRestSeconds(restDuration);
    setRestPaused(false);
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

  const deleteSet = async (setId: number) => {
    await fetch(`/api/workouts/${workoutId}/sets/${setId}`, { method: "DELETE" });
    setWorkout(prev => {
      if (!prev) return prev;
      return { ...prev, sets: prev.sets.filter(s => s.id !== setId) };
    });
    setSetInputs(prev => {
      const next = { ...prev };
      delete next[setId];
      return next;
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
    // Stop timers immediately
    setShowRestTimer(false);
    if (restRef.current) clearInterval(restRef.current);
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    try {
      const res = await fetch(`/api/workouts/${workoutId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setCompletionData(data);
    } catch {
      alert("Failed to save workout. Please try again.");
    } finally {
      setCompleting(false);
    }
  };

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  // Prevent e/E/+/- in number inputs
  const filterWeightKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
  };
  const filterRepsKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (["e", "E", "+", "-", "."].includes(e.key)) e.preventDefault();
  };

  const restPct = restDuration > 0 ? restSeconds / restDuration : 0;

  if (loading) return <div className="loading">Loading workout...</div>;
  if (!workout) return null;

  if (completionData) {
    return (
      <div className="completion-card card card--accent-purple">
        <div className="completion-emoji">🎉</div>
        <h2 className="completion-title">Workout Complete!</h2>
        <p className="completion-subtitle">{workout.name}</p>
        <div className="completion-stats">
          <div>
            <div className="completion-stat-value text-gold">+{completionData.xpEarned}</div>
            <div className="completion-stat-label">XP Earned</div>
          </div>
          <div>
            <div className="completion-stat-value text-purple">{completionData.prCount}</div>
            <div className="completion-stat-label">New PRs</div>
          </div>
          <div>
            <div className="completion-stat-value text-cyan">{completionData.streak}</div>
            <div className="completion-stat-label">Day Streak</div>
          </div>
        </div>
        {completionData.prCount > 0 && (
          <div className="completion-pr-banner">
            🏆 Personal record{completionData.prCount > 1 ? "s" : ""}! Check Progress for details.
          </div>
        )}
        <div className="flex gap-3 justify-between">
          <button className="btn btn-secondary" onClick={() => router.push("/dashboard/history")}>
            History
          </button>
          <button className="btn btn-primary" onClick={() => router.push("/dashboard/workout")}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const exerciseSets = (weId: number) => workout.sets.filter(s => s.workout_exercise_id === weId);

  return (
    <div className="workout-session">
      <div className="workout-header">
        <div>
          <h1 className="workout-name">{workout.name}</h1>
          <div className="workout-timer-row">
            <div className="workout-elapsed">{formatElapsed(elapsed)}</div>
            <button
              className={`workout-pause-btn${isPaused ? " paused" : ""}`}
              onClick={togglePause}
              title={isPaused ? "Resume timer" : "Pause timer"}
            >
              {isPaused ? "▶" : "⏸"}
            </button>
            <div className="rest-duration-control">
              <span style={{ fontSize: 11, color: "var(--text-subtle)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Rest</span>
              <button
                className="rest-duration-btn"
                onClick={() => setRestDuration(d => Math.max(15, d - 15))}
                title="Decrease default rest time"
              >−</button>
              <span className="rest-duration-label">{formatTime(restDuration)}</span>
              <button
                className="rest-duration-btn"
                onClick={() => setRestDuration(d => d + 15)}
                title="Increase default rest time"
              >+</button>
            </div>
          </div>
        </div>
        <button className="btn btn-success" onClick={finishWorkout} disabled={completing}>
          {completing ? "Saving..." : "Finish"}
        </button>
      </div>

      {workout.exercises.map(ex => {
        const sets = exerciseSets(ex.id);
        return (
          <div key={ex.id} className="exercise-block">
            <div className="exercise-block-header">
              <div>
                <div className="exercise-name">{ex.exercise_name}</div>
                <div className="exercise-category">{ex.category}</div>
              </div>
            </div>

            <div className="set-headers">
              <span>Set</span>
              <span>Weight ({weightUnit})</span>
              <span>Reps</span>
              <span>Done</span>
              <span></span>
            </div>

            {sets.map((s, i) => {
              const inputState = setInputs[s.id] ?? { weight: s.weight?.toString() ?? "", reps: s.reps?.toString() ?? "" };
              const isDone = s.completed === 1;
              const setLabel = s.is_warmup ? "W" : String(i + 1 - sets.slice(0, i).filter(x => x.is_warmup).length);
              return (
                <div key={s.id} className={`set-row${isDone ? " completed" : ""}`}>
                  <span className="set-num">{setLabel}</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    className={`set-input${isDone ? " completed" : ""}`}
                    placeholder="—"
                    value={inputState.weight}
                    onChange={e => setSetInputs(prev => ({ ...prev, [s.id]: { ...inputState, weight: e.target.value } }))}
                    onKeyDown={filterWeightKey}
                    disabled={isDone}
                    step="0.5"
                    min="0"
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    className={`set-input${isDone ? " completed" : ""}`}
                    placeholder="—"
                    value={inputState.reps}
                    onChange={e => setSetInputs(prev => ({ ...prev, [s.id]: { ...inputState, reps: e.target.value } }))}
                    onKeyDown={filterRepsKey}
                    disabled={isDone}
                    min="0"
                    step="1"
                  />
                  <button
                    className={`set-complete-btn${isDone ? " done" : ""}`}
                    onClick={() => isDone ? uncompleteSet(s.id) : completeSet(s.id)}
                    disabled={savingSet === s.id}
                    title={isDone ? "Undo" : "Complete set"}
                  >
                    {isDone ? "✓" : "○"}
                  </button>
                  <button
                    className="set-delete-btn"
                    onClick={() => deleteSet(s.id)}
                    disabled={savingSet === s.id}
                    title="Remove set"
                  >
                    ×
                  </button>
                </div>
              );
            })}

            <button
              className="btn btn-secondary btn-sm set-add-btn"
              onClick={() => addSet(ex.id)}
            >
              + Add Set
            </button>
          </div>
        );
      })}

      <button
        className="btn btn-secondary btn-full"
        onClick={() => setShowAddExercise(true)}
        style={{ marginTop: 16 }}
      >
        + Add Exercise
      </button>

      {showAddExercise && (
        <div className="modal-overlay" onClick={() => setShowAddExercise(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Exercise</h3>
              <button className="modal-close" onClick={() => setShowAddExercise(false)}>✕</button>
            </div>
            <input
              className="form-input"
              placeholder="Search exercises..."
              value={exerciseQuery}
              onChange={e => setExerciseQuery(e.target.value)}
              autoFocus
            />
            <div className="modal-search-list">
              {exerciseResults.map(ex => (
                <button
                  key={ex.id}
                  className="exercise-search-item"
                  onClick={() => addExercise(ex.id)}
                >
                  <div className="exercise-search-name">{ex.name}</div>
                  <div className="exercise-search-cat">{ex.category}</div>
                </button>
              ))}
              {exerciseQuery && exerciseResults.length === 0 && (
                <p className="text-muted" style={{ textAlign: "center", padding: "12px 0", fontSize: 14 }}>
                  No exercises found
                </p>
              )}
              {!exerciseQuery && (
                <p className="text-muted" style={{ textAlign: "center", padding: "8px 0", fontSize: 14 }}>
                  Start typing to search
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {showRestTimer && (
        <div className="rest-timer-bar">
          <div className="rest-timer-bar-progress">
            <div
              className="rest-timer-bar-progress-fill"
              style={{ width: `${Math.max(0, restPct * 100)}%` }}
            />
          </div>
          <div className="rest-timer-bar-content">
            <span className="rest-timer-bar-label">Rest</span>
            <span className="rest-timer-bar-time">{formatTime(restSeconds)}</span>
            <button
              className="rest-timer-bar-adj"
              onClick={() => setRestSeconds(s => Math.max(0, s - 15))}
            >−15s</button>
            <button
              className="rest-timer-bar-adj"
              onClick={() => {
                const added = restSeconds + 15;
                setRestSeconds(added);
                if (added > restDuration) setRestDuration(added);
              }}
            >+15s</button>
            <button
              className="rest-timer-bar-pause"
              onClick={() => setRestPaused(p => !p)}
              title={restPaused ? "Resume rest" : "Pause rest"}
            >
              {restPaused ? "▶" : "⏸"}
            </button>
            <button
              className="rest-timer-bar-skip"
              onClick={() => { setShowRestTimer(false); if (restRef.current) clearInterval(restRef.current); }}
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
