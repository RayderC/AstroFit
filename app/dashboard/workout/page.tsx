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

    // Check for active workout
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
    if (res.status === 409) {
      router.push(`/dashboard/workout/${data.id}`);
      return;
    }
    if (res.ok) {
      router.push(`/dashboard/workout/${data.id}`);
    } else {
      alert(data.message || "Failed to start workout");
      setStarting(false);
    }
  };

  const createTemplate = async () => {
    if (!newTemplateName.trim()) return;
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTemplateName.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      router.push(`/dashboard/templates/${data.id}`);
    }
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text)" }}>Workout</h1>
      </div>

      {active && (
        <div className="card" style={{ borderColor: "var(--primary)", marginBottom: 24, background: "rgba(124,14,179,0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--primary-light)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Active Workout</div>
              <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{active.name}</div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 2 }}>
                Started {new Date(active.started_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <Link href={`/dashboard/workout/${active.id}`} className="btn-primary">
              Resume
            </Link>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
        <button
          className="btn-primary btn-lg"
          onClick={() => startWorkout()}
          disabled={starting}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "20px 16px" }}
        >
          <span style={{ fontSize: "1.75rem" }}>+</span>
          <span>Quick Workout</span>
          <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>Start from scratch</span>
        </button>
        <button
          className="btn-secondary btn-lg"
          onClick={() => setShowNewTemplate(true)}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "20px 16px" }}
        >
          <span style={{ fontSize: "1.75rem" }}>☰</span>
          <span>New Template</span>
          <span style={{ fontSize: "0.8rem", opacity: 0.8 }}>Build a routine</span>
        </button>
      </div>

      {showNewTemplate && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 12 }}>New Template</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="form-input"
              placeholder="Template name"
              value={newTemplateName}
              onChange={e => setNewTemplateName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createTemplate()}
              autoFocus
            />
            <button className="btn-primary" onClick={createTemplate}>Create</button>
            <button className="btn-secondary" onClick={() => setShowNewTemplate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {templates.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Templates
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {templates.map(t => (
              <div key={t.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  {t.description && <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{t.description}</div>}
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 2 }}>
                    {t.exercise_count} exercises · {t.total_sets} sets
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link href={`/dashboard/templates/${t.id}`} className="btn-secondary btn-sm">Edit</Link>
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => startWorkout(t.id)}
                    disabled={starting}
                  >
                    Start
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Recent Workouts
            </h2>
            <Link href="/dashboard/history" style={{ fontSize: "0.85rem", color: "var(--primary-light)" }}>View all</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recent.map(w => (
              <div key={w.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{w.name}</div>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 2 }}>
                      {w.exercise_count} exercises · {w.set_count} sets
                      {w.duration_seconds > 0 && ` · ${formatDuration(w.duration_seconds)}`}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{formatDate(w.started_at)}</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--xp-color)", marginTop: 2 }}>+{w.xp_earned} XP</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {templates.length === 0 && recent.length === 0 && !active && (
        <div className="empty-state">
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏋️</div>
          <div>No workouts yet. Start your first one above!</div>
        </div>
      )}
    </div>
  );
}
