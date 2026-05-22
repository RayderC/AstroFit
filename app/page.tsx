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

function formatPace(secPerKm: number | null, unit: string) {
  if (!secPerKm) return null;
  const s = unit === "mi" ? secPerKm * 1.60934 : secPerKm;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")} /${unit}`;
}

export default async function HomePage() {
  let session;
  try {
    session = await getIronSession<{ user?: { id: number; username: string; isAdmin?: boolean } }>(
      await cookies(), sessionOptions
    );
  } catch { session = {}; }

  if (!session.user) redirect("/login");

  const userId = session.user.id;
  const unit = (db.prepare("SELECT unit_preference FROM users WHERE id = ?").get(userId) as { unit_preference: string } | undefined)?.unit_preference ?? "mi";

  const recentWorkouts = db.prepare(`
    SELECT id, type, title, started_at, duration_seconds, distance_meters, avg_pace_seconds_per_km, calories
    FROM workouts WHERE user_id = ? ORDER BY started_at DESC LIMIT 5
  `).all(userId) as {
    id: number; type: string; title: string; started_at: string;
    duration_seconds: number; distance_meters: number | null;
    avg_pace_seconds_per_km: number | null; calories: number | null;
  }[];

  const week = db.prepare(`
    SELECT
      COUNT(*) as count,
      COALESCE(SUM(duration_seconds), 0) as duration,
      COALESCE(SUM(distance_meters), 0) as distance
    FROM workouts WHERE user_id = ? AND started_at >= datetime('now', '-7 days')
  `).get(userId) as { count: number; duration: number; distance: number };

  return (
    <div>
      <Navigation />
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 60px" }}>

        <div style={{ marginBottom: 32 }}>
          <p style={{ fontSize: 13, color: "var(--text-subtle)", marginBottom: 4 }}>Welcome back</p>
          <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em" }}>
            {session.user.username}
          </h1>
        </div>

        {/* This week */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
          {[
            { value: String(week.count), label: "Workouts this week" },
            { value: formatDuration(week.duration), label: "Active time" },
            { value: formatDistance(week.distance, unit), label: "Distance" },
          ].map((m) => (
            <div key={m.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 18px" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--primary-light)", fontFamily: "var(--font-mono)", letterSpacing: "-0.02em" }}>{m.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* Log buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 36 }}>
          <Link href="/workouts/log/run" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>+ Log Run</Link>
          <Link href="/workouts/log/strength" className="btn btn-primary" style={{ flex: 1, justifyContent: "center" }}>+ Log Strength</Link>
          <Link href="/workouts/log" className="btn btn-secondary" style={{ flex: 1, justifyContent: "center" }}>Other</Link>
        </div>

        {/* Recent workouts */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-muted)" }}>Recent workouts</h2>
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
                      <div className="workout-metric-value" style={{ fontSize: 16 }}>{formatPace(w.avg_pace_seconds_per_km, unit)}</div>
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
