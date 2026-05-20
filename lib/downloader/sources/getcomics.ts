import * as cheerio from "cheerio";
import { File as MegaFile } from "megajs";
import type {
  ChapterPayload,
  ChapterRef,
  ProgressFn,
  SearchResult,
  SeriesMetadata,
  Source,
} from "./types";

const BASE = "https://getcomics.org";
const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

// Priority order for file hosting — direct downloads ranked first
const PREFERRED_HOSTS = [
  /pixeldrain\.com/i,           // public API for direct download
  /getcomics\.(org|info)/i,     // their own CDN/redirect
  /dl\d*\./i,                   // generic CDN subdomains
  /mediafire\.com/i,
  /wetransfer\.com/i,
  /mega\.nz/i,                  // supported via megajs
];
const UNSUPPORTED_HOSTS = /terabox|4shared|zippyshare|rapidgator/i;

void PREFERRED_HOSTS; // referenced for documentation; scoring is inline below

function parseIssueNumber(text: string): number {
  const m =
    text.match(/#\s*(\d+(?:\.\d+)?)/) ||
    text.match(/\bvol(?:ume)?\.?\s*(\d+(?:\.\d+)?)/i) ||
    text.match(/issue\s+(\d+(?:\.\d+)?)/i);
  return m ? parseFloat(m[1]) : 1;
}

function isBinaryContentType(ct: string): boolean {
  if (ct.startsWith("application/octet-stream")) return true;
  if (ct.startsWith("application/zip")) return true;
  if (ct.startsWith("application/x-cbz")) return true;
  if (ct.startsWith("application/x-rar")) return true;
  if (ct.startsWith("application/x-7z")) return true;
  if (ct.startsWith("application/") && !ct.includes("html") && !ct.includes("json") && !ct.includes("xml")) return true;
  return false;
}

function extFromUrlOrCt(url: string, ct: string): "cbz" | "cbr" | "zip" {
  const m = url.match(/\.(cbz|cbr|zip|rar)(?:\?|$)/i);
  if (m) return m[1].toLowerCase() === "rar" ? "cbr" : (m[1].toLowerCase() as "cbz" | "cbr" | "zip");
  if (ct.includes("rar")) return "cbr";
  return "cbz";
}

// Mega.nz download via megajs (handles AES-CTR decryption transparently)
async function downloadFromMega(url: string): Promise<Buffer | null> {
  try {
    const file = MegaFile.fromURL(url);
    await file.loadAttributes();
    const buf = await file.downloadBuffer({});
    return buf as Buffer;
  } catch (e) {
    console.warn("[getcomics] mega download failed:", (e as Error).message);
    return null;
  }
}

// PixelDrain direct download: /u/{id} or /l/{id} → /api/file/{id}?download
async function downloadFromPixelDrain(url: string, signal?: AbortSignal): Promise<Buffer | null> {
  const m = url.match(/pixeldrain\.com\/(?:u|l)\/([A-Za-z0-9]+)/i);
  if (!m) return null;
  const fileId = m[1];
  const apiUrl = `https://pixeldrain.com/api/file/${fileId}?download`;
  try {
    const combined = AbortSignal.any([
      AbortSignal.timeout(120_000),
      ...(signal ? [signal] : []),
    ]);
    const r = await fetch(apiUrl, { headers: UA, signal: combined });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch { return null; }
}

export const getcomicsSource: Source = {
  id: "getcomics",
  type: "comic",

  async search(query: string): Promise<SearchResult[]> {
    let res: Response;
    try {
      res = await fetch(`${BASE}/?s=${encodeURIComponent(query)}`, {
        headers: UA,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      console.warn("[getcomics] search fetch failed:", (e as Error).message);
      return [];
    }
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $("article.type-post, article[class*='post']").each((_, el) => {
      const $el = $(el);
      const titleLink = $el.find("h1 a, h2 a, h3 a, .post-title a").first();
      const title = titleLink.text().trim();
      const url = titleLink.attr("href") || "";
      if (!title || !url) return;

      const imgEl = $el.find("img").first();
      const cover =
        imgEl.attr("src") ||
        imgEl.attr("data-src") ||
        imgEl.attr("data-lazy-src") ||
        undefined;

      const excerpt = $el.find(".entry-summary p, .entry-content p").first().text().trim().slice(0, 280);
      const tags = $el.find(".cat-links a, .post-categories a").map((__, a) => $(a).text().trim()).get().filter(Boolean);

      results.push({ source: "getcomics", type: "comic", title, url, cover, description: excerpt, status: "unknown", tags });
    });

    return results;
  },

  async getMetadata(url: string): Promise<SeriesMetadata> {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`GetComics metadata failed: ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $("h1.post-title, h1.entry-title").first().text().trim() ||
      $("title").text().split(/[-|]/)[0].trim();

    const description = $(".post-contents p, .entry-content p")
      .map((_, p) => $(p).text().trim())
      .get()
      .filter((t) => t && !/^(download|read online)/i.test(t))
      .join("\n\n")
      .slice(0, 1500);

    const cover =
      $(".wp-post-image, .post-thumbnail img").first().attr("src") ||
      $("article img").first().attr("src") || "";

    const tags = $(".post-categories a, .post-tags a, .cat-links a")
      .map((_, a) => $(a).text().trim()).get().filter(Boolean);

    return { title, description, cover: cover || undefined, status: "unknown", tags, oneShot: true };
  },

  async listChapters(url: string): Promise<ChapterRef[]> {
    const slug = url.split("/").filter(Boolean).pop() || "";
    return [{ externalId: url, number: parseIssueNumber(slug.replace(/-/g, " ")), title: "Issue" }];
  },

  async fetchChapter(ref: ChapterRef, onProgress: ProgressFn, signal?: AbortSignal): Promise<ChapterPayload> {
    const fetchSignal = (ms: number) => AbortSignal.any([
      AbortSignal.timeout(ms),
      ...(signal ? [signal] : []),
    ]);

    const postRes = await fetch(ref.externalId, {
      headers: { ...UA, Referer: BASE },
      signal: fetchSignal(30_000),
    });
    if (!postRes.ok) throw new Error(`GetComics post failed: ${postRes.status}`);
    const html = await postRes.text();
    const $ = cheerio.load(html);

    // ── Collect all links on the page ──
    const allLinks: Array<{ url: string; text: string }> = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") || "";
      const text = $(el).text().trim();
      if (href && href !== "#" && !href.startsWith("javascript")) {
        allLinks.push({ url: href, text });
      }
    });

    // ── Score and sort links by likelihood of being the file ──
    interface Candidate { url: string; score: number; text: string; }
    const candidates: Candidate[] = [];
    let lastUnsupportedHostSeen: string | null = null;

    for (const { url, text } of allLinks) {
      let score = 0;

      // Direct archive extension = best
      if (/\.(cbz|cbr|zip|rar)(\?[^"]*)?$/i.test(url)) score += 100;

      // PixelDrain = easy public API
      if (/pixeldrain\.com\/(u|l)\//i.test(url)) score += 80;

      // GetComics own redirect/CDN
      if (/getcomics\.(org|info)\/(go|get|dls?)\//i.test(url)) score += 70;

      // Mega.nz — supported via megajs, ranked below direct hosts
      if (/mega\.nz\/(file|folder)\//i.test(url)) score += 60;

      // Generic CDN-like domains
      if (/dl\d*\.[a-z]+\.(com|net|org)/i.test(url)) score += 40;

      // Download-like link text
      if (/\b(main server|download now|direct|get file)\b/i.test(text)) score += 30;
      if (/\bdownload\b/i.test(text)) score += 15;
      if (/\bmirror\b/i.test(text)) score += 10;

      // Deprioritise known-unsupported hosts — track them for error reporting
      if (UNSUPPORTED_HOSTS.test(url)) {
        try { lastUnsupportedHostSeen = new URL(url).hostname; } catch { /* ignore */ }
        score = Math.max(score - 200, -1);
      }

      if (score > 0) candidates.push({ url, score, text });
    }

    // Deduplicate URLs, keep highest score
    const seen = new Map<string, Candidate>();
    for (const c of candidates) {
      const existing = seen.get(c.url);
      if (!existing || existing.score < c.score) seen.set(c.url, c);
    }
    const ranked = Array.from(seen.values()).sort((a, b) => b.score - a.score);

    if (process.env.DEBUG_DOWNLOADS) {
      console.log(`[getcomics] ${ranked.length} candidate links for ${ref.externalId}`);
      for (const c of ranked.slice(0, 5)) {
        console.log(`  score=${c.score} text="${c.text}" url=${c.url}`);
      }
    }

    if (ranked.length === 0) {
      if (lastUnsupportedHostSeen) {
        return { kind: "unsupported_host", host: lastUnsupportedHostSeen, url: ref.externalId };
      }
      throw new Error(`No download links found on page: ${ref.externalId}`);
    }

    let lastUnsupportedHost: string | null = null;

    for (const { url: candidateUrl } of ranked) {
      // ── PixelDrain: use their download API directly ──
      if (/pixeldrain\.com\/(u|l)\//i.test(candidateUrl)) {
        const buf = await downloadFromPixelDrain(candidateUrl, signal);
        if (buf) {
          onProgress(1, 1);
          return { kind: "archive", data: buf, ext: "cbz" };
        }
        continue;
      }

      // ── Mega.nz: download and decrypt via megajs ──
      if (/mega\.nz\/(file|folder)\//i.test(candidateUrl)) {
        const buf = await downloadFromMega(candidateUrl);
        if (buf) {
          onProgress(1, 1);
          const ext = extFromUrlOrCt(candidateUrl, "");
          return { kind: "archive", data: buf, ext };
        }
        continue;
      }

      // ── Try to resolve to a direct file through redirects ──
      // resolveToDirectFile buffers the file body when it successfully identifies one,
      // so we don't need to re-download it here (avoids double-download).
      const resolved = await resolveToDirectFile(candidateUrl, BASE, signal);
      if (!resolved) continue;

      if (resolved.unsupported) { lastUnsupportedHost = resolved.unsupported; continue; }

      if (resolved.megaUrl) {
        const buf = await downloadFromMega(resolved.megaUrl);
        if (buf) {
          onProgress(1, 1);
          const ext = extFromUrlOrCt(resolved.megaUrl, "");
          return { kind: "archive", data: buf, ext };
        }
        continue;
      }

      if (!resolved.fileUrl) continue;

      try {
        onProgress(0, 1);

        let buf: Buffer;
        let ext: "cbz" | "cbr" | "zip" = "cbz";

        if (resolved.data) {
          // Body was already buffered during URL resolution — use it directly.
          buf = resolved.data;
          ext = (resolved.ext as "cbz" | "cbr" | "zip") || "cbz";
        } else {
          // URL was resolved but body wasn't buffered (e.g., followed a redirect chain
          // that ended with a URL we recognised but didn't read). Fetch now.
          const fileRes = await fetch(resolved.fileUrl, {
            headers: { ...UA, Referer: BASE },
            signal: fetchSignal(180_000),
          });
          if (!fileRes.ok) continue;
          buf = Buffer.from(await fileRes.arrayBuffer());
          ext = extFromUrlOrCt(resolved.fileUrl, fileRes.headers.get("content-type") || "");
        }

        onProgress(1, 1);
        return { kind: "archive", data: buf, ext };
      } catch (e) {
        if ((e as { name?: string }).name === "AbortError") throw e;
        console.warn("[getcomics] download attempt failed:", (e as Error).message);
      }
    }

    const unsupportedHost = lastUnsupportedHost || lastUnsupportedHostSeen;
    if (unsupportedHost) {
      return { kind: "unsupported_host", host: unsupportedHost, url: ref.externalId };
    }
    throw new Error(`Could not download any file from: ${ref.externalId}`);
  },
};

// ── Resolve a URL to a direct downloadable file, following redirects ──
// Returns the file URL and, when possible, the buffered file body so the
// caller does not need to download the file a second time.
interface ResolveResult {
  fileUrl?: string;
  data?: Buffer;   // pre-buffered file body when available
  ext?: string;
  unsupported?: string;
  megaUrl?: string;  // redirect landed on Mega.nz — caller handles download
}

async function resolveToDirectFile(
  startUrl: string,
  referer: string,
  signal?: AbortSignal,
  hops = 0,
): Promise<ResolveResult | null> {
  if (hops > 6) return null;

  if (/\.(cbz|cbr|zip|rar)(\?[^"]*)?$/i.test(startUrl)) {
    // Looks like a direct file URL — caller will fetch it.
    return { fileUrl: startUrl };
  }
  if (UNSUPPORTED_HOSTS.test(startUrl)) {
    try { return { unsupported: new URL(startUrl).hostname }; } catch { return null; }
  }

  // PixelDrain handled separately in fetchChapter
  if (/pixeldrain\.com/i.test(startUrl)) return null;

  const fetchSignal = AbortSignal.any([
    AbortSignal.timeout(120_000),
    ...(signal ? [signal] : []),
  ]);

  try {
    const res = await fetch(startUrl, {
      headers: { ...UA, Referer: referer },
      redirect: "follow",
      signal: fetchSignal,
    });
    const finalUrl = res.url;
    const ct = res.headers.get("content-type")?.split(";")[0].trim() || "";

    // Redirect may have landed on Mega.nz (getcomics /go/ → mega.nz)
    if (/mega\.nz\/(file|folder)\//i.test(finalUrl)) {
      return { megaUrl: finalUrl };
    }

    // Redirect may have landed on another unsupported host
    if (UNSUPPORTED_HOSTS.test(finalUrl)) {
      try { return { unsupported: new URL(finalUrl).hostname }; } catch { return null; }
    }

    // If the final URL or content-type indicates a binary file, buffer and return it
    // so the caller can use the data directly without a second fetch.
    if (/\.(cbz|cbr|zip|rar)(\?[^"]*)?$/i.test(finalUrl) || isBinaryContentType(ct)) {
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = extFromUrlOrCt(finalUrl, ct);
      return { fileUrl: finalUrl, data: buf, ext };
    }

    if (!res.ok) return null;

    const body = await res.text();
    const $ = cheerio.load(body);

    // Direct archive link anywhere in page
    let foundFile = "";
    $("a[href]").each((_, el) => {
      const h = $(el).attr("href") || "";
      if (/\.(cbz|cbr|zip|rar)(\?[^"]*)?$/i.test(h)) { foundFile = h; return false; }
    });
    if (foundFile) return { fileUrl: foundFile };

    // meta-refresh
    const meta = $('meta[http-equiv="refresh"]').attr("content") || "";
    const mRef = meta.match(/url=(.+)/i);
    if (mRef) {
      const next = mRef[1].trim().replace(/['"]/g, "");
      return resolveToDirectFile(next, finalUrl, signal, hops + 1);
    }

    // "Click here" / "Download" link to follow
    let nextHop = "";
    $("a[href]").each((_, el) => {
      const h = $(el).attr("href") || "";
      const t = $(el).text().trim().toLowerCase();
      if (h && h !== "#" && /\b(click here|download|get file|direct link|proceed|continue)\b/i.test(t)) {
        nextHop = h; return false;
      }
    });
    if (nextHop) return resolveToDirectFile(nextHop, finalUrl, signal, hops + 1);
  } catch (e) {
    if ((e as { name?: string }).name === "AbortError") throw e;
  }

  return null;
}
