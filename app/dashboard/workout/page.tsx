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
}

interface WorkoutSummary {
  id: number;
  name: string;
  started_at: string;
  completed_at: string;
  duration_seconds: number;
  xp_earned: number;
  exercise_count: number;
  set_count: number;
}

interface ActiveWorkout {
  id: number;
  name: string;
  started_at: string;
}

export default function WorkoutPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [recent, setRecent] = useState<WorkoutSummary[]>([]);
  const [active, setActive] = useState<ActiveWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [showNewTemplate, setShowNewTemplate] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/templates").then(r => r.json()),
      fetch("/api/workouts?limit=5").then(r => r.json()),
    ]).then(([tmpl, hist]) => {
      setTemplates(tmpl);
      setRecent(hist);
    });

    fetch("/api/workouts/active").then(async r => {
      if (r.ok) setActive(await r.json());
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const startWorkout = async (templateId?: number) => {
    setStarting(true);
    const res = await fetch("/api/workouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId }),
    });
    const data = await res.json();
    if (res.status === 409) { router.push(`/dashboard/workout/${data.id}`); return; }
    if (res.ok) router.push(`/dashboard/workout/${data.id}`);
    else { alert(data.message || "Failed to start workout"); setStarting(false); }
  };

  const createTemplate = async () => {
    if (!newTemplateName.trim()) return;
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTemplateName.trim() }),
    });
    const data = await res.json();
    if (res.ok) router.push(`/dashboard/templates/${data.id}`);
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <div className="content-narrow">
      <div className="dash-header">
        <h1 className="dash-title">Workout</h1>
      </div>

      {active && (
        <div className="active-workout-banner">
          <div>
            <div className="active-workout-label">Active Workout</div>
            <div className="active-workout-name">{active.name}</div>
            <div className="active-workout-time">
              Started {new Date(active.started_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <Link href={`/dashboard/workout/${active.id}`} className="btn btn-primary">
            Resume
          </Link>
        </div>
      )}

      <div className="action-grid">
        <button
          className="action-card btn-primary"
          onClick={() => startWorkout()}
          disabled={starting}
        >
          <span className="action-card-icon">+</span>
          <span className="action-card-title">Quick Workout</span>
          <span className="action-card-sub">Start from scratch</span>
        </button>
        <button
          className="action-card btn-secondary"
          onClick={() => setShowNewTemplate(true)}
        >
          <span className="action-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </span>
          <span className="action-card-title">New Template</span>
          <span className="action-card-sub">Build a routine</span>
        </button>
      </div>

      {showNewTemplate && (
        <div className="card" style={{ marginBottom: "24px" }}>
          <div className="card-header">
            <span className="card-title">New Template</span>
          </div>
          <div className="flex gap-2">
            <input
              className="form-input"
              placeholder="Template name"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createTemplate()}
              autoFocus
            />
            <button className="btn btn-primary" onClick={createTemplate}>Create</button>
            <button className="btn btn-secondary" onClick={() => setShowNewTemplate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {templates.length > 0 && (
        <section style={{ marginBottom: "32px" }}>
          <div className="section-label">Templates</div>
          <div className="flex-col gap-2">
            {templates.map(t => (
              <div key={t.id} className="card">
                <div className="template-row" style={{ padding: 0 }}>
                  <div>
                    <div className="template-row-name">{t.name}</div>
                    {t.description && <div className="template-row-meta">{t.description}</div>}
                    <div className="template-row-meta">
                      {t.exercise_count} exercises · {t.total_sets} sets
                    </div>
                  </div>
                  <div className="template-row-actions">
                    <Link href={`/dashboard/templates/${t.id}`} className="btn btn-secondary btn-sm">Edit</Link>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => startWorkout(t.id)}
                      disabled={starting}
                    >
                      Start
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <div className="section-header">
            <div className="section-label" style={{ marginBottom: 0 }}>Recent Workouts</div>
            <Link href="/dashboard/history" className="view-all-link">View all</Link>
          </div>
          <div className="flex-col gap-2" style={{ marginTop: "12px" }}>
            {recent.map(w => (
              <div key={w.id} className="card">
                <div className="history-row" style={{ padding: 0 }}>
                  <div>
                    <div className="history-row-name">{w.name}</div>
                    <div className="history-row-meta">
                      {w.exercise_count} exercises · {w.set_count} sets
                      {w.duration_seconds > 0 && ` · ${formatDuration(w.duration_seconds)}`}
                    </div>
                  </div>
                  <div className="history-row-right">
                    <div className="history-row-date">{formatDate(w.started_at)}</div>
                    <div className="xp-tag">+{w.xp_earned} XP</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {templates.length === 0 && recent.length === 0 && !active && (
        <div className="empty-state">
          <div className="empty-state-icon">🏋️</div>
          <div className="empty-state-title">No workouts yet</div>
          <div className="empty-state-desc">Start your first one above!</div>
        </div>
      )}
    </div>
  );
}
