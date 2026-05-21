export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Navigation from "../components/Navigation";
import BodyClient from "./BodyClient";

export default async function BodyPage() {
  const session = await getIronSession<{ user?: { id: number } }>(await cookies(), sessionOptions);
  if (!session.user) redirect("/login");
  const userId = session.user.id;

  const unit = (db.prepare("SELECT unit_preference FROM users WHERE id = ?").get(userId) as { unit_preference: string } | undefined)?.unit_preference ?? "km";

  const metrics = db.prepare(`
    SELECT * FROM body_metrics WHERE user_id = ? ORDER BY recorded_at DESC LIMIT 60
  `).all(userId) as {
    id: number; recorded_at: string; weight_kg: number | null; body_fat_pct: number | null;
    chest_cm: number | null; waist_cm: number | null; hips_cm: number | null;
    arms_cm: number | null; legs_cm: number | null; notes: string | null;
  }[];

  return (
    <div>
      <Navigation />
      <BodyClient metrics={metrics} unit={unit} />
    </div>
  );
}
