"use client";
import { useState, useEffect } from "react";

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
    <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", padding: "24px 0" }}>
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
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {yLabels.map((v, i) => {
        const y = toY(v);
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="var(--border)" strokeWidth="1" />
            <text x={PL - 4} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">{v}</text>
          </g>
        );
      })}
      {/* Area */}
      <path d={areaD} fill="url(#chartGrad)" />
      {/* Line */}
      <path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={toX(i)} cy={toY(p.value)} r="3.5" fill={color} />
      ))}
      {/* X labels */}
      <text x={PL} y={H - 4} fontSize="10" fill="var(--text-muted)">{xFirst}</text>
      <text x={W - PR} y={H - 4} fontSize="10" fill="var(--text-muted)" textAnchor="end">{xLast}</text>
    </svg>
  );
}

export default function ProgressPage() {
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

    // Group by date, pick best set per day
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
          // Epley 1RM estimate
          value = Math.max(...sets.map(s => s.weight * (1 + s.reps / 30)));
        }
        return { date, value: Math.round(value * 10) / 10, label: `${value.toFixed(1)}kg` };
      });

    return points.slice(-30); // last 30 sessions
  };

  const filtered = exercises.filter(e =>
    !query || e.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 24 }}>Progress</h1>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, alignItems: "start" }}>
        {/* Exercise selector */}
        <div className="card" style={{ padding: 12 }}>
          <input
            className="form-input"
            placeholder="Search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{ marginBottom: 10, fontSize: "0.85rem" }}
          />
          <div style={{ maxHeight: 480, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map(ex => (
              <button
                key={ex.id}
                onClick={() => setSelectedId(ex.id)}
                style={{
                  background: selectedId === ex.id ? "rgba(124,14,179,0.15)" : "transparent",
                  border: "1px solid",
                  borderColor: selectedId === ex.id ? "var(--primary)" : "transparent",
                  borderRadius: 6,
                  padding: "6px 10px",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "var(--text)",
                  fontSize: "0.85rem",
                  fontWeight: selectedId === ex.id ? 600 : 400,
                }}
              >
                {ex.name}
              </button>
            ))}
          </div>
        </div>

        {/* Chart panel */}
        <div>
          {!selectedId ? (
            <div className="empty-state">Select an exercise to see progress charts.</div>
          ) : historyLoading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
              {history?.pr && (
                <div className="card" style={{ marginBottom: 16, background: "rgba(124,14,179,0.08)", borderColor: "var(--primary)" }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--primary-light)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Personal Record</div>
                  <div style={{ display: "flex", gap: 20 }}>
                    <div>
                      <span style={{ fontSize: "1.3rem", fontWeight: 700 }}>{history.pr.best_weight}kg</span>
                      <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginLeft: 4 }}>× {history.pr.best_reps} reps</span>
                    </div>
                    <div>
                      <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>Est. 1RM: </span>
                      <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-cyan)" }}>{history.pr.estimated_1rm.toFixed(1)}kg</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>Last 30 Sessions</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {(["weight", "volume", "1rm"] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setMetric(m)}
                        style={{
                          padding: "3px 10px",
                          borderRadius: 4,
                          fontSize: "0.78rem",
                          cursor: "pointer",
                          border: "1px solid",
                          borderColor: metric === m ? "var(--primary-light)" : "var(--border)",
                          background: metric === m ? "rgba(168,85,247,0.15)" : "transparent",
                          color: metric === m ? "var(--primary-light)" : "var(--text-muted)",
                        }}
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
                  <div style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: 12 }}>Recent Sets</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
                    {history.sets.slice(0, 20).map((s, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--text)" }}>{s.weight}kg × {s.reps} reps</span>
                        <span style={{ color: "var(--text-muted)" }}>
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
