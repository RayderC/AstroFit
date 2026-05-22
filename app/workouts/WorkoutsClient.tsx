"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

interface Workout {
  id: number;
  type: string;
  title: string;
  started_at: string;
  duration_seconds: number;
  distance_meters: number | null;
  notes: string;
  avg_pace_seconds_per_km: number | null;
  calories: number | null;
  elevation_gain_meters: number | null;
}

interface Props {
  workouts: Workout[];
  unit: string;
}

function workoutIcon(type: string) {
  return type === "run" ? "🏃" : type === "strength" ? "💪" : type === "cycling" ? "🚴" : "⚡";
}

function formatDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDistance(m: number | null, unit: string) {
  if (!m) return null;
  return unit === "mi" ? (m / 1609.344).toFixed(2) + " mi" : (m / 1000).toFixed(2) + " km";
}

function formatPace(secPerKm: number | null, unit: string) {
  if (!secPerKm) return null;
  const s = unit === "mi" ? secPerKm * 1.60934 : secPerKm;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")} /${unit}`;
}

function getCalendarData(workouts: Workout[], monthOffset = 0) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + monthOffset;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const days: Array<{ date: number | null; dateStr: string | null; workouts: Workout[] }> = [];
  for (let i = 0; i < startPad; i++) days.push({ date: null, dateStr: null, workouts: [] });
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const y = firstDay.getFullYear();
    const mo = String(firstDay.getMonth() + 1).padStart(2, "0");
    const dateStr = `${y}-${mo}-${String(d).padStart(2, "0")}`;
    days.push({ date: d, dateStr, workouts: workouts.filter((w) => w.started_at.startsWith(dateStr)) });
  }
  return {
    days,
    monthLabel: firstDay.toLocaleString("default", { month: "long", year: "numeric" }),
    year: firstDay.getFullYear(),
    month: firstDay.getMonth(),
  };
}

const TYPE_FILTERS = [
  { key: "all", label: "All" },
  { key: "run", label: "🏃 Runs" },
  { key: "strength", label: "💪 Strength" },
  { key: "cycling", label: "🚴 Cycling" },
] as const;

