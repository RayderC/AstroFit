import webpush from "web-push";
import db, { getSiteConfig, setSiteConfigKey } from "./db";

let vapidInitialized = false;

export function ensureVapidKeys(): { publicKey: string } {
  if (vapidInitialized) {
    const cfg = getSiteConfig();
    return { publicKey: cfg.VAPID_PUBLIC_KEY };
  }

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

  webpush.setVapidDetails(
    "mailto:admin@comicorbit.local",
    pub,
    priv,
  );
  vapidInitialized = true;
  return { publicKey: pub };
}

export async function sendPushToUser(
  userId: number,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  const subs = db.prepare(
    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
  ).all(userId) as { endpoint: string; p256dh: string; auth: string }[];

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Subscription expired — remove it
          db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").run(sub.endpoint);
        } else {
          console.warn("[webpush] send failed:", (err as Error).message);
        }
      }
    }),
  );
}

export async function sendPushToAll(payload: { title: string; body: string; url?: string }): Promise<void> {
  const userIds = db.prepare("SELECT DISTINCT user_id FROM push_subscriptions").all() as { user_id: number }[];
  await Promise.all(userIds.map((u) => sendPushToUser(u.user_id, payload)));
}
