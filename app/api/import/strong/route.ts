import { route } from "@/lib/api";
import { commitStrong, previewStrong } from "@/lib/repo/strongImport";
import { safeTz } from "@/lib/tz";

// POST { csv, tz }                                   → preview (writes nothing)
// POST { csv, tz, commit: true, weightUnit, distanceUnit, mapping: { "Strong name": target } } → import
export const POST = route(({ user, body }) => {
  const b = body ?? {};
  const tz = safeTz(b.tz);
  if (b.commit) return commitStrong(user.id, { csv: b.csv, tz, weightUnit: b.weightUnit, distanceUnit: b.distanceUnit, mapping: b.mapping });
  return previewStrong(user.id, b.csv, tz);
});
