import { route } from "@/lib/api";
import { searchProducts } from "@/lib/openFoodFacts";
import { checkRateLimit } from "@/lib/rateLimit";
import { listFoods } from "@/lib/repo/food";

/** Your foods first, then products from Open Food Facts. A failed online search still returns yours. */
export const GET = route(async ({ req, user }) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return { mine: [], online: [], onlineError: null };
  const mine = listFoods(user.id, q, 15);
  if (!checkRateLimit(`off:${user.id}`, 30, 60_000)) return { mine, online: [], onlineError: "Too many searches. Wait a minute." };
  try {
    const known = new Set(mine.map(f => f.barcode).filter(Boolean));
    const online = (await searchProducts(q)).filter(f => !known.has(f.barcode));
    return { mine, online, onlineError: null };
  } catch (e) {
    console.error("[food] search", (e as Error).message);
    return { mine, online: [], onlineError: "Couldn't reach the food database right now." };
  }
});
