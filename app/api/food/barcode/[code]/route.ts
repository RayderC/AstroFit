import { HttpError, route } from "@/lib/api";
import { lookupBarcode } from "@/lib/openFoodFacts";
import { checkRateLimit } from "@/lib/rateLimit";
import { barcodeOf, foodByBarcode, saveFood } from "@/lib/repo/food";

/** Your saved food with this barcode, or the product from Open Food Facts, saved for next time. */
export const GET = route<{ code: string }>(async ({ user, params }) => {
  const code = barcodeOf(params.code);
  const mine = foodByBarcode(user.id, code);
  if (mine) return { food: mine, found: true };
  if (!checkRateLimit(`off:${user.id}`, 30, 60_000)) throw new HttpError(429, "Too many lookups. Wait a minute and try again.");
  let off;
  try { off = await lookupBarcode(code); }
  catch (e) {
    console.error("[food] barcode lookup", (e as Error).message);
    throw new HttpError(502, "Couldn't reach the food database. Check the server's internet connection, or add the food yourself.");
  }
  if (!off) return { food: null, found: false, barcode: code };
  return { food: saveFood(user.id, off), found: true };
});
