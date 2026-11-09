// GPS math shared by the tracker, the cardio card and the server's records. No imports, so it runs on both sides.

export type RoutePoint = [lat: number, lon: number, tMs: number];

export function haversine(a: [number, number], b: [number, number]) {
  const R = 6371000;
  const toR = (x: number) => (x * Math.PI) / 180;
  const dLat = toR(b[0] - a[0]);
  const dLon = toR(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const EFFORTS = [
  { label: "1K", m: 1000 },
  { label: "1 mile", m: 1609.344 },
  { label: "5K", m: 5000 },
  { label: "10K", m: 10000 },
  { label: "Half marathon", m: 21097.5 },
  { label: "Marathon", m: 42195 },
];

/**
 * Fastest time over each distance anywhere inside a GPS track, like a watch's "best efforts". A 5K
 * inside a 10K run counts. Returns seconds per label, only for distances the track covers.
 */
export function bestEfforts(route: RoutePoint[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!route || route.length < 2) return out;
  const cum = [0];
  for (let i = 1; i < route.length; i++) cum.push(cum[i - 1] + haversine([route[i - 1][0], route[i - 1][1]], [route[i][0], route[i][1]]));
  const total = cum[cum.length - 1];
  for (const e of EFFORTS) {
    if (total < e.m) continue;
    let best = Infinity;
    let i = 0;
    for (let j = 1; j < route.length; j++) {
      // Slide the start forward while the window still covers the distance.
      while (i + 1 < j && cum[j] - cum[i + 1] >= e.m) i++;
      const d = cum[j] - cum[i];
      if (d < e.m) continue;
      const t = (route[j][2] - route[i][2]) / 1000;
      // The window can overshoot by part of a GPS step, so scale it back to the exact distance.
      if (t > 0) best = Math.min(best, (t * e.m) / d);
    }
    if (isFinite(best)) out.set(e.label, best);
  }
  return out;
}

/** Split times per unit (mi or km) from a route. */
export function splitsFromRoute(route: RoutePoint[], unitM: number) {
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

/** Rides are shown as speed; everything else on foot or in water as pace. */
export const showsSpeed = (icon: string | null | undefined) => icon === "bike";
