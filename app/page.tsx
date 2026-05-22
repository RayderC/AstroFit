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
      <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px 100px" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 13, color: "var(--text-subtle)", marginBottom: 4 }}>Welcome back</p>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em" }}>
              {session.user.username}
            </h1>
            {streak >= 2 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", background: "rgba(251,146,60,0.12)", border: "1px solid rgba(251,146,60,0.25)", borderRadius: 100, fontSize: 13, fontWeight: 600, color: "#fb923c" }}>
                🔥 {streak}-day streak
              </span>
            )}
          </div>
        </div>

        {/* This week stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 32 }}>
          {[
            { value: String(comparison.this_count), label: "Workouts", trend: countTrend },
            { value: formatDuration(comparison.this_duration), label: "Active time", trend: null },
            { value: formatDistance(comparison.this_dist, unit), label: "Distance", trend: distTrend },
          ].map((m) => (
            <div key={m.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", fontFamily: "var(--font-mono)", letterSpacing: "-0.02em", lineHeight: 1 }}>{m.value}</div>
                {m.trend && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: m.trend.dir === "up" ? "var(--success)" : "var(--danger)", background: m.trend.dir === "up" ? "var(--success-bg)" : "var(--danger-bg)", padding: "2px 7px", borderRadius: 100 }}>
                    {m.trend.dir === "up" ? "↑" : "↓"}{m.trend.pct}%
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 6 }}>{m.label} · this week</div>
            </div>
          ))}
        </div>

        {/* Weekly goal */}
        {weeklyGoalKm > 0 && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>Weekly distance goal</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--primary-light)", fontFamily: "var(--font-mono)" }}>
                {unit === "mi" ? (weeklyDistKm * 0.621371).toFixed(1) : weeklyDistKm.toFixed(1)} / {unit === "mi" ? (weeklyGoalKm * 0.621371).toFixed(1) : weeklyGoalKm.toFixed(1)} {unit}
              </span>
            </div>
            <div style={{ height: 6, background: "var(--surface-2)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${weeklyPct}%`, background: weeklyPct >= 100 ? "var(--success)" : "var(--primary-light)", borderRadius: 3, transition: "width 0.4s" }} />
            </div>
          </div>
        )}

        {/* Log quick actions */}
        <div style={{ display: "flex", gap: 10, marginBottom: 36 }}>
          <Link href="/workouts/log/run" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>+ Log Run</Link>
          <Link href="/workouts/log/strength" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>+ Log Strength</Link>
          <Link href="/workouts/log" className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }}>Other</Link>
        </div>

        {/* Recent workouts */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Recent workouts</h2>
          <Link href="/workouts" style={{ fontSize: 13, color: "var(--primary-light)" }}>See all →</Link>
        </div>

        {recentWorkouts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏃</div>
            <div className="empty-title">No workouts yet</div>
            <div className="empty-desc">Log your first workout to get started</div>
          </div>
        ) : (
          <div className="workout-feed">
            {recentWorkouts.map((w) => (
              <Link key={w.id} href={`/workouts/${w.id}`} className="workout-card">
                <div className="workout-card-header">
                  <div className="workout-type-icon">{workoutIcon(w.type)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="workout-card-title">{w.title || (w.type === "run" ? "Run" : w.type === "strength" ? "Strength" : "Workout")}</div>
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
                      <div className="workout-metric-label">Pace</div>
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
      </main>
    </div>
  );
}
