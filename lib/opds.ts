// Minimal OPDS 1.2 feed builder. Atom-based XML — OPDS clients consume this
// to browse and download from the library (Panels, Chunky, Paperback, etc).

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface OpdsLink {
  rel: string;
  href: string;
  type: string;
  title?: string;
}

export interface OpdsEntry {
  id: string;
  title: string;
  updated: string;          // ISO 8601
  summary?: string;
  links: OpdsLink[];
  authors?: string[];
}

export interface OpdsFeed {
  id: string;
  title: string;
  updated: string;
  selfHref: string;
  upHref?: string;
  startHref?: string;
  entries: OpdsEntry[];
}

export const OPDS_NAVIGATION_TYPE = "application/atom+xml;profile=opds-catalog;kind=navigation";
export const OPDS_ACQUISITION_TYPE = "application/atom+xml;profile=opds-catalog;kind=acquisition";
export const CBZ_MIME = "application/vnd.comicbook+zip";

function linkToXml(l: OpdsLink): string {
  const t = l.title ? ` title="${escapeXml(l.title)}"` : "";
  return `<link rel="${escapeXml(l.rel)}" href="${escapeXml(l.href)}" type="${escapeXml(l.type)}"${t}/>`;
}

function entryToXml(e: OpdsEntry): string {
  const authors = (e.authors || []).map((a) => `<author><name>${escapeXml(a)}</name></author>`).join("");
  const summary = e.summary ? `<summary type="text">${escapeXml(e.summary)}</summary>` : "";
  return `<entry>
    <id>${escapeXml(e.id)}</id>
    <title>${escapeXml(e.title)}</title>
    <updated>${escapeXml(e.updated)}</updated>
    ${authors}${summary}
    ${e.links.map(linkToXml).join("\n    ")}
  </entry>`;
}

export function feedToXml(f: OpdsFeed): string {
  const baseLinks: OpdsLink[] = [
    { rel: "self", href: f.selfHref, type: OPDS_NAVIGATION_TYPE },
  ];
  if (f.startHref) baseLinks.push({ rel: "start", href: f.startHref, type: OPDS_NAVIGATION_TYPE });
  if (f.upHref) baseLinks.push({ rel: "up", href: f.upHref, type: OPDS_NAVIGATION_TYPE });

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:opds="http://opds-spec.org/2010/catalog">
  <id>${escapeXml(f.id)}</id>
  <title>${escapeXml(f.title)}</title>
  <updated>${escapeXml(f.updated)}</updated>
  ${baseLinks.map(linkToXml).join("\n  ")}
  ${f.entries.map(entryToXml).join("\n  ")}
</feed>`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
