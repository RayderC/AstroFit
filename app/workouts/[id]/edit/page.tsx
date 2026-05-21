export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import db from "@/lib/db";
import Navigation from "../../../components/Navigation";
import Link from "next/link";
import EditWorkoutClient from "./EditWorkoutClient";

export default async function EditWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getIronSession<{ user?: { id: number } }>(await cookies(), sessionOptions);
  if (!session.user) redirect("/login");

  const workout = db.prepare(`
    SELECT id, type, title, notes, started_at, duration_seconds,
           distance_meters, avg_pace_seconds_per_km, avg_heart_rate,
           elevation_gain_meters, calories
    FROM workouts WHERE id = ? AND user_id = ?
  `).get(id, session.user.id) as {
    id: number; type: string; title: string; notes: string; started_at: string;
    duration_seconds: number; distance_meters: number | null;
    avg_pace_seconds_per_km: number | null; avg_heart_rate: number | null;
    elevation_gain_meters: number | null; calories: number | null;
  } | undefined;

  if (!workout) notFound();

  return (
    <div>
      <Navigation />
      <EditWorkoutClient workout={workout} />
    </div>
  );
}
