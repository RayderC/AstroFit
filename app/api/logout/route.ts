import { NextRequest, NextResponse } from "next/server";
import { getSession, sameOrigin } from "@/lib/api";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ message: "Bad origin" }, { status: 403 });
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
}
