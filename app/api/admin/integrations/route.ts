import { bad, route } from "@/lib/api";
import { aiStatus } from "@/lib/coachAi";
import { setSetting } from "@/lib/settings";

/** Optional services and whether they're set up. Keys never leave the server, only their last few characters. */
export const GET = route(() => ({ gemini: aiStatus() }), { admin: true });

export const PUT = route(({ body }) => {
  const b = body ?? {};
  if (b.gemini !== undefined) {
    if (b.gemini === null) setSetting("gemini_api_key", null);
    else {
      const key = typeof b.gemini?.apiKey === "string" ? b.gemini.apiKey.trim() : "";
      if (!/^[\w-]{20,200}$/.test(key)) throw bad("That doesn't look like a Gemini API key. Copy the whole key from AI Studio.");
      setSetting("gemini_api_key", key);
    }
  }
  return { gemini: aiStatus() };
}, { admin: true });
