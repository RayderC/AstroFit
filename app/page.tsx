export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { redirect } from "next/navigation";
import db, { getSiteConfig } from "@/lib/db";
import { siteConfig as defaults } from "@/lib/siteConfig";
import Navigation from "./components/Navigation";
import Link from "next/link";

function formatDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDistance(m: number | null, unit: string) {
  if (!m) return "—";
  return unit === "mi" ? (m / 1609.344).toFixed(1) + " mi" : (m / 1000).toFixed(1) + " km";
}

function workoutIcon(type: string) {
  return type === "run" ? "🏃" : type === "strength" ? "💪" : type === "cycling" ? "🚴" : "⚡";
}

export default async function HomePage() {
  let session;
  try {
    session = await getIronSession<{ user?: { id: number; username: string; isAdmin?: boolean } }>(
      await cookies(), sessionOptions
    );
  } catch { session = {}; }

  if (!session.user) redirect("/login");

  let raw: Record<string, string> = {};
  try { raw = getSiteConfig(); } catch {}
  const siteName = raw.SITE_NAME || defaults.name;

  const userId = session.user.id;
  const unit = (db.prepare("SELECT unit_preference FROM users WHERE id = ?").get(userId) as { unit_preference: string } | undefined)?.unit_preference ?? "km";

  const recentWorkouts = db.prepare(`
    SELECT id, type, title, started_at, duration_seconds, distance_meters
    FROM workouts WHERE user_id = ? ORDER BY started_at DESC LIMIT 5
  `).all(userId) as { id: number; type: string; title: string; started_at: string; duration_seconds: number; distance_meters: number | null }[];

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekStats = db.prepare(`
    SELECT COUNT(*) as count,
           COALESCE(SUM(duration_seconds), 0) as total_duration,
           COALESCE(SUM(distance_meters), 0) as total_distance
    FROM workouts WHERE user_id = ? AND started_at >= ?
  `).get(userId, weekStart.toISOString()) as { count: number; total_duration: number; total_distance: number };

  const xpRow = db.prepare("SELECT total_xp, level FROM user_xp WHERE user_id = ?").get(userId) as { total_xp: number; level: number } | undefined;
  const totalXp = xpRow?.total_xp ?? 0;
  const level = xpRow?.level ?? 1;

  const activeGoals = db.prepare(`
    SELECT id, title, type, target_value, unit FROM goals WHERE user_id = ? AND is_active = 1 LIMIT 4
  `).all(userId) as { id: number; title: string; type: string; target_value: number; unit: string }[];

  const recentAchievements = db.prepare(`
    SELECT a.name, a.icon, ua.earned_at
    FROM user_achievements ua JOIN achievements a ON ua.achievement_id = a.id
    WHERE ua.user_id = ? ORDER BY ua.earned_at DESC LIMIT 3
  `).all(userId) as { name: string; icon: string; earned_at: string }[];

  const weeklyGoal = db.prepare(`
    SELECT target_value FROM goals WHERE user_id = ? AND type = 'weekly_distance' AND is_active = 1 LIMIT 1
  `).get(userId) as { target_value: number } | undefined;
  const weeklyGoalKm = weeklyGoal?.target_value ?? 0;
  const weeklyDistKm = weekStats.total_distance / 1000;
  const weeklyPct = weeklyGoalKm > 0 ? Math.min(100, (weeklyDistKm / weeklyGoalKm) * 100) : 0;

  return (
    <div>
      <Navigation />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 80px" }}>
        <div style={{ marginBottom: 32 }}>
          <div className="section-eyebrow">Dashboard</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
            Welcome back, <span className="gradient-text">{session.user.username}</span>
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{siteName} — Track. Train. Ascend.</p>
        </div>

        <div className="metrics-grid" style={{ marginBottom: 28 }}>
          <div className="metric-card">
            <div className="metric-card-value">{weekStats.count}</div>
            <div className="metric-card-label">This Week</div>
            <div className="metric-card-sub">workouts</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-value">{formatDuration(weekStats.total_duration)}</div>
            <div className="metric-card-label">Total Time</div>
            <div className="metric-card-sub">this week</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-value">{formatDistance(weekStats.total_distance, unit)}</div>
            <div className="metric-card-label">Distance</div>
            <div className="metric-card-sub">this week</div>
          </div>
          <div className="metric-card">
            <div className="metric-card-value" style={{ fontSize: 24 }}>Lv.{level}</div>
            <div className="metric-card-label">Athlete Level</div>
            <div className="metric-card-sub">{totalXp.toLocaleString()} XP</div>
          </div>
        </div>

        {weeklyGoalKm > 0 && (
          <div className="goal-card" style={{ marginBottom: 28 }}>
            <div className="goal-card-header">
              <span className="goal-card-title">Weekly Distance Goal</span>
              <span className="goal-card-pct">{weeklyPct.toFixed(0)}%</span>
            </div>
            <div className="goal-bar">
              <div className={`goal-bar-fill${weeklyPct >= 100 ? " complete" : ""}`} style={{ width: `${weeklyPct}%` }} />
            </div>
            <div className="goal-card-meta">
              <span>{unit === "mi" ? (weeklyDistKm * 0.621371).toFixed(1) : weeklyDistKm.toFixed(1)} {unit}</span>
              <span>{unit === "mi" ? (weeklyGoalKm * 0.621371).toFixed(1) : weeklyGoalKm.toFixed(1)} {unit} goal</span>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 className="shelf-section-title">Recent Workouts</h2>
              <Link href="/workouts" className="shelf-view-all">View all →</Link>
            </div>

            {recentWorkouts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🏃</div>
                <div className="empty-title">No workouts yet</div>
                <div className="empty-desc">Log your first workout to get started</div>
                <Link href="/workouts/log" className="btn btn-primary">Log Workout</Link>
              </div>
            ) : (
              <div className="workout-feed">
                {recentWorkouts.map((w) => (
                  <Link key={w.id} href={`/workouts/${w.id}`} className="workout-card">
                    <div className="workout-card-header">
                      <div className="workout-type-icon">{workoutIcon(w.type)}</div>
                      <div>
                        <div className="workout-card-title">{w.title || (w.type === "run" ? "Run" : "Strength Session")}</div>
                        <div className="workout-card-date">
                          {new Date(w.started_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </div>
                      </div>
                    </div>
                    <div className="workout-metrics">
                      <div className="workout-metric">
                        <div className="workout-metric-value">{formatDuration(w.duration_seconds)}</div>
                        <div className="workout-metric-label">Duration</div>
                      </div>
                      {w.distance_meters != null && (
                        <div className="workout-metric">
                          <div className="workout-metric-value">{formatDistance(w.distance_meters, unit)}</div>
                          <div className="workout-metric-label">Distance</div>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <Link href="/workouts/log" className="btn btn-primary" style={{ marginTop: 20, display: "inline-flex" }}>
              + Log Workout
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {recentAchievements.length > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 className="shelf-section-title">Recent Achievements</h2>
                  <Link href="/achievements" className="shelf-view-all">All →</Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recentAchievements.map((a) => (
                    <div key={a.name} className="achievement-card earned">
                      <div className="achievement-icon">{a.icon}</div>
                      <div>
                        <div className="achievement-name">{a.name}</div>
                        <div className="achievement-desc" style={{ fontSize: 11 }}>
                          {new Date(a.earned_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeGoals.length > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 className="shelf-section-title">Active Goals</h2>
                  <Link href="/goals" className="shelf-view-all">All →</Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeGoals.map((g) => (
                    <div key={g.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 16px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{g.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
                        Target: {g.target_value} {g.unit}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/workouts/log/run" className="btn btn-secondary" style={{ justifyContent: "center" }}>
                🏃 Log a Run
              </Link>
              <Link href="/workouts/log/strength" className="btn btn-secondary" style={{ justifyContent: "center" }}>
                💪 Log Strength
              </Link>
              <Link href="/plans" className="btn btn-ghost" style={{ justifyContent: "center", fontSize: 13 }}>
                📋 Training Plans
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
