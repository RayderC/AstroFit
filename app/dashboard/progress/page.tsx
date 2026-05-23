"use client";
import { useState, useEffect } from "react";
import { useUnits } from "@/app/context/UnitsContext";

interface Exercise {
  id: number;
  name: string;
  category: string;
}

interface HistorySet {
  weight: number;
  reps: number;
  workout_date: string;
}

interface PR {
  exercise_id: number;
  best_weight: number;
  best_reps: number;
  estimated_1rm: number;
  achieved_at: string;
}

interface ExerciseHistory {
  sets: HistorySet[];
  pr: PR | null;
}

interface ChartPoint {
  date: string;
  value: number;
  label: string;
}

function LineChart({ points, color = "var(--primary-light)" }: { points: ChartPoint[]; color?: string }) {
  if (points.length < 2) return (
    <div className="text-muted" style={{ textAlign: "center", fontSize: 14, padding: "24px 0" }}>
      Not enough data to show a chart yet.
    </div>
  );

  const W = 500, H = 160, PL = 48, PR = 16, PT = 12, PB = 28;
  const iW = W - PL - PR;
  const iH = H - PT - PB;
  const vals = points.map(p => p.value);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const pad = range * 0.1;

  const toX = (i: number) => PL + (i / (points.length - 1)) * iW;
  const toY = (v: number) => PT + iH - ((v - (minV - pad)) / (range + pad * 2)) * iH;

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(p.value).toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${toX(points.length - 1).toFixed(1)} ${(PT + iH).toFixed(1)} L ${PL} ${(PT + iH).toFixed(1)} Z`;

  const yLabels = [minV, minV + (maxV - minV) / 2, maxV].map(v => Math.round(v));
  const xFirst = new Date(points[0].date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const xLast = new Date(points[points.length - 1].date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yLabels.map((v, i) => {
          const y = toY(v);
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={PL - 4} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">{v}</text>
            </g>
          );
        })}
        <path d={areaD} fill="url(#chartGrad)" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={toX(i)} cy={toY(p.value)} r="3.5" fill={color} />
        ))}
        <text x={PL} y={H - 4} fontSize="10" fill="var(--text-muted)">{xFirst}</text>
        <text x={W - PR} y={H - 4} fontSize="10" fill="var(--text-muted)" textAnchor="end">{xLast}</text>
      </svg>
    </div>
  );
}

export default function ProgressPage() {
  const { weightUnit } = useUnits();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [history, setHistory] = useState<ExerciseHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [metric, setMetric] = useState<"weight" | "volume" | "1rm">("weight");

  useEffect(() => {
    fetch("/api/exercises?limit=200").then(r => r.json()).then(setExercises);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setHistoryLoading(true);
    fetch(`/api/exercises/${selectedId}/history`).then(r => r.json()).then(d => {
      setHistory(d);
      setHistoryLoading(false);
    });
  }, [selectedId]);

  const getChartPoints = (): ChartPoint[] => {
    if (!history?.sets.length) return [];
    const byDate: Record<string, HistorySet[]> = {};
    for (const s of history.sets) {
      const date = s.workout_date.split("T")[0];
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(s);
    }
    const points: ChartPoint[] = Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sets]) => {
        let value: number;
        if (metric === "weight") {
          value = Math.max(...sets.map(s => s.weight));
        } else if (metric === "volume") {
          value = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
        } else {
          value = Math.max(...sets.map(s => s.weight * (1 + s.reps / 30)));
        }
        return { date, value: Math.round(value * 10) / 10, label: `${value.toFixed(1)}${weightUnit}` };
      });
    return points.slice(-30);
  };

  const filtered = exercises.filter(e => !query || e.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="content-narrow">
      <div className="dash-header">
        <h1 className="dash-title">Progress</h1>
      </div>

      <div className="progress-grid">
        <div className="card" style={{ padding: 12 }}>
          <input
            className="form-input"
            placeholder="Search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ marginBottom: 10 }}
          />
          <div className="progress-exercise-list">
            {filtered.map(ex => (
              <button
                key={ex.id}
                className={`progress-exercise-btn${selectedId === ex.id ? " selected" : ""}`}
                onClick={() => setSelectedId(ex.id)}
              >
                {ex.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          {!selectedId ? (
            <div className="empty-state">Select an exercise to see progress charts.</div>
          ) : historyLoading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
              {history?.pr && (
                <div className="pr-banner" style={{ marginBottom: 16 }}>
                  <div className="pr-banner-label">Personal Record</div>
                  <div className="pr-banner-values">
                    <div>
                      <span className="pr-banner-main">{history.pr.best_weight}{weightUnit}</span>
                      <span className="pr-banner-reps">× {history.pr.best_reps} reps</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Est. 1RM</div>
                      <span className="pr-banner-1rm">{history.pr.estimated_1rm.toFixed(1)}{weightUnit}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-header">
                  <span className="card-title">Last 30 Sessions</span>
                  <div className="metric-tabs">
                    {(["weight", "volume", "1rm"] as const).map(m => (
                      <button
                        key={m}
                        className={`metric-tab${metric === m ? " active" : ""}`}
                        onClick={() => setMetric(m)}
                      >
                        {m === "1rm" ? "Est. 1RM" : m.charAt(0).toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <LineChart points={getChartPoints()} color={metric === "volume" ? "var(--accent-cyan)" : "var(--primary-light)"} />
              </div>

              {history && history.sets.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <span className="card-title">Recent Sets</span>
                  </div>
                  <div className="recent-sets-scroll">
                    {history.sets.slice(0, 20).map((s, i) => (
                      <div key={i} className="recent-set-row">
                        <span>{s.weight}{weightUnit} × {s.reps} reps</span>
                        <span className="text-muted">
                          {new Date(s.workout_date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {history && history.sets.length === 0 && (
                <div className="empty-state">No completed sets logged for this exercise yet.</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
