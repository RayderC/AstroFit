export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Navigation from "../components/Navigation";
import Link from "next/link";
import WorkoutsClient from "./WorkoutsClient";

function workoutIcon(type: string) {
  return type === "run" ? "🏃" : type === "strength" ? "💪" : type === "cycling" ? "🚴" : "⚡";
}

export default async function WorkoutsPage() {
  const session = await getIronSession<{ user?: { id: number; username: string } }>(
    await cookies(), sessionOptions
  );
  if (!session.user) redirect("/login");

  const userId = session.user.id;
  const unit = (db.prepare("SELECT unit_preference FROM users WHERE id = ?").get(userId) as { unit_preference: string } | undefined)?.unit_preference ?? "km";

  const workouts = db.prepare(`
    SELECT id, type, title, started_at, duration_seconds, distance_meters, notes,
           avg_pace_seconds_per_km, calories, elevation_gain_meters
    FROM workouts WHERE user_id = ? ORDER BY started_at DESC LIMIT 200
  `).all(userId) as {
    id: number; type: string; title: string; started_at: string;
    duration_seconds: number; distance_meters: number | null; notes: string;
    avg_pace_seconds_per_km: number | null; calories: number | null; elevation_gain_meters: number | null;
  }[];

  return (
    <div>
      <Navigation />
      <WorkoutsClient workouts={workouts} unit={unit} workoutIcon={workoutIcon} />
    </div>
  );
}
