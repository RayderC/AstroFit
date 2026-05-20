// ComicInfo.xml is the de-facto metadata schema for CBZ archives (originated
// with ComicRack, used by Komga, Kavita, Mango, etc). We embed one in every
// CBZ we write so the library round-trips cleanly into other tools.

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function tag(name: string, value: string | number | undefined | null): string {
  if (value == null || value === "") return "";
  return `  <${name}>${escapeXml(String(value))}</${name}>\n`;
}

export interface ComicInfoData {
  series: string;
  number?: number;        // chapter number
  title?: string;         // chapter title (optional)
  summary?: string;       // series description
  status?: "ongoing" | "completed" | "hiatus" | "unknown";
  tags?: string[];        // genres / tags from source
  web?: string;           // canonical URL on source
  oneShot?: boolean;
  language?: string;      // ISO 639-1
}

function chapterNumberString(n: number | undefined): string | undefined {
  if (n == null) return undefined;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function buildComicInfoXml(d: ComicInfoData): string {
  const number = chapterNumberString(d.number);
  const genre = (d.tags || []).join(", ");
  // Manga element values per ComicRack: "Yes"/"YesAndRightToLeft"/"Unknown".
  // We don't know reading direction reliably from sources, so omit by default.
  const lines = [
    tag("Title", d.title),
    tag("Series", d.series),
    tag("Number", number),
    tag("Summary", d.summary),
    tag("Genre", genre || undefined),
    tag("Web", d.web),
    tag("LanguageISO", d.language),
    tag("Format", d.oneShot ? "One-Shot" : undefined),
  ].join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
${lines}</ComicInfo>`;
}

// Minimal extractor — read <Series>, <Number>, <Title>, <Summary>, <Genre>.
// Good enough to populate the DB from a CBZ imported from Komga/Kavita.
export function parseComicInfoXml(xml: string): Partial<ComicInfoData> {
  const get = (n: string) => {
    const m = xml.match(new RegExp(`<${n}>([\\s\\S]*?)<\\/${n}>`, "i"));
    return m ? decodeXml(m[1].trim()) : undefined;
  };
  const out: Partial<ComicInfoData> = {};
  const series = get("Series"); if (series) out.series = series;
  const number = get("Number");
  if (number) {
    const n = Number(number);
    if (Number.isFinite(n)) out.number = n;
  }
  const title = get("Title"); if (title) out.title = title;
  const summary = get("Summary"); if (summary) out.summary = summary;
  const genre = get("Genre");
  if (genre) out.tags = genre.split(",").map((s) => s.trim()).filter(Boolean);
  const web = get("Web"); if (web) out.web = web;
  return out;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
