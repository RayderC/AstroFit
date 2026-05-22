"use client";
import { useState, useEffect } from "react";

interface Challenge {
  id: number;
  title: string;
  description: string | null;
  category: string;
  type: string;
  target_type: string;
  target_value: number;
  xp_reward: number;
  starts_at: string;
  ends_at: string;
  // flat fields from LEFT JOIN user_challenges
  progress: number | null;
  completed: number | null;
  xp_earned: number | null;
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/challenges")
      .then(r => r.json())
      .then(data => { setChallenges(data); setLoading(false); });
  }, []);

  const formatTarget = (ch: Challenge) => {
    switch (ch.target_type) {
      case "workout_count": return `${ch.target_value} workout${ch.target_value !== 1 ? "s" : ""}`;
      case "cardio_km": return `${ch.target_value} km`;
      case "cardio_count": return `${ch.target_value} cardio session${ch.target_value !== 1 ? "s" : ""}`;
      case "volume_kg": return `${ch.target_value.toLocaleString()} kg total volume`;
      case "pr_count": return `${ch.target_value} personal record${ch.target_value !== 1 ? "s" : ""}`;
      default: return `${ch.target_value}`;
    }
  };

  const daysLeft = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - Date.now();
    const days = Math.ceil(diff / 86400000);
    if (days < 0) return "Expired";
    if (days === 0) return "Ends today";
    return `${days}d left`;
  };

  const categoryColor = (cat: string) => {
    if (cat === "strength") return "var(--primary-light)";
    if (cat === "cardio") return "var(--accent-cyan)";
    return "var(--xp-color)";
  };

  const weekly = challenges.filter(c => c.type === "weekly_auto");
  const special = challenges.filter(c => c.type === "special");

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Challenges</h1>
      </div>

      {weekly.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            This Week
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {weekly.map(ch => {
              const progress = ch.progress ?? 0;
              const pct = Math.min(100, Math.round((progress / ch.target_value) * 100));
              const done = ch.completed === 1;
              return (
                <div key={ch.id} className="challenge-card" style={{ opacity: done ? 0.75 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: categoryColor(ch.category), marginRight: 8 }}>
                        {ch.category}
                      </span>
                      {done && <span style={{ fontSize: "0.7rem", background: "rgba(34,197,94,0.2)", color: "#4ade80", padding: "1px 6px", borderRadius: 4 }}>Complete</span>}
                      <div style={{ fontWeight: 600, marginTop: 4 }}>{ch.title}</div>
                      {ch.description && <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 2 }}>{ch.description}</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--xp-color)" }}>+{ch.xp_reward} XP</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>{daysLeft(ch.ends_at)}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>
                      <span>Progress: {progress} / {formatTarget(ch)}</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: done ? "#4ade80" : `linear-gradient(90deg, var(--primary), var(--primary-light))`,
                          borderRadius: 3,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {special.length > 0 && (
        <section>
          <h2 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
            Special Challenges
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {special.map(ch => {
              const progress = ch.progress ?? 0;
              const pct = Math.min(100, Math.round((progress / ch.target_value) * 100));
              const done = ch.completed === 1;
              return (
                <div key={ch.id} className="challenge-card" style={{ borderColor: "var(--xp-color)", opacity: done ? 0.75 : 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <span style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--xp-color)", marginRight: 8 }}>
                        ⭐ Special
                      </span>
                      {done && <span style={{ fontSize: "0.7rem", background: "rgba(34,197,94,0.2)", color: "#4ade80", padding: "1px 6px", borderRadius: 4 }}>Complete</span>}
                      <div style={{ fontWeight: 600, marginTop: 4 }}>{ch.title}</div>
                      {ch.description && <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 2 }}>{ch.description}</div>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                      <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--xp-color)" }}>+{ch.xp_reward} XP</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>{daysLeft(ch.ends_at)}</div>
                    </div>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>
                      <span>Progress: {progress} / {formatTarget(ch)}</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          background: done ? "#4ade80" : `linear-gradient(90deg, var(--xp-color), #fbbf24)`,
                          borderRadius: 3,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {challenges.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏆</div>
          <div>No active challenges right now.</div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: 4 }}>Weekly challenges refresh every Monday.</div>
        </div>
      )}
    </div>
  );
}
