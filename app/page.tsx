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

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;
  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const diff = (new Date(dates[i - 1]).getTime() - new Date(dates[i]).getTime()) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

function trendArrow(now: number, prev: number) {
  if (prev === 0 && now === 0) return null;
  if (prev === 0) return { dir: "up", pct: 100 };
  const pct = Math.round(((now - prev) / prev) * 100);
  return { dir: now >= prev ? "up" : "down", pct: Math.abs(pct) };
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
    SELECT id, type, title, started_at, duration_seconds, distance_meters, avg_pace_seconds_per_km, calories
    FROM workouts WHERE user_id = ? ORDER BY started_at DESC LIMIT 6
  `).all(userId) as {
    id: number; type: string; title: string; started_at: string;
    duration_seconds: number; distance_meters: number | null;
    avg_pace_seconds_per_km: number | null; calories: number | null;
  }[];

  // This week vs last 7 days comparison
  const comparison = db.prepare(`
    SELECT
      COUNT(CASE WHEN started_at >= datetime('now', '-7 days') THEN 1 END) as this_count,
      COUNT(CASE WHEN started_at >= datetime('now', '-14 days') AND started_at < datetime('now', '-7 days') THEN 1 END) as prev_count,
      COALESCE(SUM(CASE WHEN started_at >= datetime('now', '-7 days') THEN distance_meters END), 0) as this_dist,
      COALESCE(SUM(CASE WHEN started_at >= datetime('now', '-14 days') AND started_at < datetime('now', '-7 days') THEN distance_meters END), 0) as prev_dist,
      COALESCE(SUM(CASE WHEN started_at >= datetime('now', '-7 days') THEN duration_seconds END), 0) as this_duration,
      COALESCE(SUM(CASE WHEN started_at >= datetime('now', '-14 days') AND started_at < datetime('now', '-7 days') THEN duration_seconds END), 0) as prev_duration
    FROM workouts WHERE user_id = ?
  `).get(userId) as {
    this_count: number; prev_count: number;
    this_dist: number; prev_dist: number;
    this_duration: number; prev_duration: number;
  };

  // Streak
  const workoutDates = (db.prepare(`
    SELECT DISTINCT date(started_at, 'localtime') as d
    FROM workouts WHERE user_id = ? AND started_at >= date('now', '-366 days')
    ORDER BY d DESC
  `).all(userId) as { d: string }[]).map((r) => r.d);
  const streak = computeStreak(workoutDates);

  const xpRow = db.prepare("SELECT total_xp, level FROM user_xp WHERE user_id = ?").get(userId) as { total_xp: number; level: number } | undefined;
  const totalXp = xpRow?.total_xp ?? 0;
  const level = xpRow?.level ?? 1;

  const activeGoals = db.prepare(`
    SELECT id, title, type, target_value, unit FROM goals WHERE user_id = ? AND is_active = 1 LIMIT 3
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
  const weeklyDistKm = comparison.this_dist / 1000;
  const weeklyPct = weeklyGoalKm > 0 ? Math.min(100, (weeklyDistKm / weeklyGoalKm) * 100) : 0;

  const countTrend = trendArrow(comparison.this_count, comparison.prev_count);
  const distTrend = trendArrow(comparison.this_dist, comparison.prev_dist);

  function formatPace(secPerKm: number | null) {
    if (!secPerKm) return null;
    const s = unit === "mi" ? secPerKm * 1.60934 : secPerKm;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")} /${unit}`;
  }

  return (
    <div>
      <Navigation />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div className="section-eyebrow">Dashboard</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
              Welcome back, <span className="gradient-text">{session.user.username}</span>
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{siteName} — Track. Train. Ascend.</p>
          </div>
          {streak >= 2 && (
            <div className="streak-badge">
              <span style={{ fontSize: 22 }}>🔥</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text)", lineHeight: 1 }}>{streak}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Day Streak</div>
              </div>
            </div>
          )}
        </div>

        {/* Weekly stats + comparison */}
        <div className="metrics-grid" style={{ marginBottom: 20 }}>
          <div className="metric-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="metric-card-value">{comparison.this_count}</div>
                <div className="metric-card-label">Workouts</div>
                <div className="metric-card-sub">this 7 days</div>
              </div>
              {countTrend && (
                <div className={`trend-chip trend-${countTrend.dir}`}>
                  {countTrend.dir === "up" ? "↑" : "↓"} {countTrend.pct}%
                </div>
              )}
            </div>
          </div>
          <div className="metric-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="metric-card-value">{formatDuration(comparison.this_duration)}</div>
                <div className="metric-card-label">Active Time</div>
                <div className="metric-card-sub">this 7 days</div>
              </div>
            </div>
          </div>
          <div className="metric-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div className="metric-card-value">{formatDistance(comparison.this_dist, unit)}</div>
                <div className="metric-card-label">Distance</div>
                <div className="metric-card-sub">this 7 days</div>
              </div>
              {distTrend && (
                <div className={`trend-chip trend-${distTrend.dir}`}>
                  {distTrend.dir === "up" ? "↑" : "↓"} {distTrend.pct}%
                </div>
              )}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-card-value" style={{ fontSize: 24, display: "flex", alignItems: "center", gap: 6 }}>
              Lv.{level} <span style={{ fontSize: 14, color: "var(--text-muted)", fontWeight: 500 }}>{totalXp.toLocaleString()} XP</span>
            </div>
            <div className="metric-card-label">Athlete Level</div>
            <div className="metric-card-sub" style={{ color: "var(--text-subtle)", fontSize: 11, marginTop: 4 }}>vs. prior 7 days: {comparison.prev_count} workout{comparison.prev_count !== 1 ? "s" : ""}</div>
          </div>
        </div>

        {/* Weekly goal progress */}
        {weeklyGoalKm > 0 && (
          <div className="goal-card" style={{ marginBottom: 24 }}>
            <div className="goal-card-header">
              <span className="goal-card-title">Weekly Distance Goal</span>
              <span className="goal-card-pct">{weeklyPct.toFixed(0)}%</span>
            </div>
            <div className="goal-bar">
              <div className={`goal-bar-fill${weeklyPct >= 100 ? " complete" : ""}`} style={{ width: `${weeklyPct}%` }} />
            </div>
            <div className="goal-card-meta">
              <span>{unit === "mi" ? (weeklyDistKm * 0.621371).toFixed(1) : weeklyDistKm.toFixed(1)} {unit} done</span>
              <span>{unit === "mi" ? (weeklyGoalKm * 0.621371).toFixed(1) : weeklyGoalKm.toFixed(1)} {unit} goal</span>
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24, alignItems: "start" }}>
          {/* Recent workouts */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 className="shelf-section-title">Recent Workouts</h2>
              <Link href="/workouts" className="shelf-view-all">View all →</Link>
            </div>

            {recentWorkouts.length === 0 ? (
              <div className="empty-state" style={{ padding: "48px 24px" }}>
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
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="workout-card-title">{w.title || (w.type === "run" ? "Run" : "Strength Session")}</div>
                        <div className="workout-card-date">
                          {new Date(w.started_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                        </div>
                      </div>
                      <span className={`workout-type-badge workout-type-${w.type}`}>{w.type}</span>
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
                      {w.avg_pace_seconds_per_km != null && (
                        <div className="workout-metric">
                          <div className="workout-metric-value" style={{ fontSize: 16 }}>{formatPace(w.avg_pace_seconds_per_km)}</div>
                          <div className="workout-metric-label">Avg Pace</div>
                        </div>
                      )}
                      {w.calories != null && w.calories > 0 && (
                        <div className="workout-metric">
                          <div className="workout-metric-value">{w.calories}</div>
                          <div className="workout-metric-label">kcal</div>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <Link href="/workouts/log/run" className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }}>🏃 Log Run</Link>
              <Link href="/workouts/log/strength" className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }}>💪 Log Strength</Link>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {streak >= 1 && (
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px" }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Activity Streak</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 32 }}>🔥</span>
                  <div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)" }}>{streak} <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted)" }}>day{streak !== 1 ? "s" : ""}</span></div>
                    <div style={{ fontSize: 12, color: "var(--text-subtle)" }}>
                      {streak === 1 ? "Keep it up — train again tomorrow" :
                       streak < 7 ? "Building momentum!" :
                       streak < 30 ? "On fire! 🔥" : "Unstoppable! 💎"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {recentAchievements.length > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h2 className="shelf-section-title">Achievements</h2>
                  <Link href="/achievements" className="shelf-view-all">All →</Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {recentAchievements.map((a) => (
                    <div key={a.name} className="achievement-card earned" style={{ padding: "12px 16px", borderRadius: "var(--radius-sm)" }}>
                      <div className="achievement-icon" style={{ fontSize: 24 }}>{a.icon}</div>
                      <div>
                        <div className="achievement-name" style={{ fontSize: 13 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-subtle)" }}>{new Date(a.earned_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeGoals.length > 0 && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h2 className="shelf-section-title">Active Goals</h2>
                  <Link href="/goals" className="shelf-view-all">All →</Link>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {activeGoals.map((g) => (
                    <div key={g.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 16px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{g.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>Target: {g.target_value} {g.unit}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/stats" className="btn btn-ghost" style={{ justifyContent: "center", fontSize: 13 }}>📊 View Stats</Link>
              <Link href="/plans" className="btn btn-ghost" style={{ justifyContent: "center", fontSize: 13 }}>📋 Training Plans</Link>
              <Link href="/body" className="btn btn-ghost" style={{ justifyContent: "center", fontSize: 13 }}>⚖️ Body Metrics</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
