import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { clientIp, getSession } from "@/lib/api";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  if (!checkRateLimit(`login:${clientIp(req)}`, 10, 60_000)) {
    return NextResponse.json({ message: "Too many attempts. Try again in a minute." }, { status: 429 });
  }
  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) return NextResponse.json({ message: "Missing credentials" }, { status: 400 });
  const user = db.prepare("SELECT id, username, password, disabled FROM users WHERE username = ?")
    .get(String(username).trim().toLowerCase()) as { id: number; username: string; password: string; disabled: number } | undefined;
  if (!user || user.disabled || !bcrypt.compareSync(String(password), user.password)) {
    return NextResponse.json({ message: "Invalid username or password" }, { status: 401 });
  }
  const session = await getSession();
  session.user = { id: user.id, username: user.username };
  await session.save();
  return NextResponse.json({ ok: true });
}
