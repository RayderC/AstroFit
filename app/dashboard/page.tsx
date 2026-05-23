"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUnits } from "@/app/context/UnitsContext";

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
  const { weightUnit, distanceUnit } = useUnits();
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

  function fmtVolume(v: number) {
    return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toLocaleString();
  }

  const pct = me ? Math.min(100, Math.round((me.xpProgress.current / me.xpProgress.needed) * 100)) : 0;

  return (
    <div>
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Dashboard</h1>
        </div>
        <Link href="/dashboard/workout" className="btn btn-primary">
          Start Workout
        </Link>
      </div>

      {me && (
        <div className="card card--accent-purple" style={{ marginBottom: "24px" }}>
          <div className="flex items-center justify-between" style={{ marginBottom: "10px" }}>
            <div className="flex items-center gap-3">
              <span className="level-badge">Level {me.level}</span>
              <span className="text-muted" style={{ fontSize: "13px" }}>
                {me.xpProgress.current} / {me.xpProgress.needed} XP to Level {me.level + 1}
              </span>
            </div>
            {me.streakDays > 0 && (
              <span className="streak-badge">🔥 {me.streakDays}-day streak</span>
            )}
          </div>
          <div className="xp-bar-wrap">
            <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div style={{ marginTop: "6px", fontSize: "12px", textAlign: "right" }} className="text-muted">
            {me.xp.toLocaleString()} total XP
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card accent-purple">
          <div className="stat-card-label">Workouts</div>
          <div className="stat-card-value">{stats?.workoutsThisWeek ?? "—"}</div>
          <div className="stat-card-sub">this week</div>
        </div>
        <div className="stat-card accent-cyan">
          <div className="stat-card-label">Volume</div>
          <div className="stat-card-value">
            {stats ? fmtVolume(stats.volumeThisWeek) : "—"}
          </div>
          <div className="stat-card-sub">{weightUnit} lifted</div>
        </div>
        <div className="stat-card accent-cyan">
          <div className="stat-card-label">Cardio</div>
          <div className="stat-card-value">{stats ? `${stats.cardioKmThisWeek.toFixed(1)}` : "—"}</div>
          <div className="stat-card-sub">{distanceUnit} this week</div>
        </div>
        <div className="stat-card accent-xp">
          <div className="stat-card-label">XP Earned</div>
          <div className="stat-card-value text-gold">{stats?.xpThisWeek ?? "—"}</div>
          <div className="stat-card-sub">this week</div>
        </div>
      </div>

      <div className="two-col">
        <div>
          <div className="section-header">
            <h2 className="section-title">Active Challenges</h2>
            <Link href="/dashboard/challenges" className="view-all-link">View all →</Link>
          </div>
          {challenges.length === 0 ? (
            <div className="card">
              <div className="empty-state" style={{ padding: "24px" }}>
                <span className="text-muted" style={{ fontSize: "13px" }}>No active challenges right now.</span>
              </div>
            </div>
          ) : (
            <div className="flex-col gap-3">
              {challenges.slice(0, 4).map(c => {
                const prog = c.progress ?? 0;
                const cpct = Math.min(100, Math.round((prog / c.target_value) * 100));
                const done = c.completed === 1;
                return (
                  <div key={c.id} className={`challenge-card${done ? " completed" : ""}`}>
                    <div className="challenge-top">
                      <div>
                        <div className="challenge-name" style={{ color: done ? "var(--success)" : "var(--text)" }}>
                          {done && "✓ "}{c.title}
                        </div>
                        <div className="challenge-desc">{c.description}</div>
                      </div>
                      <span className={`badge badge-${done ? "green" : c.category === "strength" ? "purple" : c.category === "cardio" ? "cyan" : "gold"}`}>
                        +{c.xp_reward} XP
                      </span>
                    </div>
                    <div>
                      <div className="challenge-progress-row">
                        <span>{prog.toFixed(c.target_type === "cardio_km" ? 1 : 0)} / {c.target_value}</span>
                        <span>{cpct}%</span>
                      </div>
                      <div className="challenge-progress-bar">
                        <div className={`challenge-progress-fill${done ? " done" : ""}`} style={{ width: `${cpct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className="section-header">
            <h2 className="section-title">Recent Workouts</h2>
            <Link href="/dashboard/history" className="view-all-link">View all →</Link>
          </div>
          {recent.length === 0 ? (
            <div className="card">
              <div className="empty-state" style={{ padding: "24px" }}>
                <span className="text-muted" style={{ fontSize: "13px" }}>
                  No workouts yet.{" "}
                  <Link href="/dashboard/workout" className="text-purple">Start one!</Link>
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-col gap-2">
              {recent.map(w => (
                <Link key={w.id} href="/dashboard/history" className="card" style={{ cursor: "pointer", display: "block" }}>
                  <div className="history-row" style={{ padding: 0 }}>
                    <div>
                      <div className="history-row-name">{w.name}</div>
                      <div className="history-row-meta">{fmtDate(w.started_at)}</div>
                    </div>
                    <div className="history-row-right">
                      <div className="history-row-date">{fmtDuration(w.duration_seconds)}</div>
                      {w.xp_earned > 0 && <div className="xp-tag">+{w.xp_earned} XP</div>}
                    </div>
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
