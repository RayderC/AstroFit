export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import db from "@/lib/db";
import Navigation from "../../components/Navigation";
import Link from "next/link";
import { formatDuration, formatDistance, formatPace } from "@/lib/fitness";

export default async function WorkoutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getIronSession<{ user?: { id: number } }>(await cookies(), sessionOptions);
  if (!session.user) redirect("/login");

  const unit = (db.prepare("SELECT unit_preference FROM users WHERE id = ?").get(session.user.id) as { unit_preference: string } | undefined)?.unit_preference as "km" | "mi" ?? "km";

  const workout = db.prepare(`
    SELECT w.*, u.username FROM workouts w
    JOIN users u ON u.id = w.user_id
    WHERE w.id = ? AND w.user_id = ?
  `).get(id, session.user.id) as {
    id: number; type: string; title: string; notes: string; started_at: string;
    duration_seconds: number; distance_meters: number | null;
    avg_pace_seconds_per_km: number | null; avg_heart_rate: number | null;
    max_heart_rate: number | null; elevation_gain_meters: number | null;
    calories: number | null; cadence: number | null;
    gpx_data: string | null; source: string;
  } | undefined;

  if (!workout) notFound();

  const exercises = db.prepare(`
    SELECT we.id, we.exercise_name, we.muscle_group, we.order_index
    FROM workout_exercises we WHERE we.workout_id = ? ORDER BY we.order_index
  `).all(workout.id) as { id: number; exercise_name: string; muscle_group: string; order_index: number }[];

  const setsMap = new Map<number, { set_number: number; reps: number | null; weight_kg: number | null; duration_seconds: number | null }[]>();
  for (const ex of exercises) {
    const sets = db.prepare("SELECT set_number, reps, weight_kg, duration_seconds FROM exercise_sets WHERE workout_exercise_id = ? ORDER BY set_number").all(ex.id) as { set_number: number; reps: number | null; weight_kg: number | null; duration_seconds: number | null }[];
    setsMap.set(ex.id, sets);
  }

  const splits = db.prepare(`
    SELECT split_number, distance_meters, duration_seconds
    FROM run_splits WHERE workout_id = ? ORDER BY split_number
  `).all(workout.id) as { split_number: number; distance_meters: number; duration_seconds: number }[];

  const workoutDate = new Date(workout.started_at).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const typeIcon = workout.type === "run" ? "🏃" : workout.type === "strength" ? "💪" : "⚡";

  return (
    <div>
      <Navigation />
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px 80px" }}>
        <Link href="/workouts" className="back-link">← All Workouts</Link>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
          <div className="workout-type-icon" style={{ width: 56, height: 56, fontSize: 28 }}>{typeIcon}</div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 4 }}>
              {workout.title || (workout.type === "run" ? "Run" : "Strength Session")}
            </h1>
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{workoutDate}</p>
          </div>
        </div>

        {/* Main metrics */}
        <div className="workout-metrics" style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", marginBottom: 20 }}>
          <div className="workout-metric">
            <div className="workout-metric-value">{formatDuration(workout.duration_seconds)}</div>
            <div className="workout-metric-label">Duration</div>
          </div>
          {workout.distance_meters != null && (
            <div className="workout-metric">
              <div className="workout-metric-value">{formatDistance(workout.distance_meters, unit)}</div>
              <div className="workout-metric-label">Distance</div>
            </div>
          )}
          {workout.avg_pace_seconds_per_km != null && (
            <div className="workout-metric">
              <div className="workout-metric-value" style={{ fontSize: 18 }}>{formatPace(workout.avg_pace_seconds_per_km, unit)}</div>
              <div className="workout-metric-label">Avg Pace</div>
            </div>
          )}
          {workout.avg_heart_rate != null && (
            <div className="workout-metric">
              <div className="workout-metric-value">{workout.avg_heart_rate}</div>
              <div className="workout-metric-label">Avg HR (bpm)</div>
            </div>
          )}
          {workout.elevation_gain_meters != null && (
            <div className="workout-metric">
              <div className="workout-metric-value">{Math.round(workout.elevation_gain_meters)}m</div>
              <div className="workout-metric-label">Elevation</div>
            </div>
          )}
          {workout.calories != null && (
            <div className="workout-metric">
              <div className="workout-metric-value">{workout.calories}</div>
              <div className="workout-metric-label">Calories</div>
            </div>
          )}
        </div>

        {/* Notes */}
        {workout.notes && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "16px 20px", marginBottom: 20 }}>
            <div className="metric-card-label" style={{ marginBottom: 8 }}>Notes</div>
            <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.7 }}>{workout.notes}</p>
          </div>
        )}

        {/* Splits (runs) */}
        {splits.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Splits</h2>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Split</th>
                    <th>Distance</th>
                    <th>Time</th>
                    <th>Pace</th>
                  </tr>
                </thead>
                <tbody>
                  {splits.map((s) => (
                    <tr key={s.split_number}>
                      <td style={{ fontFamily: "var(--font-mono)", color: "var(--primary-light)" }}>#{s.split_number}</td>
                      <td>{formatDistance(s.distance_meters, unit)}</td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{formatDuration(s.duration_seconds)}</td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{formatPace(s.duration_seconds / (s.distance_meters / 1000), unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Exercises (strength) */}
        {exercises.length > 0 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Exercises</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {exercises.map((ex) => {
                const sets = setsMap.get(ex.id) ?? [];
                return (
                  <div key={ex.id} className="exercise-block">
                    <div className="exercise-block-header">
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{ex.exercise_name}</div>
                        {ex.muscle_group && <div style={{ fontSize: 11, color: "var(--text-subtle)", textTransform: "capitalize" }}>{ex.muscle_group}</div>}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>{sets.length} sets</div>
                    </div>
                    {sets.length > 0 && (
                      <table className="sets-table">
                        <thead>
                          <tr>
                            <th>Set</th>
                            <th>Reps</th>
                            <th>Weight</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sets.map((s) => (
                            <tr key={s.set_number}>
                              <td style={{ color: "var(--text-subtle)", fontFamily: "var(--font-mono)" }}>{s.set_number}</td>
                              <td style={{ fontWeight: 700 }}>{s.reps ?? "—"}</td>
                              <td style={{ fontFamily: "var(--font-mono)", color: "var(--primary-light)" }}>
                                {s.weight_kg != null ? `${s.weight_kg} kg` : "BW"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 32 }}>
          <Link href={`/workouts/${workout.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
          <DeleteWorkoutButton id={workout.id} />
        </div>
      </main>
    </div>
  );
}

function DeleteWorkoutButton({ id }: { id: number }) {
  return (
    <form action={`/api/workouts/${id}`} method="POST" onSubmit={(e) => {
      if (!confirm("Delete this workout?")) e.preventDefault();
    }}>
      <input type="hidden" name="_method" value="DELETE" />
      <button type="submit" className="btn btn-danger btn-sm">Delete</button>
    </form>
  );
}
