"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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

const PAGE_SIZE = 20;

export default function HistoryPage() {
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadWorkouts = useCallback(async (off: number, replace: boolean) => {
    setLoading(true);
    const res = await fetch(`/api/workouts?limit=${PAGE_SIZE}&offset=${off}`);
    const data: WorkoutSummary[] = await res.json();
    setWorkouts(prev => replace ? data : [...prev, ...data]);
    setHasMore(data.length === PAGE_SIZE);
    setLoading(false);
  }, []);

  useEffect(() => { loadWorkouts(0, true); }, [loadWorkouts]);

  const loadMore = () => {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    loadWorkouts(next, false);
  };

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  };

  const groupByMonth = (list: WorkoutSummary[]) => {
    const groups: { label: string; items: WorkoutSummary[] }[] = [];
    for (const w of list) {
      const label = new Date(w.started_at).toLocaleDateString(undefined, { month: "long", year: "numeric" });
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(w);
      } else {
        groups.push({ label, items: [w] });
      }
    }
    return groups;
  };

  const groups = groupByMonth(workouts);

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 24 }}>History</h1>

      {loading && workouts.length === 0 ? (
        <div className="loading">Loading...</div>
      ) : workouts.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
          <div>No completed workouts yet.</div>
          <Link href="/dashboard/workout" className="btn-primary btn-sm" style={{ display: "inline-block", marginTop: 12 }}>
            Start a Workout
          </Link>
        </div>
      ) : (
        <>
          {groups.map(group => (
            <div key={group.label} style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
                {group.label}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {group.items.map(w => (
                  <div key={w.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{w.name}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 3, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {w.exercise_count > 0 && <span>{w.exercise_count} exercise{w.exercise_count !== 1 ? "s" : ""}</span>}
                        {w.set_count > 0 && <span>{w.set_count} set{w.set_count !== 1 ? "s" : ""}</span>}
                        {w.duration_seconds > 0 && <span>{formatDuration(w.duration_seconds)}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        {new Date(w.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </div>
                      {w.xp_earned > 0 && (
                        <div style={{ fontSize: "0.8rem", color: "var(--xp-color)", marginTop: 2 }}>
                          +{w.xp_earned} XP
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button className="btn-secondary" onClick={loadMore} disabled={loading}>
                {loading ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
