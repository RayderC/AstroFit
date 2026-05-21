export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Navigation from "../components/Navigation";
import { formatDuration, formatDistance, formatPace, xpForLevel, levelFromXp, levelProgress } from "@/lib/fitness";

interface WeekRow { week: string; count: number; distance_meters: number; duration_seconds: number }
interface MonthRow { month: string; distance_meters: number }
interface PaceRow { started_at: string; avg_pace_seconds_per_km: number; distance_meters: number }
interface PR { record_type: string; value: number; achieved_at: string; title: string }
interface StrengthWeek { week: string; volume_kg: number; sessions: number }
interface TopExercise { exercise_name: string; best_weight: number; best_1rm: number; session_count: number; last_used: string }

const PR_LABELS: Record<string, { label: string; dist_km: number }> = {
  "1km": { label: "1 km", dist_km: 1 },
  "5km": { label: "5 km", dist_km: 5 },
  "10km": { label: "10 km", dist_km: 10 },
  "half_marathon": { label: "Half Marathon", dist_km: 21.097 },
  "marathon": { label: "Marathon", dist_km: 42.195 },
};

export default async function StatsPage() {
  const session = await getIronSession<{ user?: { id: number } }>(await cookies(), sessionOptions);
  if (!session.user) redirect("/login");
  const userId = session.user.id;

  const unit = (db.prepare("SELECT unit_preference FROM users WHERE id = ?").get(userId) as { unit_preference: string } | undefined)?.unit_preference as "km" | "mi" ?? "km";

  const weeklyRuns = db.prepare(`
    SELECT strftime('%Y-W%W', started_at) as week, COUNT(*) as count,
           COALESCE(SUM(distance_meters),0) as distance_meters,
           COALESCE(SUM(duration_seconds),0) as duration_seconds
    FROM workouts WHERE user_id = ? AND type = 'run'
      AND started_at >= datetime('now', '-84 days')
    GROUP BY week ORDER BY week
  `).all(userId) as WeekRow[];

  const monthlyDistance = db.prepare(`
    SELECT strftime('%Y-%m', started_at) as month,
           COALESCE(SUM(distance_meters),0) as distance_meters
    FROM workouts WHERE user_id = ? AND type = 'run'
      AND started_at >= datetime('now', '-180 days')
    GROUP BY month ORDER BY month
  `).all(userId) as MonthRow[];

  const paceTrend = db.prepare(`
    SELECT started_at, avg_pace_seconds_per_km, distance_meters
    FROM workouts WHERE user_id = ? AND type = 'run' AND avg_pace_seconds_per_km IS NOT NULL
    ORDER BY started_at DESC LIMIT 15
  `).all(userId) as PaceRow[];

  const totals = db.prepare(`
    SELECT COUNT(*) as total_workouts,
           COUNT(CASE WHEN type='run' THEN 1 END) as total_runs,
           COUNT(CASE WHEN type='strength' THEN 1 END) as total_strength,
           COALESCE(SUM(CASE WHEN type='run' THEN distance_meters END),0) as total_distance,
           COALESCE(SUM(duration_seconds),0) as total_duration,
           COALESCE(SUM(calories),0) as total_calories
    FROM workouts WHERE user_id = ?
  `).get(userId) as {
    total_workouts: number; total_runs: number; total_strength: number;
    total_distance: number; total_duration: number; total_calories: number;
  };

  const weeklyStrength = db.prepare(`
    SELECT strftime('%Y-W%W', w.started_at) as week,
           COALESCE(SUM(CASE WHEN es.reps IS NOT NULL AND es.weight_kg IS NOT NULL THEN es.reps * es.weight_kg ELSE 0 END), 0) as volume_kg,
           COUNT(DISTINCT w.id) as sessions
    FROM workouts w
    JOIN workout_exercises we ON we.workout_id = w.id
    JOIN exercise_sets es ON es.workout_exercise_id = we.id
    WHERE w.user_id = ? AND w.type = 'strength'
      AND w.started_at >= datetime('now', '-84 days')
    GROUP BY week ORDER BY week
  `).all(userId) as StrengthWeek[];

  const topExercises = db.prepare(`
    SELECT we.exercise_name,
           ROUND(MAX(es.weight_kg), 1) as best_weight,
           ROUND(MAX(CASE WHEN es.reps IS NOT NULL AND es.weight_kg IS NOT NULL THEN es.weight_kg * (1 + es.reps / 30.0) ELSE 0 END), 1) as best_1rm,
           COUNT(DISTINCT w.id) as session_count,
           MAX(w.started_at) as last_used
    FROM workouts w
    JOIN workout_exercises we ON we.workout_id = w.id
    JOIN exercise_sets es ON es.workout_exercise_id = we.id
    WHERE w.user_id = ? AND w.type = 'strength'
      AND es.weight_kg IS NOT NULL AND es.weight_kg > 0
    GROUP BY LOWER(we.exercise_name)
    ORDER BY session_count DESC, best_weight DESC
    LIMIT 8
  `).all(userId) as TopExercise[];

  const prs = db.prepare(`
    SELECT pr.record_type, pr.value, pr.achieved_at, w.title
    FROM personal_records pr LEFT JOIN workouts w ON w.id = pr.workout_id
    WHERE pr.user_id = ? ORDER BY pr.record_type
  `).all(userId) as PR[];

  const xpRow = db.prepare("SELECT total_xp, level FROM user_xp WHERE user_id = ?").get(userId) as
    | { total_xp: number; level: number } | undefined;
  const totalXp = xpRow?.total_xp ?? 0;
  const level = levelFromXp(totalXp);
  const progress = levelProgress(totalXp);
  const xpToNext = xpForLevel(level + 1) - totalXp;

  const maxWeekDist = Math.max(...weeklyRuns.map((w) => w.distance_meters), 1);
  const maxMonthDist = Math.max(...monthlyDistance.map((m) => m.distance_meters), 1);
  const maxStrengthVol = Math.max(...weeklyStrength.map((w) => w.volume_kg), 1);
  const minPace = paceTrend.length ? Math.min(...paceTrend.map((p) => p.avg_pace_seconds_per_km)) : 0;
  const maxPace = paceTrend.length ? Math.max(...paceTrend.map((p) => p.avg_pace_seconds_per_km)) : 1;
  const paceRange = maxPace - minPace || 1;

  return (
    <div>
      <Navigation />
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px" }}>
        <div className="section-eyebrow">Analytics</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 28 }}>Stats</h1>

        {/* Level & XP */}
        <div className="metric-card" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 2 }}>Fitness Level</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: "var(--primary-light)" }}>{level}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{totalXp.toLocaleString()} XP total</div>
              <div style={{ fontSize: 12, color: "var(--text-subtle)", marginTop: 2 }}>{xpToNext.toLocaleString()} XP to Level {level + 1}</div>
            </div>
          </div>
          <div className="xp-bar">
            <div className="xp-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </div>

        {/* All-time totals */}
        <div className="metrics-grid" style={{ marginBottom: 28 }}>
          {[
            { label: "Total Workouts", value: String(totals.total_workouts) },
            { label: "Total Runs", value: String(totals.total_runs) },
            { label: "Strength Sessions", value: String(totals.total_strength) },
            { label: "Total Distance", value: formatDistance(totals.total_distance, unit) },
            { label: "Total Time", value: formatDuration(totals.total_duration) },
            { label: "Calories Burned", value: totals.total_calories > 0 ? totals.total_calories.toLocaleString() : "—" },
          ].map((m) => (
            <div key={m.label} className="metric-card">
              <div className="metric-card-value">{m.value}</div>
              <div className="metric-card-label">{m.label}</div>
            </div>
          ))}
        </div>

        {/* Personal Records */}
        {prs.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Personal Records</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
              {prs.map((pr) => {
                const meta = PR_LABELS[pr.record_type];
                const totalSeconds = pr.value;
                const h = Math.floor(totalSeconds / 3600);
                const m = Math.floor((totalSeconds % 3600) / 60);
                const s = Math.floor(totalSeconds % 60);
                const timeStr = h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
                return (
                  <div key={pr.record_type} className="pr-card">
                    <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent-cyan)", marginBottom: 4 }}>
                      {meta?.label ?? pr.record_type}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", fontFamily: "var(--font-mono)" }}>{timeStr}</div>
                    <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 4 }}>{new Date(pr.achieved_at).toLocaleDateString()}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Weekly distance bar chart */}
        {weeklyRuns.length > 0 && (
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Weekly Running Distance (12 weeks)</div>
            <div className="bar-chart">
              {weeklyRuns.map((w) => {
                const pct = (w.distance_meters / maxWeekDist) * 100;
                const label = w.week.replace(/^\d+-W/, "W");
                const distLabel = unit === "mi" ? `${(w.distance_meters / 1609.344).toFixed(1)}` : `${(w.distance_meters / 1000).toFixed(1)}`;
                return (
                  <div key={w.week} className="bar-chart-col">
                    <div className="bar-chart-bar-wrap">
                      {pct > 0 && <div className="bar-chart-value">{distLabel}</div>}
                      <div className="bar-chart-bar" style={{ height: `${pct}%` }} />
                    </div>
                    <div className="bar-chart-label">{label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Monthly distance bar chart */}
        {monthlyDistance.length > 0 && (
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Monthly Running Volume (6 months)</div>
            <div className="bar-chart">
              {monthlyDistance.map((m) => {
                const pct = (m.distance_meters / maxMonthDist) * 100;
                const distLabel = unit === "mi" ? `${(m.distance_meters / 1609.344).toFixed(0)}` : `${(m.distance_meters / 1000).toFixed(0)}`;
                return (
                  <div key={m.month} className="bar-chart-col">
                    <div className="bar-chart-bar-wrap">
                      {pct > 0 && <div className="bar-chart-value" style={{ color: "var(--accent-cyan)" }}>{distLabel}</div>}
                      <div className="bar-chart-bar bar-chart-bar--cyan" style={{ height: `${pct}%` }} />
                    </div>
                    <div className="bar-chart-label">{m.month.slice(5)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Weekly strength volume chart */}
        {weeklyStrength.length > 0 && (
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Weekly Strength Volume (12 weeks)</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Total weight lifted (kg) per week</div>
            <div className="bar-chart">
              {weeklyStrength.map((w) => {
                const pct = (w.volume_kg / maxStrengthVol) * 100;
                const label = w.week.replace(/^\d+-W/, "W");
                const volLabel = w.volume_kg >= 1000 ? `${(w.volume_kg / 1000).toFixed(1)}t` : `${Math.round(w.volume_kg)}`;
                return (
                  <div key={w.week} className="bar-chart-col">
                    <div className="bar-chart-bar-wrap">
                      {pct > 0 && <div className="bar-chart-value" style={{ color: "var(--primary-light)" }}>{volLabel}</div>}
                      <div className="bar-chart-bar bar-chart-bar--purple" style={{ height: `${pct}%` }} />
                    </div>
                    <div className="bar-chart-label">{label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Top exercise bests */}
        {topExercises.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Strength Bests</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {topExercises.map((ex) => (
                <div key={ex.exercise_name} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ex.exercise_name}</div>
                  <div style={{ display: "flex", gap: 16, alignItems: "baseline" }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "var(--primary-light)", fontFamily: "var(--font-mono)" }}>{ex.best_weight} kg</div>
                      <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 1 }}>Best set</div>
                    </div>
                    {ex.best_1rm > ex.best_weight && (
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}>{Math.round(ex.best_1rm)} kg</div>
                        <div style={{ fontSize: 10, color: "var(--text-subtle)", marginTop: 1 }}>Est. 1RM</div>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-subtle)", marginTop: 6 }}>{ex.session_count} session{ex.session_count !== 1 ? "s" : ""}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pace trend */}
        {paceTrend.length > 1 && (
          <div className="chart-card" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Recent Pace Trend</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>Last {paceTrend.length} runs — lower bar = faster pace</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
              {[...paceTrend].reverse().map((p, i) => {
                const pct = 100 - ((p.avg_pace_seconds_per_km - minPace) / paceRange) * 80;
                const isRecent = i === paceTrend.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%" }} title={formatPace(p.avg_pace_seconds_per_km, unit)}>
                    <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%", position: "relative" }}>
                      <div style={{ width: "100%", height: `${pct}%`, minHeight: 4, background: isRecent ? "var(--accent-cyan)" : "var(--primary-light)", borderRadius: "2px 2px 0 0", opacity: 0.85 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
              <span>Slowest: {formatPace(maxPace, unit)}</span>
              <span>← Older · Recent →</span>
              <span>Fastest: {formatPace(minPace, unit)}</span>
            </div>
          </div>
        )}

        {totals.total_workouts === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <div className="empty-title">No data yet</div>
            <div className="empty-desc">Log some workouts to see your stats here</div>
          </div>
        )}
      </main>
    </div>
  );
}
