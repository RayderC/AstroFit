import { route } from "@/lib/api";
import { listFoods, saveFood } from "@/lib/repo/food";

export const GET = route(({ req, user }) => {
  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 80) || null;
  return listFoods(user.id, q);
});

export const POST = route(({ user, body }) => saveFood(user.id, body ?? {}));
