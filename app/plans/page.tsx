export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Navigation from "../components/Navigation";
import PlansClient from "./PlansClient";

export default async function PlansPage() {
  const session = await getIronSession<{ user?: { id: number } }>(await cookies(), sessionOptions);
  if (!session.user) redirect("/login");
  const userId = session.user.id;

  const plans = db.prepare(`
    SELECT * FROM training_plans WHERE user_id = ? ORDER BY created_at DESC
  `).all(userId) as {
    id: number; name: string; description: string | null; goal_type: string | null;
    goal_date: string | null; weeks_duration: number | null; start_date: string | null;
    is_active: number; created_at: string;
  }[];

  // For each plan, count scheduled workouts and completed ones
  const plansWithCounts = plans.map((p) => {
    const totalWorkouts = (db.prepare(`
      SELECT COUNT(*) as c FROM plan_workouts pw
      JOIN plan_weeks wk ON wk.id = pw.week_id WHERE wk.plan_id = ?
    `).get(p.id) as { c: number }).c;

    const completedWorkouts = (db.prepare(`
      SELECT COUNT(*) as c FROM plan_workouts pw
      JOIN plan_weeks wk ON wk.id = pw.week_id
      WHERE wk.plan_id = ? AND pw.completed_workout_id IS NOT NULL
    `).get(p.id) as { c: number }).c;

    return { ...p, totalWorkouts, completedWorkouts };
  });

  return (
    <div>
      <Navigation />
      <PlansClient plans={plansWithCounts} />
    </div>
  );
}
