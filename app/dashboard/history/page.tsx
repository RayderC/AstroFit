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
    <div className="content-narrow">
      <div className="dash-header">
        <h1 className="dash-title">History</h1>
      </div>

      {loading && workouts.length === 0 ? (
        <div className="loading">Loading...</div>
      ) : workouts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No completed workouts yet</div>
          <Link href="/dashboard/workout" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
            Start a Workout
          </Link>
        </div>
      ) : (
        <>
          {groups.map(group => (
            <div key={group.label} className="history-group">
              <div className="history-group-label">{group.label}</div>
              <div className="flex-col gap-2">
                {group.items.map(w => (
                  <div key={w.id} className="card">
                    <div className="history-row" style={{ padding: 0 }}>
                      <div>
                        <div className="history-row-name">{w.name}</div>
                        <div className="history-row-meta">
                          {w.exercise_count > 0 && <span>{w.exercise_count} exercise{w.exercise_count !== 1 ? "s" : ""}</span>}
                          {w.set_count > 0 && <span>{w.set_count} set{w.set_count !== 1 ? "s" : ""}</span>}
                          {w.duration_seconds > 0 && <span>{formatDuration(w.duration_seconds)}</span>}
                        </div>
                      </div>
                      <div className="history-row-right">
                        <div className="history-row-date">
                          {new Date(w.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </div>
                        {w.xp_earned > 0 && <div className="xp-tag">+{w.xp_earned} XP</div>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {hasMore && (
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={loadMore} disabled={loading}>
                {loading ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
