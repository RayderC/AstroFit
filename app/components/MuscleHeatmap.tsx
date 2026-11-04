"use client";

import { useState } from "react";
import { MUSCLES } from "@/lib/exerciseSeed";

// Stylised front/back body. Each region maps to a muscle id; colour = weekly working sets.
type Region = { m: string; d: string };

const FRONT: Region[] = [
  { m: "traps", d: "M42 30 L50 27 L58 30 L56 35 L44 35 Z" },
  { m: "front_delts", d: "M33 36 Q30 38 29 46 L36 46 L39 37 Z M67 36 Q70 38 71 46 L64 46 L61 37 Z" },
  { m: "side_delts", d: "M29 38 Q25 41 25 48 L29 47 Z M71 38 Q75 41 75 48 L71 47 Z" },
  { m: "chest", d: "M39 37 L50 38 L50 52 Q43 54 37 50 L36 46 Z M61 37 L50 38 L50 52 Q57 54 63 50 L64 46 Z" },
  { m: "biceps", d: "M27 50 L34 50 L33 64 L27 63 Z M73 50 L66 50 L67 64 L73 63 Z" },
  { m: "forearms", d: "M26 66 L33 66 L31 84 L26 83 Z M74 66 L67 66 L69 84 L74 83 Z" },
  { m: "abs", d: "M44 55 L56 55 L55 82 L45 82 Z" },
  { m: "obliques", d: "M38 54 L43 55 L44 80 L39 76 Z M62 54 L57 55 L56 80 L61 76 Z" },
  { m: "quads", d: "M38 90 L48 92 L47 124 L40 124 Q36 108 38 90 Z M62 90 L52 92 L53 124 L60 124 Q64 108 62 90 Z" },
  { m: "adductors", d: "M48 92 L50 94 L52 92 L50 112 Z" },
  { m: "calves", d: "M39 132 L46 132 L45 158 L41 158 Z M61 132 L54 132 L55 158 L59 158 Z" },
];

const BACK: Region[] = [
  { m: "traps", d: "M40 30 L50 26 L60 30 L56 46 L50 50 L44 46 Z" },
  { m: "rear_delts", d: "M33 36 Q27 39 26 47 L33 47 L38 38 Z M67 36 Q73 39 74 47 L67 47 L62 38 Z" },
  { m: "upper_back", d: "M38 39 L44 46 L50 50 L56 46 L62 39 L63 50 L50 56 L37 50 Z" },
  { m: "lats", d: "M37 50 L50 57 L50 70 L42 74 Q37 64 37 50 Z M63 50 L50 57 L50 70 L58 74 Q63 64 63 50 Z" },
  { m: "lower_back", d: "M43 74 L50 71 L57 74 L56 84 L44 84 Z" },
  { m: "triceps", d: "M27 49 L34 49 L33 64 L27 63 Z M73 49 L66 49 L67 64 L73 63 Z" },
  { m: "forearms", d: "M26 66 L33 66 L31 84 L26 83 Z M74 66 L67 66 L69 84 L74 83 Z" },
  { m: "glutes", d: "M39 86 L50 87 L50 100 Q42 102 38 96 Z M61 86 L50 87 L50 100 Q58 102 62 96 Z" },
  { m: "hamstrings", d: "M38 101 L48 103 L47 128 L40 128 Z M62 101 L52 103 L53 128 L60 128 Z" },
  { m: "calves", d: "M39 132 L46 132 L46 152 L42 158 L39 150 Z M61 132 L54 132 L54 152 L58 158 L61 150 Z" },
];

// silhouette for context
const OUTLINE = "M50 6 a8 8 0 1 1 -0.01 0 Z M42 24 L58 24 L60 30 L70 34 Q78 38 77 50 L76 66 L76 86 L71 88 L72 66 L68 54 L64 54 L64 86 L63 92 L62 130 L60 162 L54 162 L52 130 L50 100 L48 130 L46 162 L40 162 L38 130 L37 92 L36 86 L36 54 L32 54 L28 66 L29 88 L24 86 L24 66 L23 50 Q22 38 30 34 L40 30 Z";

export function heatColor(sets: number) {
  if (!sets) return "var(--surface-3)";
  if (sets < 4) return "rgba(168, 85, 247, 0.35)";
  if (sets < 8) return "rgba(168, 85, 247, 0.65)";
  if (sets < 12) return "rgba(124, 58, 237, 0.9)";
  if (sets < 18) return "rgba(34, 211, 238, 0.8)";
  return "rgba(244, 114, 182, 0.9)";
}

function Figure({ regions, data, label, onHover }: { regions: Region[]; data: Record<string, number>; label: string; onHover: (m: string | null) => void }) {
  return (
    <svg viewBox="15 0 70 168" role="img" aria-label={`${label} muscles`}>
      <path d={OUTLINE} fill="var(--surface-2)" stroke="var(--border-bright)" strokeWidth="0.6" />
      {regions.map((r, i) => (
        <path key={i} d={r.d} fill={heatColor(data[r.m] ?? 0)} stroke="rgba(10,10,18,0.8)" strokeWidth="0.6"
          onMouseEnter={() => onHover(r.m)} onMouseLeave={() => onHover(null)} onClick={() => onHover(r.m)} style={{ cursor: "pointer" }}>
          <title>{`${MUSCLES.find(x => x.id === r.m)?.label}: ${Math.round((data[r.m] ?? 0) * 2) / 2} sets`}</title>
        </path>
      ))}
      <text x="50" y="167" textAnchor="middle" fontSize="5" fill="var(--text-subtle)" fontFamily="var(--font-mono)">{label}</text>
    </svg>
  );
}

export default function MuscleHeatmap({ data }: { data: Record<string, number> }) {
  const [hover, setHover] = useState<string | null>(null);
  const top = MUSCLES.map(m => ({ ...m, v: data[m.id] ?? 0 })).filter(m => m.v > 0).sort((a, b) => b.v - a.v);
  const untrained = MUSCLES.filter(m => !data[m.id]);
  return (
    <div>
      <div className="heatmap">
        <Figure regions={FRONT} data={data} label="FRONT" onHover={setHover} />
        <Figure regions={BACK} data={data} label="BACK" onHover={setHover} />
      </div>
      <div className="chart-tip">
        {hover ? <><b>{MUSCLES.find(m => m.id === hover)?.label}</b> · {Math.round((data[hover] ?? 0) * 2) / 2} sets this week</> :
          top.length ? <>Most: {top.slice(0, 3).map(t => `${t.label} ${Math.round(t.v * 2) / 2}`).join(" · ")}</> : "No lifting in the last 7 days"}
      </div>
      {top.length > 0 && untrained.length > 0 && (
        <div className="form-hint" style={{ marginTop: 4 }}>Not hit: {untrained.map(m => m.label).join(", ")}</div>
      )}
      <div className="heat-legend">
        {[["0", 0], ["1–3", 2], ["4–7", 5], ["8–11", 9], ["12–17", 14], ["18+", 20]].map(([l, v]) => (
          <span key={l as string}><i className="heat-swatch" style={{ background: heatColor(v as number) }} />{l}</span>
        ))}
      </div>
    </div>
  );
}
