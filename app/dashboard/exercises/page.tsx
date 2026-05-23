"use client";
import { useState, useEffect } from "react";

const CATEGORIES = ["All", "Chest", "Back", "Shoulders", "Biceps", "Triceps", "Legs", "Core", "Full Body", "Cardio"];

interface Exercise {
  id: number;
  name: string;
  category: string;
  muscle_groups: string;
  equipment: string | null;
  is_builtin: number;
}

interface ActiveWorkout {
  id: number;
  name: string;
}

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [addingTo, setAddingTo] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newExercise, setNewExercise] = useState({ name: "", category: "Chest", muscle_groups: "", equipment: "" });

  useEffect(() => {
    fetch("/api/workouts/active").then(r => r.ok ? r.json() : null).then(d => setActiveWorkout(d));
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category !== "All") params.set("category", category);
    fetch(`/api/exercises?${params}`).then(r => r.json()).then(data => {
      setExercises(data);
      setLoading(false);
    });
  }, [query, category]);

  const addToWorkout = async (exerciseId: number) => {
    if (!activeWorkout) return;
    setAddingTo(exerciseId);
    await fetch(`/api/workouts/${activeWorkout.id}/exercises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exerciseId }),
    });
    setAddingTo(null);
  };

  const createExercise = async () => {
    if (!newExercise.name.trim()) return;
    const res = await fetch("/api/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newExercise.name.trim(),
        category: newExercise.category,
        muscleGroups: newExercise.muscle_groups,
        equipment: newExercise.equipment || null,
      }),
    });
    if (res.ok) {
      setShowCreate(false);
      setNewExercise({ name: "", category: "Chest", muscle_groups: "", equipment: "" });
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (category !== "All") params.set("category", category);
      fetch(`/api/exercises?${params}`).then(r => r.json()).then(setExercises);
    }
  };

  const muscleList = (json: string) => {
    try { return (JSON.parse(json) as string[]).join(", "); }
    catch { return json; }
  };

  return (
    <div className="content-wide">
      <div className="dash-header">
        <h1 className="dash-title">Exercises</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
          + Custom Exercise
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">New Custom Exercise</span>
          </div>
          <div className="inline-form">
            <input
              className="form-input"
              placeholder="Exercise name"
              value={newExercise.name}
              onChange={e => setNewExercise(p => ({ ...p, name: e.target.value }))}
            />
            <div className="form-grid-2">
              <select
                className="form-select"
                value={newExercise.category}
                onChange={e => setNewExercise(p => ({ ...p, category: e.target.value }))}
              >
                {CATEGORIES.filter(c => c !== "All").map(c => <option key={c}>{c}</option>)}
              </select>
              <input
                className="form-input"
                placeholder="Equipment (optional)"
                value={newExercise.equipment}
                onChange={e => setNewExercise(p => ({ ...p, equipment: e.target.value }))}
              />
            </div>
            <input
              className="form-input"
              placeholder="Muscle groups (optional)"
              value={newExercise.muscle_groups}
              onChange={e => setNewExercise(p => ({ ...p, muscle_groups: e.target.value }))}
            />
            <div className="form-actions">
              <button className="btn btn-primary btn-sm" onClick={createExercise}>Create</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <input
          className="form-input"
          placeholder="Search exercises..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="filter-row">
        {CATEGORIES.map(c => (
          <button
            key={c}
            className={`filter-chip${category === c ? " active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : exercises.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-title">No exercises found</div>
        </div>
      ) : (
        <div className="flex-col gap-2">
          {exercises.map(ex => (
            <div key={ex.id} className="card">
              <div className="exercise-row" style={{ padding: 0 }}>
                <div>
                  <div className="exercise-row-name">
                    {ex.name}
                    {!ex.is_builtin && <span className="custom-tag">custom</span>}
                  </div>
                  <div className="exercise-row-meta">
                    {ex.category}
                    {muscleList(ex.muscle_groups || "[]") && ` · ${muscleList(ex.muscle_groups || "[]")}`}
                    {ex.equipment && ` · ${ex.equipment}`}
                  </div>
                </div>
                {activeWorkout && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => addToWorkout(ex.id)}
                    disabled={addingTo === ex.id}
                    title={`Add to ${activeWorkout.name}`}
                  >
                    {addingTo === ex.id ? "..." : "+ Add"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
