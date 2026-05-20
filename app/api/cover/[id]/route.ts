import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, User } from "@/lib/session";
import fs from "fs";
import path from "path";
import db, { getSiteConfig } from "@/lib/db";
import { isSafeExternalUrl } from "@/lib/safeUrl";

export const runtime = "nodejs";

const SAFE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

function getAllowedLocalDirs(): string[] {
  const cfg = getSiteConfig();
  return [
    cfg.MANGA_DIRECTORY || "/Manga",
    path.join(process.env.CONFIG_DIRECTORY || "/config", "covers"),
  ].map((d) => path.resolve(d));
}

function isPathWithinAllowedDirs(filePath: string): boolean {
  const resolved = path.resolve(filePath);
  return getAllowedLocalDirs().some((dir) => resolved.startsWith(dir + path.sep) || resolved === dir);
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await getIronSession<{ user?: User }>(await cookies(), sessionOptions);
  if (!session.user) {
    return NextResponse.json({ message: "Login required" }, { status: 401 });
  }

  const { id } = await ctx.params;
  const seriesId = Number(id);
  if (!Number.isFinite(seriesId)) return NextResponse.json({ message: "bad id" }, { status: 400 });

  const row = db.prepare("SELECT cover_path FROM series WHERE id = ?").get(seriesId) as { cover_path: string } | undefined;
  if (!row?.cover_path) return NextResponse.json({ message: "no cover" }, { status: 404 });

  const cover = row.cover_path;

  if (/^https?:\/\//i.test(cover)) {
    // Block SSRF: reject private/loopback addresses
    if (!isSafeExternalUrl(cover)) {
      return NextResponse.json({ message: "invalid cover url" }, { status: 400 });
    }
    try {
      const upstream = await fetch(cover, {
        signal: AbortSignal.timeout(15_000),
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      });
      if (!upstream.ok) return NextResponse.json({ message: "upstream cover failed" }, { status: 502 });

      // Validate the response is actually an image
      const contentType = upstream.headers.get("content-type")?.split(";")[0].trim() || "";
      if (!SAFE_IMAGE_TYPES.has(contentType)) {
        return NextResponse.json({ message: "upstream returned non-image content" }, { status: 502 });
      }

      const buf = Buffer.from(await upstream.arrayBuffer());
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-cache, must-revalidate",
        },
      });
    } catch {
      return NextResponse.json({ message: "proxy failed" }, { status: 502 });
    }
  }

  // Local file — ensure it's within an allowed directory
  if (!isPathWithinAllowedDirs(cover)) {
    return NextResponse.json({ message: "forbidden" }, { status: 403 });
  }

  if (!fs.existsSync(cover)) return NextResponse.json({ message: "missing on disk" }, { status: 404 });
  const data = fs.readFileSync(cover);
  const ext = path.extname(cover).toLowerCase();
  const mime =
    ext === ".png" ? "image/png" :
    ext === ".webp" ? "image/webp" :
    ext === ".gif" ? "image/gif" :
    "image/jpeg";
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": mime, "Cache-Control": "no-cache, must-revalidate" },
  });
}
