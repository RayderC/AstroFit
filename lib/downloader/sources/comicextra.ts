import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { isSafeExternalUrl } from "../../safeUrl";
import type {
  ChapterPayload,
  ChapterRef,
  ProgressFn,
  SearchResult,
  SeriesMetadata,
  Source,
} from "./types";

const BASE = "https://comicextra.me";
const UA = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: BASE,
};

function absUrl(href: string): string {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE}${href}`;
  return `${BASE}/${href}`;
}

function parseIssueNumber(text: string): number {
  // "Issue 1", "Issue #001", "#12", "Annual 1", "Vol. 2"
  const m =
    text.match(/issue\s*#?\s*(\d+(?:\.\d+)?)/i) ||
    text.match(/#\s*(\d+(?:\.\d+)?)/) ||
    text.match(/vol(?:ume)?\.?\s*(\d+(?:\.\d+)?)/i) ||
    text.match(/annual\s+(\d+(?:\.\d+)?)/i) ||
    text.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : NaN;
}

function isPageImage(src: string): boolean {
  if (!src) return false;
  if (!isSafeExternalUrl(src)) return false;
  if (!src.match(/\.(jpg|jpeg|png|webp)(\?.*)?$/i)) return false;
  if (src.match(/\/(logo|icon|banner|avatar|ads?|sprite|thumb|small|header|footer)/i)) return false;
  return true;
}

function statusOf(text: string): SeriesMetadata["status"] {
  const t = text.toLowerCase();
  if (t.includes("completed") || t.includes("finished") || t.includes("ended")) return "completed";
  if (t.includes("ongoing") || t.includes("on-going") || t.includes("publishing")) return "ongoing";
  return "unknown";
}

export const comicextraSource: Source = {
  id: "comicextra",
  type: "comic",

  async search(query: string): Promise<SearchResult[]> {
    let res: Response;
    try {
      res = await fetch(`${BASE}/comic-search?key=${encodeURIComponent(query)}`, {
        headers: UA,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      console.warn("[comicextra] search failed:", (e as Error).message);
      return [];
    }
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    $("div.cartoon-box, .movie-box, .film-item, .cartoon-item").each((_, el) => {
      const $el = $(el);
      const link = $el.find("h3 a, h2 a, .title a, a.name").first();
      const title = link.text().trim() || $el.find("a").first().attr("title") || "";
      const href = absUrl(link.attr("href") || $el.find("a").first().attr("href") || "");
      if (!title || !href.startsWith(BASE)) return;

      const img = $el.find("img").first();
      const cover = absUrl(img.attr("src") || img.attr("data-src") || img.attr("data-lazy") || "");
      const statusText = $el.find(".status, .info").text().trim();

      results.push({
        source: "comicextra",
        type: "comic",
        title,
        url: href,
        cover: cover || undefined,
        description: "",
        status: statusOf(statusText),
        tags: [],
      });
    });

    return results;
  },

  async getMetadata(url: string): Promise<SeriesMetadata> {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`ComicExtra metadata failed: ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $("h1.title, h1, .detail_content h2, #comic-book-detail h2, .movie-title h2").first().text().trim() ||
      $("title").text().split(/[|–-]/)[0].trim();

    const cover = absUrl(
      $(".detail_image img, .comic-book-cover img, .movie-image img").first().attr("src") ||
      $("img[src*='cover'], .picture img").first().attr("src") || ""
    );

    const description =
      $(".comic-description p, .comic-description, .tab-summary .summary__content, .overview, .movie-description")
        .first().text().trim().slice(0, 1500);

    const infoText = $(".movie-detail, .detail_content, #comic-book-detail, .series-info").text();
    const status = statusOf(infoText);

    const tags: string[] = [];
    $(".movie-genres a, .genres a, .comic-genres a, .detail_content a[href*='genre']").each((_, a) => {
      const t = $(a).text().trim();
      if (t) tags.push(t);
    });

    return { title, description: description || undefined, cover: cover || undefined, status, tags, oneShot: false };
  },

  async listChapters(url: string): Promise<ChapterRef[]> {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`ComicExtra chapters failed: ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const out: ChapterRef[] = [];
    const seen = new Set<number>();

    // ComicExtra lists issues in table.listing rows
    $("table.listing a, .chapter-list a, .chapters-listing a, .listing a, #list-issue a").each((_, el) => {
      const href = absUrl($(el).attr("href") || "");
      const text = $(el).text().trim();
      if (!href.startsWith(BASE) || !text) return;

      const num = parseIssueNumber(text);
      if (!Number.isFinite(num) || seen.has(num)) return;
      seen.add(num);
      out.push({ externalId: href, number: num, title: text });
    });

    out.sort((a, b) => a.number - b.number);
    return out;
  },

  async fetchChapter(ref: ChapterRef, onProgress: ProgressFn, signal?: AbortSignal): Promise<ChapterPayload> {
    // ComicExtra /full view shows all pages on one page
    const fullUrl = ref.externalId.replace(/\/$/, "") + "/full";
    const fetchSig = (ms: number) => signal
      ? AbortSignal.any([signal, AbortSignal.timeout(ms)])
      : AbortSignal.timeout(ms);

    const res = await fetch(fullUrl, { headers: UA, signal: fetchSig(30_000) });
    if (!res.ok) throw new Error(`ComicExtra issue fetch failed: ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const urls: string[] = [];

    // Primary: ComicExtra wraps all page images in #all
    $("#all img, .chapter-container img, .chapter-images img, .chapter_images img, .reading-content img").each((_, img) => {
      const src = $(img).attr("src") || $(img).attr("data-src") || $(img).attr("data-lazy") || "";
      if (isPageImage(src)) {
        const abs = absUrl(src);
        if (!urls.includes(abs)) urls.push(abs);
      }
    });

    // Fallback: every qualifying img on the page
    if (urls.length === 0) {
      $("img").each((_, img) => {
        const src = $(img).attr("src") || $(img).attr("data-src") || "";
        if (isPageImage(src)) {
          const abs = absUrl(src);
          if (!urls.includes(abs)) urls.push(abs);
        }
      });
    }

    // Fallback: image URLs embedded in script tags
    if (urls.length < 2) {
      const scriptText = $("script").map((_, el) => $(el).html() || "").get().join("\n");
      const found = [...scriptText.matchAll(/["'`](https?:\/\/[^"'`\s]+\.(?:jpg|jpeg|png|webp))["'`]/gi)]
        .map((m) => m[1])
        .filter(isPageImage);
      for (const u of found) {
        if (!urls.includes(u)) urls.push(u);
      }
    }

    if (urls.length === 0) {
      throw new Error(`No pages found for issue ${ref.number} — ${ref.externalId}`);
    }

    const buffers: Buffer[] = new Array(urls.length);
    const limit = pLimit(4);
    let done = 0;
    await Promise.all(urls.map((u, i) => limit(async () => {
      const r = await fetchWithRetry(u, signal);
      buffers[i] = Buffer.from(await r.arrayBuffer());
      done++;
      onProgress(done, urls.length);
    })));

    return { kind: "images", images: buffers };
  },
};

async function fetchWithRetry(url: string, signal?: AbortSignal, attempts = 3): Promise<Response> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const perAttempt = AbortSignal.timeout(30_000);
      const combined = signal ? AbortSignal.any([signal, perAttempt]) : perAttempt;
      const r = await fetch(url, { headers: UA, signal: combined });
      if (r.ok) return r;
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (e) {
      if ((e as { name?: string }).name === "AbortError") throw e;
      lastErr = e;
    }
    if (i < attempts - 1) await new Promise((res) => setTimeout(res, 500 * Math.pow(2, i)));
  }
  throw lastErr instanceof Error ? lastErr : new Error("fetch failed");
}
