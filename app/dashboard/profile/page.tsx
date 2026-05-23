"use client";
import { useState, useEffect } from "react";
import { useUnits } from "@/app/context/UnitsContext";

interface UserProfile {
  id: number;
  username: string;
  xp: number;
  level: number;
  streakDays: number;
  createdAt: string;
  xpProgress: { current: number; needed: number; level: number };
}

interface XpEvent {
  id: number;
  amount: number;
  reason: string;
  ref_type: string;
  created_at: string;
}

interface Stats {
  totalWorkouts: number;
  totalCardio: number;
  totalVolumeKg: number;
  xpThisWeek: number;
}

export default function ProfilePage() {
  const { weightUnit } = useUnits();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [xpHistory, setXpHistory] = useState<XpEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/me").then(r => r.json()),
      fetch("/api/dashboard/stats").then(r => r.json()),
    ]).then(([me, s]) => {
      setUser(me);
      setStats(s);
      setLoading(false);
    });
    fetch("/api/xp-history").then(r => r.json()).then(setXpHistory).catch(() => {});
  }, []);

  if (loading || !user) return <div className="loading">Loading...</div>;

  const pct = Math.min(100, Math.round((user.xpProgress.current / user.xpProgress.needed) * 100));
  const memberDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000);

  return (
    <div className="content-narrow">
      <div className="dash-header">
        <h1 className="dash-title">Profile</h1>
      </div>

      <div className="card card--accent-purple" style={{ marginBottom: 20 }}>
        <div className="flex items-center gap-4" style={{ marginBottom: 16 }}>
          <div className="profile-avatar">{user.level}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{user.username}</div>
            <div className="text-purple" style={{ fontSize: 14, marginBottom: 6 }}>Level {user.level}</div>
            <div className="xp-bar-wrap">
              <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
              {user.xpProgress.current.toLocaleString()} / {user.xpProgress.needed.toLocaleString()} XP to Level {user.level + 1}
            </div>
          </div>
        </div>
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginBottom: 0 }}>
          <div className="stat-card accent-xp">
            <div className="stat-card-label">Total XP</div>
            <div className="stat-card-value text-gold">{user.xp.toLocaleString()}</div>
          </div>
          <div className="stat-card accent-cyan">
            <div className="stat-card-label">Streak</div>
            <div className="stat-card-value text-cyan">{user.streakDays}</div>
            <div className="stat-card-sub">days</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-label">Member</div>
            <div className="stat-card-value">{memberDays}</div>
            <div className="stat-card-sub">days active</div>
          </div>
        </div>
      </div>

      {stats && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <span className="card-title">All-Time Stats</span>
          </div>
          <div className="stats-grid" style={{ marginBottom: 0 }}>
            <div className="stat-card accent-purple">
              <div className="stat-card-label">Workouts</div>
              <div className="stat-card-value">{stats.totalWorkouts}</div>
              <div className="stat-card-sub">completed</div>
            </div>
            <div className="stat-card accent-cyan">
              <div className="stat-card-label">Cardio</div>
              <div className="stat-card-value">{stats.totalCardio}</div>
              <div className="stat-card-sub">sessions</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Volume</div>
              <div className="stat-card-value">
                {stats.totalVolumeKg >= 1000 ? `${(stats.totalVolumeKg / 1000).toFixed(1)}k` : stats.totalVolumeKg.toLocaleString()}
              </div>
              <div className="stat-card-sub">{weightUnit} lifted</div>
            </div>
            <div className="stat-card accent-xp">
              <div className="stat-card-label">XP This Week</div>
              <div className="stat-card-value text-gold">+{stats.xpThisWeek}</div>
            </div>
          </div>
        </div>
      )}

      {xpHistory.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent XP</span>
          </div>
          <div className="recent-sets-scroll" style={{ maxHeight: 320 }}>
            {xpHistory.slice(0, 30).map(e => (
              <div key={e.id} className="recent-set-row">
                <span>{e.reason}</span>
                <div className="flex items-center gap-3">
                  <span className="xp-tag">+{e.amount}</span>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
