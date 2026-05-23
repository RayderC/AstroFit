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
      case "cardio_km":     return `${ch.target_value} km`;
      case "cardio_count":  return `${ch.target_value} cardio session${ch.target_value !== 1 ? "s" : ""}`;
      case "volume_kg":     return `${ch.target_value.toLocaleString()} kg total volume`;
      case "pr_count":      return `${ch.target_value} personal record${ch.target_value !== 1 ? "s" : ""}`;
      default:              return `${ch.target_value}`;
    }
  };

  const daysLeft = (endsAt: string) => {
    const diff = new Date(endsAt).getTime() - Date.now();
    const days = Math.ceil(diff / 86400000);
    if (days < 0) return "Expired";
    if (days === 0) return "Ends today";
    return `${days}d left`;
  };

  const weekly = challenges.filter(c => c.type === "weekly_auto");
  const special = challenges.filter(c => c.type === "special");

  if (loading) return <div className="loading">Loading...</div>;

  const ChallengeCard = ({ ch, isSpecial }: { ch: Challenge; isSpecial?: boolean }) => {
    const progress = ch.progress ?? 0;
    const pct = Math.min(100, Math.round((progress / ch.target_value) * 100));
    const done = ch.completed === 1;
    const badgeCls = done ? "badge-green" : ch.category === "strength" ? "badge-purple" : ch.category === "cardio" ? "badge-cyan" : "badge-gold";
    return (
      <div className={`challenge-card${done ? " completed" : isSpecial ? " special" : ""}`}>
        <div className="challenge-top">
          <div>
            <div className={`challenge-category ${ch.category === "strength" ? "text-purple" : ch.category === "cardio" ? "text-cyan" : "text-gold"}`}>
              {isSpecial ? "⭐ Special" : ch.category}
            </div>
            <div className="challenge-name" style={{ color: done ? "var(--success)" : undefined }}>
              {done && "✓ "}{ch.title}
            </div>
            {ch.description && <div className="challenge-desc">{ch.description}</div>}
            <div className="challenge-meta">{daysLeft(ch.ends_at)}</div>
          </div>
          <span className={`badge ${badgeCls}`}>+{ch.xp_reward} XP</span>
        </div>
        <div>
          <div className="challenge-progress-row">
            <span>Progress: {progress} / {formatTarget(ch)}</span>
            <span>{pct}%</span>
          </div>
          <div className="challenge-progress-bar">
            <div className={`challenge-progress-fill${done ? " done" : isSpecial ? " special" : ""}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="content-narrow">
      <div className="dash-header">
        <h1 className="dash-title">Challenges</h1>
      </div>

      {weekly.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <div className="section-label">This Week</div>
          <div className="flex-col gap-3">
            {weekly.map(ch => <ChallengeCard key={ch.id} ch={ch} />)}
          </div>
        </section>
      )}

      {special.length > 0 && (
        <section>
          <div className="section-label">Special Challenges</div>
          <div className="flex-col gap-3">
            {special.map(ch => <ChallengeCard key={ch.id} ch={ch} isSpecial />)}
          </div>
        </section>
      )}

      {challenges.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🏆</div>
          <div className="empty-state-title">No active challenges</div>
          <div className="empty-state-desc">Weekly challenges refresh every Monday.</div>
        </div>
      )}
    </div>
  );
}
