// Installable admin + order notifications (see public/sw.js).
import { api } from './api';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const toBytes = (s: string) => {
  const p = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
};

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  await navigator.serviceWorker.register('/sw.js');
  return navigator.serviceWorker.ready;
}

/** This device's current subscription, if notifications are on. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  try { return await (await registration()).pushManager.getSubscription(); } catch { return null; }
}

/** Ask permission, subscribe through the browser's push service, and tell the API. Throws with a readable message. */
export async function enablePush(locale: 'fr' | 'en'): Promise<'on' | 'blocked'> {
  if (!pushSupported()) throw new Error('unsupported');
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') return 'blocked';
  const reg = await registration();
  const { public_key } = await api.getPushKey();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(public_key) as BufferSource });
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('invalid subscription');
  await api.pushSubscribe({ endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }, locale);
  return 'on';
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  try { await api.pushUnsubscribe(sub.endpoint); } catch { /* the server forgets dead devices by itself */ }
  await sub.unsubscribe();
}
