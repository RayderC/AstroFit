"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Template {
  id: number;
  name: string;
  description: string | null;
  exercise_count: number;
  total_sets: number;
  created_at: string;
}

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/templates").then(r => r.json()).then(d => { setTemplates(d); setLoading(false); });
  }, []);

  const createTemplate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
    });
    const data = await res.json();
    if (res.ok) router.push(`/dashboard/templates/${data.id}`);
    else { setCreating(false); alert(data.message); }
  };

  const deleteTemplate = async (id: number) => {
    if (!confirm("Delete this template?")) return;
    setDeleting(id);
    await fetch(`/api/templates/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    setTemplates(ts => ts.filter(t => t.id !== id));
    setDeleting(null);
  };

  const startFromTemplate = async (templateId: number) => {
    const res = await fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    const data = await res.json();
    if (res.status === 409) { router.push(`/dashboard/workout/${data.id}`); return; }
    if (res.ok) router.push(`/dashboard/workout/${data.id}`);
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="content-narrow">
      <div className="dash-header">
        <h1 className="dash-title">Templates</h1>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(!showCreate)}>
          + New Template
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">New Template</span>
          </div>
          <div className="inline-form">
            <input
              className="form-input"
              placeholder="Template name (e.g. Push Day)"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createTemplate()}
              autoFocus
            />
            <input
              className="form-input"
              placeholder="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            <div className="form-actions">
              <button className="btn btn-primary btn-sm" onClick={createTemplate} disabled={creating}>
                {creating ? "Creating..." : "Create & Edit"}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {templates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No templates yet</div>
          <div className="empty-state-desc">Create one to build a routine!</div>
        </div>
      ) : (
        <div className="flex-col gap-2">
          {templates.map(t => (
            <div key={t.id} className="card">
              <div className="template-row" style={{ padding: 0 }}>
                <div>
                  <div className="template-row-name">{t.name}</div>
                  {t.description && <div className="template-row-meta">{t.description}</div>}
                  <div className="template-row-meta">
                    {t.exercise_count} exercise{t.exercise_count !== 1 ? "s" : ""}
                    {t.total_sets > 0 && ` · ${t.total_sets} sets`}
                  </div>
                </div>
                <div className="template-row-actions">
                  <Link href={`/dashboard/templates/${t.id}`} className="btn btn-secondary btn-sm">Edit</Link>
                  <button className="btn btn-primary btn-sm" onClick={() => startFromTemplate(t.id)}>Start</button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteTemplate(t.id)}
                    disabled={deleting === t.id}
                  >
                    {deleting === t.id ? "..." : "✕"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
