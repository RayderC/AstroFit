"use client";
import { useState, useEffect } from "react";

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
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 24 }}>Profile</h1>

      {/* Level card */}
      <div className="card" style={{ marginBottom: 20, background: "rgba(124,14,179,0.06)", borderColor: "var(--primary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--primary), var(--primary-light))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.4rem", fontWeight: 900, color: "#fff", flexShrink: 0,
          }}>
            {user.level}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "1.2rem" }}>{user.username}</div>
            <div style={{ color: "var(--primary-light)", fontSize: "0.9rem", marginBottom: 6 }}>Level {user.level}</div>
            <div className="xp-bar-wrap">
              <div className="xp-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
              {user.xpProgress.current.toLocaleString()} / {user.xpProgress.needed.toLocaleString()} XP to Level {user.level + 1}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <div className="stat-card stat-card--xp" style={{ flex: 1, padding: "10px 14px" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{user.xp.toLocaleString()}</div>
            <div style={{ fontSize: "0.78rem" }}>Total XP</div>
          </div>
          <div className="stat-card stat-card--cyan" style={{ flex: 1, padding: "10px 14px" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{user.streakDays}</div>
            <div style={{ fontSize: "0.78rem" }}>Day Streak</div>
          </div>
          <div className="stat-card" style={{ flex: 1, padding: "10px 14px" }}>
            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{memberDays}</div>
            <div style={{ fontSize: "0.78rem" }}>Days Active</div>
          </div>
        </div>
      </div>

      {/* All-time stats */}
      {stats && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 14 }}>All-Time Stats</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: "10px 14px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.totalWorkouts}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Workouts Completed</div>
            </div>
            <div style={{ padding: "10px 14px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{stats.totalCardio}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Cardio Sessions</div>
            </div>
            <div style={{ padding: "10px 14px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                {stats.totalVolumeKg >= 1000 ? `${(stats.totalVolumeKg / 1000).toFixed(1)}t` : `${stats.totalVolumeKg.toLocaleString()}kg`}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Total Volume Lifted</div>
            </div>
            <div style={{ padding: "10px 14px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--xp-color)" }}>+{stats.xpThisWeek}</div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>XP This Week</div>
            </div>
          </div>
        </div>
      )}

      {/* XP History */}
      {xpHistory.length > 0 && (
        <div className="card">
          <h3 style={{ fontWeight: 600, marginBottom: 14 }}>Recent XP</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
            {xpHistory.slice(0, 30).map(e => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ color: "var(--text)" }}>{e.reason}</span>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
                  <span style={{ color: "var(--xp-color)", fontWeight: 600 }}>+{e.amount}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
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