export default function WorkoutsClient({ workouts, unit }: Props) {
  const [view, setView] = useState<"feed" | "calendar">("feed");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [monthOffset, setMonthOffset] = useState(0);

  const filtered = useMemo(() =>
    typeFilter === "all" ? workouts : workouts.filter((w) => w.type === typeFilter),
  [workouts, typeFilter]);

  const { days, monthLabel } = getCalendarData(workouts, monthOffset);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Week totals for calendar
  const weekRows: Workout[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weekRows.push(days.slice(i, i + 7).flatMap((d) => d.workouts));
  }

  // Stats summary for current filter
  const totalDist = filtered.reduce((sum, w) => sum + (w.distance_meters ?? 0), 0);
  const totalDur = filtered.reduce((sum, w) => sum + w.duration_seconds, 0);

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div className="section-eyebrow">Activity</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Workouts</h1>
        </div>
        <Link href="/workouts/log" className="btn btn-primary">+ Log Workout</Link>
      </div>

      {/* View + type filter row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div className="view-tabs" style={{ marginBottom: 0 }}>
          <button className={`view-tab${view === "feed" ? " active" : ""}`} onClick={() => setView("feed")}>Feed</button>
          <button className={`view-tab${view === "calendar" ? " active" : ""}`} onClick={() => setView("calendar")}>Calendar</button>
        </div>
        <div style={{ width: 1, height: 28, background: "var(--border)" }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              style={{
                padding: "5px 12px", borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: typeFilter === f.key ? "1px solid var(--primary-light)" : "1px solid var(--border-bright)",
                background: typeFilter === f.key ? "var(--primary-glow)" : "var(--surface-2)",
                color: typeFilter === f.key ? "var(--primary-light)" : "var(--text-muted)",
                transition: "all 0.15s",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filtered.length > 0 && (
          <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>
            {filtered.length} workouts · {totalDur > 0 ? formatDuration(totalDur) : ""}{totalDist > 0 ? ` · ${unit === "mi" ? (totalDist / 1609.344).toFixed(0) + " mi" : (totalDist / 1000).toFixed(0) + " km"}` : ""}
          </div>
        )}
      </div>

      {view === "feed" && (
        <>
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏃</div>
              <div className="empty-title">{typeFilter === "all" ? "No workouts logged yet" : `No ${typeFilter} workouts yet`}</div>
              <div className="empty-desc">Start tracking your fitness journey today</div>
              <Link href="/workouts/log" className="btn btn-primary">Log First Workout</Link>
            </div>
          ) : (
            <div className="workout-feed">
              {filtered.map((w) => (
                <Link key={w.id} href={`/workouts/${w.id}`} className="workout-card">
                  <div className="workout-card-header">
                    <div className="workout-type-icon">{workoutIcon(w.type)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="workout-card-title">{w.title || (w.type === "run" ? "Run" : w.type === "strength" ? "Strength Session" : "Workout")}</div>
                      <div className="workout-card-date">
                        {new Date(w.started_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
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
                        <div className="workout-metric-value" style={{ fontSize: 15 }}>{formatPace(w.avg_pace_seconds_per_km, unit)}</div>
                        <div className="workout-metric-label">Avg Pace</div>
                      </div>
                    )}
                    {w.elevation_gain_meters != null && w.elevation_gain_meters > 0 && (
                      <div className="workout-metric">
                        <div className="workout-metric-value">↑{Math.round(w.elevation_gain_meters)}m</div>
                        <div className="workout-metric-label">Elevation</div>
                      </div>
                    )}
                    {w.calories != null && w.calories > 0 && (
                      <div className="workout-metric">
                        <div className="workout-metric-value">{w.calories}</div>
                        <div className="workout-metric-label">kcal</div>
                      </div>
                    )}
                  </div>
                  {w.notes && <div className="workout-card-notes">{w.notes.length > 120 ? w.notes.slice(0, 120) + "…" : w.notes}</div>}
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {view === "calendar" && (
        <div>
          {/* Month navigation */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <button
              onClick={() => setMonthOffset((o) => o - 1)}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20, padding: "4px 8px" }}
            >‹</button>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-muted)" }}>{monthLabel}</h2>
            <button
              onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
              style={{ background: "none", border: "none", color: monthOffset === 0 ? "var(--text-subtle)" : "var(--text-muted)", cursor: monthOffset === 0 ? "default" : "pointer", fontSize: 20, padding: "4px 8px" }}
              disabled={monthOffset === 0}
            >›</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="calendar-day-header">{d}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((cell, i) => (
              <div key={i} className={`calendar-cell${cell.dateStr === todayStr ? " today" : ""}${!cell.date ? " other-month" : ""}`}>
                {cell.date && (
                  <>
                    <div className="calendar-cell-date">{cell.date}</div>
                    {cell.workouts.map((w) => (
                      <Link key={w.id} href={`/workouts/${w.id}`} style={{ display: "block", textDecoration: "none" }}>
                        <div className={`calendar-workout-dot ${w.type}`}>
                          {workoutIcon(w.type)}{" "}
                          <span style={{ fontSize: 9, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {w.title || w.type}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Week totals */}
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 4 }}>
            {weekRows.map((wkWorkouts, wi) => {
              if (wkWorkouts.length === 0) return null;
              const wkDist = wkWorkouts.reduce((s, w) => s + (w.distance_meters ?? 0), 0);
              const wkDur = wkWorkouts.reduce((s, w) => s + w.duration_seconds, 0);
              return (
                <div key={wi} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", background: "var(--surface)", borderRadius: "var(--radius-sm)", fontSize: 12, color: "var(--text-muted)" }}>
                  <span style={{ fontWeight: 600 }}>Wk {wi + 1}:</span>
                  <span>{wkWorkouts.length} workout{wkWorkouts.length !== 1 ? "s" : ""}</span>
                  {wkDur > 0 && <span>· {formatDuration(wkDur)}</span>}
                  {wkDist > 0 && <span>· {unit === "mi" ? (wkDist / 1609.344).toFixed(1) + " mi" : (wkDist / 1000).toFixed(1) + " km"}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
