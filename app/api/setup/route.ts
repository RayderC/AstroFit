import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getSession } from "@/lib/api";

const countUsers = () => (db.prepare("SELECT COUNT(*) c FROM users").get() as { c: number }).c;

export async function GET() {
  return NextResponse.json({ needsSetup: countUsers() === 0 });
}

export async function POST(req: NextRequest) {
  if (countUsers() > 0) return NextResponse.json({ message: "Setup already complete" }, { status: 403 });
  const { username, password, weightUnit, distanceUnit } = await req.json().catch(() => ({}));
  const name = String(username ?? "").trim().toLowerCase();
  if (name.length < 2 || !/^[a-z0-9_.-]+$/.test(name)) return NextResponse.json({ message: "Username must be 2+ letters/numbers" }, { status: 400 });
  if (String(password ?? "").length < 8) return NextResponse.json({ message: "Password must be at least 8 characters" }, { status: 400 });
  const wu = weightUnit === "kg" ? "kg" : "lb";
  const du = distanceUnit === "km" ? "km" : "mi";
  const info = db.prepare("INSERT INTO users (username, password, is_admin, weight_unit, distance_unit) VALUES (?, ?, 1, ?, ?)")
    .run(name, bcrypt.hashSync(password, 12), wu, du);
  const session = await getSession();
  session.user = { id: Number(info.lastInsertRowid), username: name };
  await session.save();
  return NextResponse.json({ ok: true });
}
