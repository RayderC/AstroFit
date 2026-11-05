"use client";

import { api } from "./client";

export type PushState = "loading" | "unsupported" | "off" | "on";

function keyBytes(base64url: string) {
  const b = atob(base64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(base64url.length / 4) * 4, "="));
  return Uint8Array.from(b, c => c.charCodeAt(0));
}

async function registration() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return undefined;
  return navigator.serviceWorker.getRegistration();
}

export async function pushState(): Promise<PushState> {
  try {
    const reg = await registration();
    if (!reg) return "unsupported";
    return (await reg.pushManager.getSubscription()) ? "on" : "off";
  } catch {
    return "unsupported";
  }
}

/** Must run from a click or tap, or browsers refuse the permission prompt. */
export async function enablePush() {
  const reg = await registration();
  if (!reg) throw new Error("The app isn't installed in this browser yet. Reload and try again.");
  if (await Notification.requestPermission() !== "granted") {
    throw new Error("Notifications are blocked. Allow them for this site in your browser settings.");
  }
  const { publicKey } = await api<{ publicKey: string }>("/api/push");
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
  await api("/api/push", { body: sub.toJSON() });
}

export async function disablePush() {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (!sub) return;
  await api("/api/push/unsubscribe", { body: { endpoint: sub.endpoint } });
  await sub.unsubscribe();
}

/** Phones sometimes rotate subscriptions, so tell the server which one this device has now. */
export async function refreshPushSubscription() {
  try {
    const sub = await (await registration())?.pushManager.getSubscription();
    if (sub) await api("/api/push", { body: sub.toJSON() });
  } catch { /* Tried again next time. */ }
}

/** For when the push service can't be used. Same tag as the server's, so a device never shows both. */
export async function showLocalNotification(title: string, body: string, url: string) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", tag: "rest-timer", data: { url } });
    else new Notification(title, { body, icon: "/icons/icon-192.png", tag: "rest-timer" });
  } catch { /* The beep still happened. */ }
}
