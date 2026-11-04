import { route, bad, str } from "@/lib/api";
import { db } from "@/lib/db";
import { listActivities } from "@/lib/repo/exercises";

export const GET = route(({ user }) => listActivities(user.id));

export const POST = route(({ user, body }) => {
  const name = str(body?.name, 60).trim();
  if (!name) throw bad("Name required");
  db.prepare("INSERT INTO activity_types (name, has_distance, icon, is_builtin, created_by) VALUES (?, ?, 'other', 0, ?)")
    .run(name, body?.hasDistance === false ? 0 : 1, user.id);
  return listActivities(user.id);
});
