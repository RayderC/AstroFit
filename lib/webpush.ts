import webpush from "web-push";
import db, { getSiteConfig, setSiteConfigKey } from "./db";

const DEFAULT_SUBJECT = "mailto:rayder.chance@gmail.com";
const debug = process.env.DEBUG_PUSH === "1" || process.env.DEBUG_PUSH === "true";

function readSubject(): string {
  const cfg = getSiteConfig();
  const subj = (cfg.VAPID_SUBJECT || "").trim();
  if (subj && (subj.startsWith("mailto:") || subj.startsWith("https://"))) {
    return subj;
  }
  return DEFAULT_SUBJECT;
}

export function ensureVapidKeys(): { publicKey: string; subject: string } {
  const cfg = getSiteConfig();
  let pub = cfg.VAPID_PUBLIC_KEY;
  let priv = cfg.VAPID_PRIVATE_KEY;

  if (!pub || !priv) {
    const keys = webpush.generateVAPIDKeys();
    pub = keys.publicKey;
    priv = keys.privateKey;
    setSiteConfigKey("VAPID_PUBLIC_KEY", pub);
    setSiteConfigKey("VAPID_PRIVATE_KEY", priv);
  }

  const subject = readSubject();
  // Re-set every call so an admin-edited subject takes effect immediately.
  webpush.setVapidDetails(subject, pub, priv);

  return { publicKey: pub, subject };
}

interface PushPayload { title: string; body: string; url?: string }

const PUSH_OPTIONS: webpush.RequestOptions = {
  TTL: 24 * 60 * 60,            // 24h — long enough for idle iOS devices
  urgency: "high",              // surface promptly; Apple drops "very-low" on idle phones
};

function endpointHost(endpoint: string): string {
  try { return new URL(endpoint).hostname; } catch { return "invalid"; }
}

export async function sendPushToUser(userId: number, payload: PushPayload): Promise<void> {
  ensureVapidKeys();

  const subs = db.prepare(
    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
  ).all(userId) as { endpoint: string; p256dh: string; auth: string }[];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const res = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          PUSH_OPTIONS,
        );
        if (debug) {
          console.log(`[webpush] user=${userId} host=${endpointHost(sub.endpoint)} status=${res.statusCode}`);
        }
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(sub.endpoint);
          if (debug) console.log(`[webpush] user=${userId} host=${endpointHost(sub.endpoint)} status=${status} -> removed`);
        } else {
          const body = (err as { body?: string }).body || "";
          console.warn(`[webpush] send failed user=${userId} host=${endpointHost(sub.endpoint)} status=${status ?? "?"}: ${(err as Error).message}${body ? ` body=${body.slice(0, 200)}` : ""}`);
        }
      }
    }),
  );
}

export async function sendPushToAll(payload: PushPayload): Promise<void> {
  const userIds = db.prepare("SELECT DISTINCT user_id FROM push_subscriptions").all() as { user_id: number }[];
  await Promise.all(userIds.map((u) => sendPushToUser(u.user_id, payload)));
}
