export interface GpxPoint {
  lat: number;
  lon: number;
  ele?: number;
  time?: string;
}

export interface GpxData {
  points: GpxPoint[];
  distanceMeters: number;
  durationSeconds: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  avgPaceSecondsPerKm: number;
}

/** Parse a GPX XML string and extract track points and computed metrics */
export function parseGpx(xml: string): GpxData {
  const trkptRegex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  const eleRegex = /<ele>([^<]+)<\/ele>/;
  const timeRegex = /<time>([^<]+)<\/time>/;

  const points: GpxPoint[] = [];
  let m: RegExpExecArray | null;

  while ((m = trkptRegex.exec(xml)) !== null) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    const inner = m[3];
    const eleMatch = eleRegex.exec(inner);
    const timeMatch = timeRegex.exec(inner);
    points.push({
      lat,
      lon,
      ele: eleMatch ? parseFloat(eleMatch[1]) : undefined,
      time: timeMatch ? timeMatch[1] : undefined,
    });
  }

  let distanceMeters = 0;
  let elevationGainMeters = 0;
  let elevationLossMeters = 0;

  for (let i = 1; i < points.length; i++) {
    distanceMeters += haversineMeters(points[i - 1], points[i]);
    if (points[i].ele !== undefined && points[i - 1].ele !== undefined) {
      const diff = points[i].ele! - points[i - 1].ele!;
      if (diff > 0) elevationGainMeters += diff;
      else elevationLossMeters += Math.abs(diff);
    }
  }

  let durationSeconds = 0;
  const lastTime = points[points.length - 1]?.time;
  if (points.length >= 2 && points[0].time && lastTime) {
    const start = new Date(points[0].time).getTime();
    const end = new Date(lastTime).getTime();
    durationSeconds = Math.round((end - start) / 1000);
  }

  const avgPaceSecondsPerKm =
    distanceMeters > 0 && durationSeconds > 0
      ? durationSeconds / (distanceMeters / 1000)
      : 0;

  return { points, distanceMeters, durationSeconds, elevationGainMeters, elevationLossMeters, avgPaceSecondsPerKm };
}

function haversineMeters(a: GpxPoint, b: GpxPoint): number {
  const R = 6371000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180;
  const sinA = Math.sin(Δφ / 2);
  const sinB = Math.sin(Δλ / 2);
  const x = sinA * sinA + Math.cos(φ1) * Math.cos(φ2) * sinB * sinB;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
