// Time zone helpers for the server. Timestamps are stored in UTC, but "which day / week was this"
// and Strong's zone-less dates depend on the viewer's zone, passed as an IANA name.

const cache = new Map<string, Intl.DateTimeFormat>();

function fmt(tz: string) {
  let f = cache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    cache.set(tz, f);
  }
  return f;
}

/** A valid IANA zone, or UTC if it's missing or unknown. */
export function safeTz(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try { fmt(tz); return tz; } catch { return "UTC"; }
}

function parts(ms: number, tz: string) {
  const o: Record<string, string> = {};
  for (const p of fmt(tz).formatToParts(new Date(ms))) o[p.type] = p.value;
  return o;
}

/** "YYYY-MM-DD HH:MM:SS" wall-clock time in a zone. */
export function localStamp(iso: string, tz: string) {
  const p = parts(Date.parse(iso), tz);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

export const localDay = (iso: string, tz: string) => localStamp(iso, tz).slice(0, 10);

/** Add days to a YYYY-MM-DD day. */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week containing a YYYY-MM-DD day. */
export function mondayOf(day: string) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((dow + 6) % 7));
}

/** Convert a zone-less wall-clock time to a UTC ISO string, honouring that date's DST. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): string {
  const wall = Date.UTC(y, mo - 1, d, h, mi, s);
  let guess = wall;
  // Two passes settle on the right offset, including across a DST change.
  for (let i = 0; i < 2; i++) {
    const p = parts(guess, tz);
    const asWall = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
    guess = wall - (asWall - guess);
  }
  return new Date(guess).toISOString();
}

/** Start of a YYYY-MM-DD day in a zone, as a UTC ISO string. */
export function dayStartUtc(day: string, tz: string) {
  const [y, m, d] = day.split("-").map(Number);
  return zonedToUtc(y, m, d, 0, 0, 0, tz);
}
