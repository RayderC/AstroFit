"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Stats = {
  workoutsThisWeek: number;
  volumeThisWeek: number;
  cardioKmThisWeek: number;
  xpThisWeek: number;
  totalWorkouts: number;
  totalCardio: number;
};

type Challenge = {
  id: number; title: string; description: string;
  category: string; target_value: number; target_type: string;
  xp_reward: number; ends_at: string; type: string;
  progress: number | null; completed: number | null;
};

type RecentWorkout = {
  id: number; name: string; started_at: string;
  duration_seconds: number | null; xp_earned: number;
};

type Me = {
  username: string; level: number; xp: number; streakDays: number;
  xpProgress: { current: number; needed: number; level: number };
};

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [recent, setRecent] = useState<RecentWorkout[]>([]);

  useEffect(() => {
    fetch("/api/me").then(r => r.json()).then(setMe);
    fetch("/api/dashboard/stats").then(r => r.json()).then(setStats);
    fetch("/api/challenges").then(r => r.json()).then(d => setChallenges(Array.isArray(d) ? d : []));
    fetch("/api/workouts?limit=3").then(r => r.json()).then(d => setRecent(Array.isArray(d) ? d : []));
  }, []);

  function fmtDuration(s: number | null) {
    if (!s) return "—";
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }

  const pct = me ? Math.min(100, Math.round((me.xpProgress.current / me.xpProgress.needed) * 100)) : 0;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {me ? `Welcome back, ${me.username}` : "Dashboard"}
          </h1>
          <p className="page-subtitle">Here&apos;s your training overview for this week.</p>
        </div>
        <Link href="/dashboard/workout" className="btn btn-primary">
          Start Workout
        </Link>
      </div>

      {/* Level + XP bar */}
      {me && (
        <div className="card" style={{ marginBottom: "24px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span className="level-badge" style={{ fontSize: "14px", padding: "6px 16px" }}>
                Level {me.level}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                {me.xpProgress.current} / {me.xpProgress.needed} XP to Level {me.level + 1}
              </span>
            </div>
            {me.streakDays > 0 && (
              <span className="streak-badge">🔥 {me.streakDays}-day streak</span>
            )}
          </div>
          <div className="xp-bar-wrap" style={{ height: "10px" }}>
            <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-subtle)", textAlign: "right" }}>
            {me.xp} total XP
          </div>
        </div>
      )}

      {/* Weekly stats */}
      <div className="stats-grid">
        <div className="stat-card accent-purple">
          <div className="stat-card-label">Workouts</div>
          <div className="stat-card-value">{stats?.workoutsThisWeek ?? "—"}</div>
          <div className="stat-card-sub">this week</div>
        </div>
        <div className="stat-card accent-cyan">
          <div className="stat-card-label">Volume</div>
          <div className="stat-card-value">
            {stats ? (stats.volumeThisWeek >= 1000 ? `${(stats.volumeThisWeek / 1000).toFixed(1)}t` : `${stats.volumeThisWeek}kg`) : "—"}
          </div>
          <div className="stat-card-sub">weight lifted</div>
        </div>
        <div className="stat-card accent-cyan">
          <div className="stat-card-label">Cardio</div>
          <div className="stat-card-value">{stats ? `${stats.cardioKmThisWeek.toFixed(1)}` : "—"}</div>
          <div className="stat-card-sub">km this week</div>
        </div>
        <div className="stat-card accent-xp">
          <div className="stat-card-label">XP Earned</div>
          <div className="stat-card-value" style={{ color: "var(--xp-color)" }}>{stats?.xpThisWeek ?? "—"}</div>
          <div className="stat-card-sub">this week</div>
        </div>
      </div>

      <div className="two-col" style={{ gap: "24px" }}>
        {/* Active challenges */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Active Challenges</h2>
            <Link href="/dashboard/challenges" style={{ fontSize: "12px", color: "var(--primary-light)" }}>
              View all →
            </Link>
          </div>
          {challenges.length === 0 ? (
            <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No active challenges right now.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {challenges.slice(0, 4).map(c => {
                const prog = c.progress ?? 0;
                const pct = Math.min(100, Math.round((prog / c.target_value) * 100));
                const done = c.completed === 1;
                return (
                  <div key={c.id} className={`challenge-card${done ? " completed" : ""}`}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "13px", color: done ? "var(--success)" : "var(--text)" }}>
                          {done && "✓ "}{c.title}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{c.description}</div>
                      </div>
                      <span className={`badge badge-${done ? "green" : c.category === "strength" ? "purple" : c.category === "cardio" ? "cyan" : "gold"}`}>
                        +{c.xp_reward} XP
                      </span>
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-subtle)", marginBottom: "4px" }}>
                        <span>{prog.toFixed(c.target_type === "cardio_km" ? 1 : 0)} / {c.target_value}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="challenge-progress-bar">
                        <div className={`challenge-progress-fill${done ? " done" : ""}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent workouts */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "16px", fontWeight: 700 }}>Recent Workouts</h2>
            <Link href="/dashboard/history" style={{ fontSize: "12px", color: "var(--primary-light)" }}>
              View all →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px" }}>
              No workouts yet. <Link href="/dashboard/workout" style={{ color: "var(--primary-light)" }}>Start one!</Link>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recent.map(w => (
                <Link key={w.id} href={`/dashboard/history`} className="card" style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", border: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "14px" }}>{w.name}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{fmtDate(w.started_at)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{fmtDuration(w.duration_seconds)}</div>
                    {w.xp_earned > 0 && <div style={{ fontSize: "11px", color: "var(--xp-color)" }}>+{w.xp_earned} XP</div>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
