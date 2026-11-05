import webpush from "web-push";
import { bad } from "./api";
import { db } from "./db";

type Keys = { publicKey: string; privateKey: string };

/** Generated once and kept in the database. Changing them would invalidate every phone's subscription. */
function vapidKeys(): Keys {
  return db.transaction(() => {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'vapid'").get() as { value: string } | undefined;
    if (row) return JSON.parse(row.value) as Keys;
    const keys = webpush.generateVAPIDKeys();
    db.prepare("INSERT INTO settings (key, value) VALUES ('vapid', ?)").run(JSON.stringify(keys));
    return keys;
  }).immediate();
}

export const pushPublicKey = () => vapidKeys().publicKey;

/**
 * The server sends requests to whatever endpoint is stored, so only real browser push services are accepted.
 * Without this, any signed-in user could make the server call addresses on your home network.
 */
const PUSH_HOSTS = ["fcm.googleapis.com", "push.services.mozilla.com", "notify.windows.com", "push.apple.com"];

function pushEndpoint(v: unknown): string {
  if (typeof v !== "string" || v.length > 2000) throw bad("Invalid push endpoint");
  let u: URL;
  try { u = new URL(v); } catch { throw bad("Invalid push endpoint"); }
  const known = PUSH_HOSTS.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`));
  if (u.protocol !== "https:" || !known) throw bad("That browser's push service isn't supported");
  return v;
}

function pushKey(v: unknown): string {
  if (typeof v !== "string" || !v || v.length > 300) throw bad("Invalid push key");
  return v;
}

export function subscribe(userId: number, b: any) {
  const endpoint = pushEndpoint(b?.endpoint);
  const p256dh = pushKey(b?.keys?.p256dh);
  const auth = pushKey(b?.keys?.auth);
  db.prepare(`INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
    ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`).run(userId, endpoint, p256dh, auth);
}

export function unsubscribe(userId: number, endpoint: unknown) {
  db.prepare("DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?").run(userId, String(endpoint ?? ""));
}

export const subscriptionCount = (userId: number) =>
  (db.prepare("SELECT COUNT(*) c FROM push_subscriptions WHERE user_id = ?").get(userId) as { c: number }).c;

type Sub = { id: number; endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url?: string; tag?: string };

/** Sends to every device the user has. Returns how many accepted it, and removes devices that have gone away. */
export async function sendToUser(userId: number, message: PushMessage, opts: { ttlSeconds?: number } = {}): Promise<number> {
  const subs = db.prepare("SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?").all(userId) as Sub[];
  if (subs.length === 0) return 0;
  const keys = vapidKeys();
  const contact = process.env.PUSH_CONTACT || "https://github.com/RayderC/AstroFit";
  let delivered = 0;
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ url: "/", ...message }),
        {
          TTL: opts.ttlSeconds ?? 60 * 60,
          urgency: "high", // Phones hold back anything lower while the screen is off.
          timeout: 15_000,
          vapidDetails: { subject: contact, publicKey: keys.publicKey, privateKey: keys.privateKey },
        },
      );
      delivered++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) db.prepare("DELETE FROM push_subscriptions WHERE id = ?").run(s.id);
      else console.error("[push]", status ?? e);
    }
  }));
  return delivered;
}

// ── Rest timer ──
// A phone suspends the page while the screen is off, so the page can't be trusted to notice when rest
// ends. The server keeps the timer and sends the notification instead. Timers live in memory: a restart
// mid-rest loses that one notification, which isn't worth a table.

const g = globalThis as unknown as { __astrofitRest?: Map<number, NodeJS.Timeout> };
const timers = g.__astrofitRest ?? (g.__astrofitRest = new Map());

export function cancelRestPush(userId: number) {
  const t = timers.get(userId);
  if (t) clearTimeout(t);
  timers.delete(userId);
}

/** One timer per user: starting a new rest replaces the last one. Returns false if they have no devices. */
export function scheduleRestPush(userId: number, seconds: number, label: string, sessionId: number | null): boolean {
  cancelRestPush(userId);
  if (subscriptionCount(userId) === 0) return false;
  const timer = setTimeout(() => {
    timers.delete(userId);
    sendToUser(userId, {
      title: "Rest is over",
      body: label ? `Next set: ${label}` : "Time for your next set.",
      url: sessionId ? `/session/${sessionId}` : "/",
      tag: "rest-timer",
    // Long after the rest ended, the notification is just noise.
    }, { ttlSeconds: 5 * 60 }).catch(e => console.error("[push] rest timer", e));
  }, seconds * 1000);
  timer.unref();
  timers.set(userId, timer);
  return true;
}
