import { route } from "@/lib/api";
import { progress } from "@/lib/progress";
import { safeTz } from "@/lib/tz";

// GET /api/progress?weeks=12&tz=America/Chicago  (weeks=0 means all time)
export const GET = route(({ req, user }) => {
  const q = req.nextUrl.searchParams;
  const weeks = Math.min(520, Math.max(0, Math.floor(Number(q.get("weeks") ?? 12)) || 0));
  return progress(user.id, safeTz(q.get("tz")), weeks);
});
