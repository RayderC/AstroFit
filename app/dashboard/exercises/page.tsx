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
      // Refresh
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
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Exercises</h1>
        <button className="btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
          + Custom Exercise
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginBottom: 12 }}>New Custom Exercise</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              className="form-input"
              placeholder="Exercise name"
              value={newExercise.name}
              onChange={e => setNewExercise(p => ({ ...p, name: e.target.value }))}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <select
                className="form-input"
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
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary btn-sm" onClick={createExercise}>Create</button>
              <button className="btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
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

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            style={{
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: "0.82rem",
              fontWeight: 500,
              cursor: "pointer",
              border: "1px solid",
              borderColor: category === c ? "var(--primary-light)" : "var(--border)",
              background: category === c ? "rgba(168,85,247,0.15)" : "var(--surface)",
              color: category === c ? "var(--primary-light)" : "var(--text-muted)",
              transition: "all 0.15s",
            }}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading">Loading...</div>
      ) : exercises.length === 0 ? (
        <div className="empty-state">No exercises found.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {exercises.map(ex => (
            <div key={ex.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{ex.name}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {ex.category}
                  {muscleList(ex.muscle_groups || "[]") && ` · ${muscleList(ex.muscle_groups || "[]")}`}
                  {ex.equipment && ` · ${ex.equipment}`}
                  {!ex.is_builtin && <span style={{ color: "var(--primary-light)", marginLeft: 6 }}>custom</span>}
                </div>
              </div>
              {activeWorkout && (
                <button
                  className="btn-primary btn-sm"
                  onClick={() => addToWorkout(ex.id)}
                  disabled={addingTo === ex.id}
                  title={`Add to ${activeWorkout.name}`}
                >
                  {addingTo === ex.id ? "..." : "+ Add"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
