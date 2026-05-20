import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, User } from "@/lib/session";
import { isSafeExternalUrl } from "@/lib/safeUrl";

export const runtime = "nodejs";

const SAFE_IMAGE_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/avif",
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function GET(req: NextRequest) {
  const session = await getIronSession<{ user?: User }>(await cookies(), sessionOptions);
  if (!session.user) {
    return NextResponse.json({ message: "Login required" }, { status: 401 });
  }

  const url = req.nextUrl.searchParams.get("url") ?? "";
  if (!url) return NextResponse.json({ message: "url required" }, { status: 400 });

  if (!isSafeExternalUrl(url)) {
    return NextResponse.json({ message: "disallowed url" }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) {
      return NextResponse.json({ message: "upstream failed" }, { status: 502 });
    }

    const contentType = (upstream.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!SAFE_IMAGE_TYPES.has(contentType)) {
      return NextResponse.json({ message: "not an image" }, { status: 400 });
    }

    const contentLength = Number(upstream.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BYTES) {
      return NextResponse.json({ message: "image too large" }, { status: 400 });
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return NextResponse.json({ message: "image too large" }, { status: 400 });
    }

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return NextResponse.json({ message: "proxy failed" }, { status: 502 });
  }
}
