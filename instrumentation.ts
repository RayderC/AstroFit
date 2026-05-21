export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureVapidKeys } = await import("./lib/webpush");
  const { seedAchievements } = await import("./lib/achievements");

  try { ensureVapidKeys(); } catch (e) { console.warn("[instrumentation] vapid:", e); }
  try { seedAchievements(); } catch (e) { console.warn("[instrumentation] achievements seed:", e); }
}
