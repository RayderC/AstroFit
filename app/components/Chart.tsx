"use client";

import { useId, useState } from "react";

type Pt = { x: string; y: number };

function niceTicks(min: number, max: number, n = 4) {
  if (min === max) { min -= 1; max += 1; }
  const step0 = (max - min) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(step0)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= step0) ?? step0;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(+v.toFixed(6));
  return out;
}

const shortDate = (iso: string) => new Date(iso.length === 10 ? iso + "T12:00:00" : iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Line chart (or bars with kind="bar") with a tap/hover readout. */
export default function Chart({ points, fmt = v => String(Math.round(v)), kind = "line", color = "var(--primary-light)", height = 180, label }: {
  points: Pt[]; fmt?: (v: number) => string; kind?: "line" | "bar"; color?: string; height?: number; label?: (p: Pt) => string;
}) {
  const [hi, setHi] = useState<number | null>(null);
  const gid = "g" + useId().replace(/:/g, "");
  if (!points.length) return <div className="empty-state-desc" style={{ padding: "30px 0", textAlign: "center" }}>No data yet</div>;

  const W = 600, H = height, L = 44, R = 10, T = 10, B = 24;
  const ys = points.map(p => p.y);
  const ticks = niceTicks(kind === "bar" ? 0 : Math.min(...ys), Math.max(...ys));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const n = points.length;
  const xAt = (i: number) => kind === "bar" ? L + ((i + 0.5) * (W - L - R)) / n : n === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (n - 1);
  const yAt = (v: number) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  const path = points.map((p, i) => `${i ? "L" : "M"}${xAt(i).toFixed(1)},${yAt(p.y).toFixed(1)}`).join(" ");
  const area = `${path} L${xAt(n - 1)},${H - B} L${xAt(0)},${H - B} Z`;
  const labelEvery = Math.max(1, Math.ceil(n / 6));
  const sel = hi ?? n - 1;
  const bw = Math.max(2, ((W - L - R) / n) * 0.65);

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0, d = Infinity;
    points.forEach((_, i) => { const dd = Math.abs(xAt(i) - x); if (dd < d) { d = dd; best = i; } });
    setHi(best);
  }

  return (
    <div className="chart-wrap">
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={() => setHi(null)}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map(t => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={yAt(t)} y2={yAt(t)} stroke="var(--border)" strokeDasharray="2 4" />
            <text x={L - 6} y={yAt(t) + 3} textAnchor="end">{fmt(t)}</text>
          </g>
        ))}
        {points.map((p, i) => i % labelEvery === 0 || i === n - 1 ? (
          <text key={i} x={xAt(i)} y={H - 6} textAnchor="middle">{shortDate(p.x)}</text>
        ) : null)}
        {kind === "line" ? (
          <>
            <path d={area} fill={`url(#${gid})`} />
            <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
            {points.map((p, i) => <circle key={i} cx={xAt(i)} cy={yAt(p.y)} r={i === sel ? 4.5 : n > 40 ? 0 : 2.5} fill={i === sel ? "var(--accent-cyan)" : color} />)}
          </>
        ) : points.map((p, i) => (
          <rect key={i} x={xAt(i) - bw / 2} y={yAt(p.y)} width={bw} height={Math.max(0, H - B - yAt(p.y))} rx="2"
            fill={i === sel ? "var(--accent-cyan)" : color} opacity={i === sel ? 1 : 0.75} />
        ))}
        {hi != null && <line x1={xAt(sel)} x2={xAt(sel)} y1={T} y2={H - B} stroke="var(--accent-cyan)" strokeOpacity="0.35" />}
      </svg>
      <div className="chart-tip">{label ? label(points[sel]) : <>{shortDate(points[sel].x)} · <b>{fmt(points[sel].y)}</b></>}</div>
    </div>
  );
}
