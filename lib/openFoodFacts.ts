// Looks products up in Open Food Facts, the free, open food database (https://world.openfoodfacts.org).
// Only this fixed host is ever called, so there's no way to point the server somewhere else.
// Their terms ask apps to identify themselves in the User-Agent and keep request rates low.

const HOST = "https://world.openfoodfacts.org";
const SEARCH_HOST = "https://search.openfoodfacts.org";
const UA = "AstroFit/2.0 (self-hosted fitness tracker; https://github.com/RayderC/AstroFit)";
const FIELDS = "code,product_name,product_name_en,generic_name,brands,nutriments,serving_size,serving_quantity,serving_quantity_unit,quantity";
const MAX_BYTES = 2 * 1024 * 1024;

export type OffFood = {
  name: string; brand: string | null; barcode: string; source: "off";
  servingLabel: string; servingG: number | null; unit: "g" | "ml";
  kcal: number; proteinG: number | null; carbsG: number | null; fatG: number | null;
};

async function getJson(url: string, timeoutMs: number): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts answered ${res.status}`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_BYTES) throw new Error("Open Food Facts sent too much data");
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("Open Food Facts sent too much data");
  return JSON.parse(text);
}

const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return isFinite(n) && n >= 0 ? n : null;
};
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Converts an Open Food Facts product to a food with numbers per serving, or null when it has no calories. */
export function fromProduct(p: any, code: string): OffFood | null {
  if (!p || typeof p !== "object") return null;
  const n = p.nutriments ?? {};
  const name = clean(p.product_name, 120) || clean(p.product_name_en, 120) || clean(p.generic_name, 120);
  if (!name) return null;
  const kcal100 = num(n["energy-kcal_100g"]) ?? (num(n["energy-kj_100g"]) != null ? num(n["energy-kj_100g"])! / 4.184 : null) ?? (num(n.energy_100g) != null ? num(n.energy_100g)! / 4.184 : null);
  const unit: "g" | "ml" = /ml|l$/i.test(String(p.serving_quantity_unit ?? "")) || /\d\s*(ml|cl|l)\b/i.test(String(p.quantity ?? "")) ? "ml" : "g";
  const servingG = num(p.serving_quantity);
  // The product API gives brands as "A, B"; the search service gives a list.
  const brand = clean(String(Array.isArray(p.brands) ? p.brands[0] ?? "" : p.brands ?? "").split(",")[0], 80) || null;

  if (kcal100 != null && servingG && servingG > 0 && servingG <= 5000) {
    // A real serving on the label: store per serving, and grams still work through serving_g.
    const k = servingG / 100;
    const per = (key: string) => (num(n[`${key}_100g`]) != null ? Math.round(num(n[`${key}_100g`])! * k * 10) / 10 : num(n[`${key}_serving`]));
    return {
      name, brand, barcode: code, source: "off",
      servingLabel: clean(p.serving_size, 60) || `${servingG} ${unit}`, servingG, unit,
      kcal: Math.round(kcal100 * k), proteinG: per("proteins"), carbsG: per("carbohydrates"), fatG: per("fat"),
    };
  }
  if (kcal100 != null) {
    return {
      name, brand, barcode: code, source: "off", servingLabel: `100 ${unit}`, servingG: 100, unit,
      kcal: Math.round(kcal100), proteinG: num(n.proteins_100g), carbsG: num(n.carbohydrates_100g), fatG: num(n.fat_100g),
    };
  }
  const kcalServing = num(n["energy-kcal_serving"]);
  if (kcalServing != null) {
    return {
      name, brand, barcode: code, source: "off", servingLabel: clean(p.serving_size, 60) || "1 serving", servingG: null, unit,
      kcal: Math.round(kcalServing), proteinG: num(n.proteins_serving), carbsG: num(n.carbohydrates_serving), fatG: num(n.fat_serving),
    };
  }
  return null;
}

/** A product by barcode, or null when Open Food Facts doesn't know it (or knows it without calories). */
export async function lookupBarcode(code: string): Promise<OffFood | null> {
  // A 12-digit UPC is stored as the same number with a leading zero.
  for (const c of code.length === 12 ? [code, `0${code}`] : [code]) {
    const j = await getJson(`${HOST}/api/v2/product/${c}.json?fields=${FIELDS}`, 10_000);
    if (j && j.status === 1 && j.product) return fromProduct(j.product, code);
  }
  return null;
}

/**
 * Their search service, with the older search page as a fallback: the older one often answers 503 when
 * busy. Both are fixed Open Food Facts hosts.
 */
export async function searchProducts(q: string): Promise<OffFood[]> {
  let products: unknown[];
  try {
    const j = await getJson(`${SEARCH_HOST}/search?q=${encodeURIComponent(q)}&page_size=24&fields=${FIELDS}`, 10_000);
    products = Array.isArray(j?.hits) ? j.hits : [];
  } catch (e) {
    console.warn("[food] search service:", (e as Error).message, "- trying the older search");
    const j = await getJson(`${HOST}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=24&fields=${FIELDS}`, 12_000);
    products = Array.isArray(j?.products) ? j.products : [];
  }
  const out: OffFood[] = [];
  for (const p of products as any[]) {
    const code = String(p?.code ?? "");
    if (!/^\d{6,14}$/.test(code)) continue;
    const f = fromProduct(p, code);
    if (f && !out.some(o => o.barcode === f.barcode)) out.push(f);
  }
  return out;
}
