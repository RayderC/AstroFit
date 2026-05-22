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
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => router.push("/dashboard/templates")} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem", padding: 0, marginBottom: 8 }}>
          ← Templates
        </button>
        {editName ? (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="form-input"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditName(false); }}
              autoFocus
              style={{ fontSize: "1.3rem", fontWeight: 700 }}
            />
            <button className="btn-primary btn-sm" onClick={saveName}>Save</button>
            <button className="btn-secondary btn-sm" onClick={() => setEditName(false)}>Cancel</button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>{template.name}</h1>
            <button onClick={() => setEditName(true)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem" }}>
              Edit
            </button>
          </div>
        )}
      </div>

      {template.exercises.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: 20 }}>
          <div>No exercises yet. Add your first one below.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {template.exercises.map(ex => (
            <div key={ex.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{ex.exercise_name}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: 2 }}>
                  {ex.sets} sets
                  {ex.target_reps && ` × ${ex.target_reps} reps`}
                  {ex.target_weight && ` @ ${ex.target_weight}kg`}
                  {ex.rest_seconds > 0 && ` · ${ex.rest_seconds}s rest`}
                </div>
              </div>
              <button
                className="btn-danger btn-sm"
                onClick={() => removeExercise(ex.id)}
                disabled={deleting === ex.id}
              >
                {deleting === ex.id ? "..." : "Remove"}
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="btn-secondary" style={{ width: "100%" }} onClick={() => setShowAddExercise(true)}>
        + Add Exercise
      </button>

      {showAddExercise && (
        <div className="modal-overlay" onClick={() => setShowAddExercise(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700 }}>Add Exercise to Template</h3>
              <button onClick={() => setShowAddExercise(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>✕</button>
            </div>
            <input
              className="form-input"
              placeholder="Search exercises..."
              value={exerciseQuery}
              onChange={e => { setExerciseQuery(e.target.value); setSelectedExercise(null); }}
              autoFocus
            />
            {!selectedExercise && (
              <div style={{ marginTop: 10, maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {exerciseResults.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => setSelectedExercise(ex)}
                    style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", textAlign: "left", cursor: "pointer" }}
                  >
                    <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{ex.name}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{ex.category}</div>
                  </button>
                ))}
              </div>
            )}
            {selectedExercise && (
              <div style={{ marginTop: 12 }}>
                <div style={{ background: "rgba(124,14,179,0.1)", border: "1px solid var(--primary)", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{selectedExercise.name}</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label className="form-label">Sets</label>
                    <input className="form-input" type="number" min="1" value={addSets} onChange={e => setAddSets(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="form-label">Target Reps</label>
                    <input className="form-input" placeholder="e.g. 8-12" value={addReps} onChange={e => setAddReps(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Target Weight (kg)</label>
                    <input className="form-input" type="number" placeholder="optional" value={addWeight} onChange={e => setAddWeight(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Rest (seconds)</label>
                    <input className="form-input" type="number" value={addRest} onChange={e => setAddRest(Number(e.target.value))} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary btn-sm" onClick={addExercise}>Add</button>
                  <button className="btn-secondary btn-sm" onClick={() => setSelectedExercise(null)}>Back</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
