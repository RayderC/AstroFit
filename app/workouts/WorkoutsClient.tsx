"use client";

import Link from "next/link";
import { useState } from "react";

interface Workout {
  id: number;
  type: string;
  title: string;
  started_at: string;
  duration_seconds: number;
  distance_meters: number | null;
  notes: string;
}

interface Props {
  workouts: Workout[];
  unit: string;
  workoutIcon: (type: string) => string;
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

function getCalendarData(workouts: Workout[]) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startPad = (firstDay.getDay() + 6) % 7; // Mon=0
  const days: Array<{ date: number | null; workouts: Workout[] }> = [];

  for (let i = 0; i < startPad; i++) days.push({ date: null, workouts: [] });
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    days.push({
      date: d,
      workouts: workouts.filter((w) => w.started_at.startsWith(dateStr)),
    });
  }
  return { days, monthLabel: now.toLocaleString("default", { month: "long", year: "numeric" }) };
}

export default function WorkoutsClient({ workouts, unit, workoutIcon }: Props) {
  const [view, setView] = useState<"feed" | "calendar">("feed");
  const { days, monthLabel } = getCalendarData(workouts);
  const today = new Date().getDate();

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <div className="section-eyebrow">Activity</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Workouts</h1>
        </div>
        <Link href="/workouts/log" className="btn btn-primary">+ Log Workout</Link>
      </div>

      <div className="view-tabs" style={{ marginBottom: 24 }}>
        <button className={`view-tab${view === "feed" ? " active" : ""}`} onClick={() => setView("feed")}>Feed</button>
        <button className={`view-tab${view === "calendar" ? " active" : ""}`} onClick={() => setView("calendar")}>Calendar</button>
      </div>

      {view === "feed" && (
        <>
          {workouts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏃</div>
              <div className="empty-title">No workouts logged yet</div>
              <div className="empty-desc">Start tracking your fitness journey today</div>
              <Link href="/workouts/log" className="btn btn-primary">Log First Workout</Link>
            </div>
          ) : (
            <div className="workout-feed">
              {workouts.map((w) => (
                <Link key={w.id} href={`/workouts/${w.id}`} className="workout-card">
                  <div className="workout-card-header">
                    <div className="workout-type-icon">{workoutIcon(w.type)}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="workout-card-title">{w.title || (w.type === "run" ? "Run" : "Strength Session")}</div>
                      <div className="workout-card-date">
                        {new Date(w.started_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="badge badge-purple" style={{ textTransform: "capitalize" }}>{w.type}</span>
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
                  {w.notes && <div className="workout-card-notes">{w.notes}</div>}
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {view === "calendar" && (
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: "var(--text-muted)" }}>{monthLabel}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div key={d} className="calendar-day-header">{d}</div>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((cell, i) => (
              <div key={i} className={`calendar-cell${cell.date === today ? " today" : ""}${!cell.date ? " other-month" : ""}`}>
                {cell.date && (
                  <>
                    <div className="calendar-cell-date">{cell.date}</div>
                    {cell.workouts.map((w) => (
                      <Link key={w.id} href={`/workouts/${w.id}`} style={{ display: "block", textDecoration: "none" }}>
                        <div className={`calendar-workout-dot ${w.type}`}>
                          {workoutIcon(w.type)} {w.title || w.type}
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
