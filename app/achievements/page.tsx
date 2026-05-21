export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Navigation from "../components/Navigation";
import { levelFromXp, levelProgress, xpForLevel } from "@/lib/fitness";

const PR_LABELS: Record<string, string> = {
  "1km": "1 km", "5km": "5 km", "10km": "10 km",
  "half_marathon": "Half Marathon", "marathon": "Marathon",
};

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function AchievementsPage() {
  const session = await getIronSession<{ user?: { id: number } }>(await cookies(), sessionOptions);
  if (!session.user) redirect("/login");
  const userId = session.user.id;

  const allAchievements = db.prepare("SELECT * FROM achievements ORDER BY category, xp_reward").all() as {
    id: number; code: string; name: string; description: string; icon: string; xp_reward: number; category: string;
  }[];

  const earned = db.prepare("SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ?").all(userId) as
    { achievement_id: number; earned_at: string }[];
  const earnedMap = new Map(earned.map((e) => [e.achievement_id, e.earned_at]));

  const prs = db.prepare(`
    SELECT pr.record_type, pr.value, pr.achieved_at
    FROM personal_records pr WHERE pr.user_id = ? ORDER BY pr.record_type
  `).all(userId) as { record_type: string; value: number; achieved_at: string }[];

  const xpRow = db.prepare("SELECT total_xp, level FROM user_xp WHERE user_id = ?").get(userId) as
    | { total_xp: number; level: number } | undefined;
  const totalXp = xpRow?.total_xp ?? 0;
  const level = levelFromXp(totalXp);
  const progress = levelProgress(totalXp);
  const xpToNext = xpForLevel(level + 1) - totalXp;

  const earnedCount = allAchievements.filter((a) => earnedMap.has(a.id)).length;
  const categories = [...new Set(allAchievements.map((a) => a.category))];

  return (
    <div>
      <Navigation />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px" }}>
        <div className="section-eyebrow">Progress</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 24 }}>Achievements</h1>

        {/* Level card */}
        <div className="metric-card" style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 2 }}>Fitness Level</div>
              <div style={{ fontSize: 40, fontWeight: 800, color: "var(--primary-light)" }}>{level}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{totalXp.toLocaleString()} XP</div>
              <div style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 2 }}>{xpToNext.toLocaleString()} to Level {level + 1}</div>
              <div style={{ fontSize: 12, color: "var(--accent-cyan)", marginTop: 6 }}>{earnedCount} / {allAchievements.length} unlocked</div>
            </div>
          </div>
          <div className="xp-bar">
            <div className="xp-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>

        {/* Personal Records */}
        {prs.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Personal Records</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
              {prs.map((pr) => (
                <div key={pr.record_type} className="pr-card">
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent-cyan)", marginBottom: 4 }}>
                    {PR_LABELS[pr.record_type] ?? pr.record_type}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "var(--font-mono)" }}>{formatTime(pr.value)}</div>
                  <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 4 }}>{new Date(pr.achieved_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements by category */}
        {categories.map((cat) => {
          const catAchievements = allAchievements.filter((a) => a.category === cat);
          return (
            <div key={cat} style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, textTransform: "capitalize", marginBottom: 14, color: "var(--text-muted)" }}>{cat}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {catAchievements.map((a) => {
                  const isEarned = earnedMap.has(a.id);
                  const earnedAt = earnedMap.get(a.id);
                  return (
                    <div
                      key={a.id}
                      className="achievement-card"
                      style={{ opacity: isEarned ? 1 : 0.4, filter: isEarned ? "none" : "grayscale(1)" }}
                    >
                      <div style={{ fontSize: 32, marginBottom: 8 }}>{a.icon}</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{a.name}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5, marginBottom: 8 }}>{a.description}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "var(--accent-cyan)", fontWeight: 700 }}>+{a.xp_reward} XP</span>
                        {isEarned && earnedAt && (
                          <span style={{ fontSize: 10, color: "var(--text-subtle)" }}>{new Date(earnedAt).toLocaleDateString()}</span>
                        )}
                        {!isEarned && <span style={{ fontSize: 10, color: "var(--text-subtle)" }}>Locked</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
