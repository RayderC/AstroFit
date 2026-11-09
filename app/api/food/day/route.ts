import { route } from "@/lib/api";
import { day, foodDay } from "@/lib/repo/food";

export const GET = route(({ req, user }) => foodDay(user, day(req.nextUrl.searchParams.get("day"))));
