import { getIronSession } from "iron-session";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { sessionOptions } from "./lib/session";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  try {
    const session = await getIronSession<{ user?: { id: number; username: string } }>(
      req,
      res,
      sessionOptions,
    );
    if (!session.user) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  } catch (e) {
    console.error("[middleware] session error:", e instanceof Error ? e.message : e);
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return res;
}

export const config = {
  matcher: ["/((?!login|setup|api|_next|favicon|manifest\\.json|sw\\.js|icons).*)"],
};
