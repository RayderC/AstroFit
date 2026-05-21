export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions } from "@/lib/session";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import Navigation from "../components/Navigation";
import NutritionClient from "./NutritionClient";

export default async function NutritionPage() {
  const session = await getIronSession<{ user?: { id: number } }>(await cookies(), sessionOptions);
  if (!session.user) redirect("/login");
  const userId = session.user.id;

  const today = new Date().toISOString().slice(0, 10);

  const todayLogs = db.prepare(`
    SELECT * FROM nutrition_logs WHERE user_id = ? AND logged_date = ? ORDER BY created_at
  `).all(userId, today) as {
    id: number; logged_date: string; meal_type: string; food_name: string;
    calories: number | null; protein_g: number | null; carbs_g: number | null;
    fat_g: number | null; amount_g: number | null; notes: string | null;
  }[];

  const goals = db.prepare("SELECT * FROM nutrition_goals WHERE user_id = ?").get(userId) as
    | { calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null } | undefined;

  const recentDays = db.prepare(`
    SELECT logged_date,
      ROUND(SUM(calories)) as calories,
      ROUND(SUM(protein_g),1) as protein_g,
      ROUND(SUM(carbs_g),1) as carbs_g,
      ROUND(SUM(fat_g),1) as fat_g,
      COUNT(*) as entries
    FROM nutrition_logs
    WHERE user_id = ? AND logged_date >= date('now', '-6 days')
    GROUP BY logged_date ORDER BY logged_date DESC
  `).all(userId) as { logged_date: string; calories: number; protein_g: number; carbs_g: number; fat_g: number; entries: number }[];

  return (
    <div>
      <Navigation />
      <NutritionClient todayLogs={todayLogs} goals={goals ?? null} recentDays={recentDays} today={today} />
    </div>
  );
}
