import { route, bad } from "@/lib/api";
import { exportCsv, exportJson } from "@/lib/export";
import { safeTz } from "@/lib/tz";

// GET /api/export?format=csv|json&tz=America/Chicago
export const GET = route(({ req, user }) => {
  const q = req.nextUrl.searchParams;
  const format = q.get("format");
  const day = new Date().toISOString().slice(0, 10);
  const download = (data: string, type: string, name: string) => new Response(data, {
    headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
  if (format === "csv") {
    return download(exportCsv(user, safeTz(q.get("tz"))), "text/csv; charset=utf-8", `astrofit-${day}-${user.weight_unit}-${user.distance_unit}.csv`);
  }
  if (format === "json") {
    return download(JSON.stringify(exportJson(user), null, 2), "application/json", `astrofit-${day}.json`);
  }
  throw bad("format must be csv or json");
});
