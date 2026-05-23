"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

interface TemplateExercise {
  id: number;
  exercise_id: number;
  order_index: number;
  sets: number;
  target_reps: string | null;
  target_weight: number | null;
  rest_seconds: number;
  exercise_name: string;
  category: string;
  muscle_groups: string;
}

interface Template {
  id: number;
  name: string;
  description: string | null;
  exercises: TemplateExercise[];
}

interface ExerciseResult {
  id: number;
  name: string;
  category: string;
}

export default function TemplateEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const templateId = Number(params?.id);

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [exerciseResults, setExerciseResults] = useState<ExerciseResult[]>([]);
  const [addSets, setAddSets] = useState(3);
  const [addReps, setAddReps] = useState("10");
  const [addWeight, setAddWeight] = useState("");
  const [addRest, setAddRest] = useState(90);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseResult | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchTemplate = useCallback(async () => {
    const res = await fetch(`/api/templates/${templateId}`);
    if (res.status === 404) { router.push("/dashboard/templates"); return; }
    const data = await res.json();
    setTemplate(data);
    setNameInput(data.name);
    setLoading(false);
  }, [templateId, router]);

  useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

  useEffect(() => {
    if (!exerciseQuery.trim()) { setExerciseResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/exercises?q=${encodeURIComponent(exerciseQuery)}&limit=8`);
      if (res.ok) setExerciseResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [exerciseQuery]);

  const saveName = async () => {
    if (!nameInput.trim()) return;
    await fetch(`/api/templates/${templateId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput.trim() }),
    });
    setTemplate(prev => prev ? { ...prev, name: nameInput.trim() } : prev);
    setEditName(false);
  };

  const addExercise = async () => {
    if (!selectedExercise) return;
    await fetch(`/api/templates/${templateId}/exercises`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exerciseId: selectedExercise.id,
        sets: addSets,
        targetReps: addReps || undefined,
        targetWeight: addWeight ? Number(addWeight) : undefined,
        restSeconds: addRest,
      }),
    });
    setShowAddExercise(false);
    setSelectedExercise(null);
    setExerciseQuery("");
    setExerciseResults([]);
    await fetchTemplate();
  };

  const removeExercise = async (teId: number) => {
    setDeleting(teId);
    await fetch(`/api/templates/${templateId}/exercises`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateExerciseId: teId }),
    });
    setTemplate(prev => prev ? { ...prev, exercises: prev.exercises.filter(e => e.id !== teId) } : prev);
    setDeleting(null);
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!template) return null;

  return (
    <div className="content-narrow">
      <div style={{ marginBottom: 24 }}>
        <button className="back-link" onClick={() => router.push("/dashboard/templates")}>
          ← Templates
        </button>
        {editName ? (
          <div className="flex gap-2 items-center" style={{ marginTop: 8 }}>
            <input
              className="form-input"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditName(false); }}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={saveName}>Save</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditName(false)}>Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-3" style={{ marginTop: 8 }}>
            <h1 className="dash-title" style={{ marginBottom: 0 }}>{template.name}</h1>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditName(true)}>Edit name</button>
          </div>
        )}
      </div>

      {template.exercises.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: 20 }}>
          <div className="empty-state-title">No exercises yet</div>
          <div className="empty-state-desc">Add your first one below.</div>
        </div>
      ) : (
        <div className="flex-col gap-2" style={{ marginBottom: 16 }}>
          {template.exercises.map(ex => (
            <div key={ex.id} className="card">
              <div className="template-row" style={{ padding: 0 }}>
                <div>
                  <div className="template-row-name">{ex.exercise_name}</div>
                  <div className="template-row-meta">
                    {ex.sets} sets
                    {ex.target_reps && ` × ${ex.target_reps} reps`}
                    {ex.target_weight && ` @ ${ex.target_weight}kg`}
                    {ex.rest_seconds > 0 && ` · ${ex.rest_seconds}s rest`}
                  </div>
                </div>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => removeExercise(ex.id)}
                  disabled={deleting === ex.id}
                >
                  {deleting === ex.id ? "..." : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-secondary btn-full" onClick={() => setShowAddExercise(true)}>
        + Add Exercise
      </button>

      {showAddExercise && (
        <div className="modal-overlay" onClick={() => setShowAddExercise(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Exercise to Template</h3>
              <button className="modal-close" onClick={() => setShowAddExercise(false)}>✕</button>
            </div>
            <input
              className="form-input"
              placeholder="Search exercises..."
              value={exerciseQuery}
              onChange={e => { setExerciseQuery(e.target.value); setSelectedExercise(null); }}
              autoFocus
            />
            {!selectedExercise && (
              <div className="modal-search-list" style={{ maxHeight: 200 }}>
                {exerciseResults.map(ex => (
                  <button
                    key={ex.id}
                    className="exercise-search-item"
                    onClick={() => setSelectedExercise(ex)}
                  >
                    <div className="exercise-search-name">{ex.name}</div>
                    <div className="exercise-search-cat">{ex.category}</div>
                  </button>
                ))}
                {exerciseQuery && exerciseResults.length === 0 && (
                  <p className="text-muted" style={{ textAlign: "center", padding: "12px 0", fontSize: 14 }}>No exercises found</p>
                )}
              </div>
            )}
            {selectedExercise && (
              <div style={{ marginTop: 12 }}>
                <div className="selected-exercise-box">
                  <div className="selected-exercise-name">{selectedExercise.name}</div>
                </div>
                <div className="form-grid-2" style={{ marginBottom: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Sets</label>
                    <input className="form-input" type="number" min="1" value={addSets} onChange={e => setAddSets(Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target Reps</label>
                    <input className="form-input" placeholder="e.g. 8-12" value={addReps} onChange={e => setAddReps(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Target Weight (kg)</label>
                    <input className="form-input" type="number" placeholder="optional" value={addWeight} onChange={e => setAddWeight(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Rest (seconds)</label>
                    <input className="form-input" type="number" value={addRest} onChange={e => setAddRest(Number(e.target.value))} />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn btn-primary btn-sm" onClick={addExercise}>Add</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setSelectedExercise(null)}>Back</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
