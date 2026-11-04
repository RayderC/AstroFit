/** Draws a GPS route as a line (no map tiles, keeps the strict CSP). */
export default function RouteSvg({ route, height = 160 }: { route: [number, number, number][]; height?: number }) {
  if (!route || route.length < 2) return null;
  const lat0 = route[0][0] * Math.PI / 180;
  const pts = route.map(([la, lo]) => [lo * Math.cos(lat0), -la] as const);
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = maxX - minX || 1e-6, h = maxY - minY || 1e-6;
  const W = 300, H = height, pad = 12;
  const s = Math.min((W - pad * 2) / w, (H - pad * 2) / h);
  const ox = (W - w * s) / 2, oy = (H - h * s) / 2;
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${(ox + (x - minX) * s).toFixed(1)},${(oy + (y - minY) * s).toFixed(1)}`).join(" ");
  const [sx, sy] = [ox + (pts[0][0] - minX) * s, oy + (pts[0][1] - minY) * s];
  const last = pts[pts.length - 1];
  const [ex, ey] = [ox + (last[0] - minX) * s, oy + (last[1] - minY) * s];
  return (
    <svg className="route-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" aria-label="Route">
      <defs>
        <linearGradient id="routeGrad" x1="0" x2="1">
          <stop offset="0" stopColor="var(--accent-cyan)" />
          <stop offset="1" stopColor="var(--primary-light)" />
        </linearGradient>
      </defs>
      <path d={d} fill="none" stroke="url(#routeGrad)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={sx} cy={sy} r="5" fill="var(--success)" />
      <circle cx={ex} cy={ey} r="5" fill="var(--accent-magenta)" />
    </svg>
  );
}

export function haversine(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]);
  const dLon = toR(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Split times per unit (mi or km) from a route. */
export function splitsFromRoute(route: [number, number, number][], unitM: number) {
  const out: { n: number; seconds: number }[] = [];
  let dist = 0, lastT = route[0]?.[2] ?? 0, next = unitM;
  for (let i = 1; i < route.length; i++) {
    const seg = haversine([route[i - 1][0], route[i - 1][1]], [route[i][0], route[i][1]]);
    if (dist + seg >= next && seg > 0) {
      const frac = (next - dist) / seg;
      const t = route[i - 1][2] + (route[i][2] - route[i - 1][2]) * frac;
      out.push({ n: out.length + 1, seconds: (t - lastT) / 1000 });
      lastT = t;
      next += unitM;
    }
    dist += seg;
  }
  return out;
}
