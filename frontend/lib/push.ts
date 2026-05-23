/**
 * Web Push helpers — permission, subscribe, unsubscribe.
 *
 * The browser-side flow:
 *   1. The user clicks "Enable notifications" in Settings.
 *   2. We ask for the Notification permission.
 *   3. If granted, we look up the SW registration and ask its PushManager
 *      to subscribe with our server-side VAPID public key.
 *   4. We POST {endpoint, keys: {p256dh, auth}} to /push/subscribe so the
 *      backend can push to this device later.
 *
 * Unsubscribing reverses the same chain: PushManager.unsubscribe locally,
 * then a DELETE /push/subscribe with the endpoint.
 */
import { pushApi } from './api';

export type PushStatus =
  | 'unsupported'      // browser has no PushManager / Notification API
  | 'server-disabled'  // backend has no VAPID keys configured
  | 'denied'           // user previously denied permission
  | 'unsubscribed'     // capable, allowed-or-default, but not subscribed yet
  | 'subscribed';      // active subscription, can receive pushes

export interface PushState {
  status: PushStatus;
  endpoint: string | null;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** Base64url → Uint8Array. PushManager wants the VAPID key in this form. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return reg ?? null;
  } catch {
    return null;
  }
}

/** Read the current push state without changing anything. */
export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return { status: 'unsupported', endpoint: null };

  let serverEnabled = true;
  try {
    const res = await pushApi.vapidPublicKey();
    serverEnabled = res.data.enabled;
  } catch {
    serverEnabled = false;
  }
  if (!serverEnabled) return { status: 'server-disabled', endpoint: null };

  if (Notification.permission === 'denied') {
    return { status: 'denied', endpoint: null };
  }

  const reg = await getRegistration();
  if (!reg) return { status: 'unsubscribed', endpoint: null };
  const existing = await reg.pushManager.getSubscription();
  if (existing) {
    // The browser may already hold a subscription from a previous session
    // whose server-side row was wiped (DB reset, migration, logout under a
    // different account). Re-POST it on every read — the backend upserts
    // on the endpoint uniqueness constraint, so this is safe to repeat.
    try {
      await pushApi.subscribe(
        existing.toJSON() as PushSubscriptionJSON,
        navigator.userAgent,
      );
    } catch {
      // Server might be down or the user might not be authenticated.
      // Either way, the local sub still exists, so report it as such —
      // the UI can show a Disable button to let the user clean it up.
    }
    return { status: 'subscribed', endpoint: existing.endpoint };
  }
  return { status: 'unsubscribed', endpoint: null };
}

/**
 * Ask permission and create a subscription, registering it with the server.
 * Returns the final state so the caller can refresh its UI in one step.
 */
export async function subscribeToPush(): Promise<PushState> {
  if (!isPushSupported()) return { status: 'unsupported', endpoint: null };

  const keyRes = await pushApi.vapidPublicKey();
  if (!keyRes.data.enabled || !keyRes.data.public_key) {
    return { status: 'server-disabled', endpoint: null };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { status: permission === 'denied' ? 'denied' : 'unsubscribed', endpoint: null };
  }

  const reg = await getRegistration();
  if (!reg) {
    // SW must be registered before we can subscribe — almost always means
    // we're on the dev path where the SW gate is off. Surface it as
    // "unsubscribed" so the UI doesn't lie about why it failed.
    return { status: 'unsubscribed', endpoint: null };
  }

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // BufferSource cast: TS 5.7's DOM types narrowed the field to
      // ArrayBufferView<ArrayBuffer>, but a Uint8Array's buffer is typed
      // as ArrayBufferLike (which could be SharedArrayBuffer). Our atob
      // path always produces a regular ArrayBuffer, so the cast is safe.
      applicationServerKey: urlBase64ToUint8Array(keyRes.data.public_key) as BufferSource,
    });
  }

  await pushApi.subscribe(sub.toJSON() as PushSubscriptionJSON, navigator.userAgent);

  return { status: 'subscribed', endpoint: sub.endpoint };
}

/** Unsubscribe locally AND remove from the server. */
export async function unsubscribeFromPush(): Promise<PushState> {
  if (!isPushSupported()) return { status: 'unsupported', endpoint: null };

  const reg = await getRegistration();
  if (!reg) return { status: 'unsubscribed', endpoint: null };

  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { status: 'unsubscribed', endpoint: null };

  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  try {
    await pushApi.unsubscribe(endpoint);
  } catch {
    // Server-side cleanup is best-effort — the SW already dropped the sub.
  }
  return { status: 'unsubscribed', endpoint: null };
}

export async function sendTestPush(): Promise<{ sent: number; removed: number }> {
  const res = await pushApi.test();
  return res.data;
}
