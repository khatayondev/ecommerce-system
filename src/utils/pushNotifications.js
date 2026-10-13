'use client';

/**
 * Utility for Mobile PWA Web Push Notifications
 */

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeUserToPush() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Service Worker or Push Manager not supported.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Unsubscribe existing first to ensure fresh keys and registration success on both server and client
    let subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      console.log('[Push] Unsubscribed old subscription to ensure fresh VAPID register.');
    }
    
    const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicVapidKey) {
      console.warn('[Push] VAPID public key environment variable is not defined.');
      return null;
    }

    const convertedVapidKey = urlBase64ToUint8Array(publicVapidKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    });
    console.log('[Push] User subscribed to push service successfully.');

    // Send subscription to database
    const res = await fetch('/api/register-push-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription })
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Server rejected registration');
    }

    console.log('[Push] Subscription uploaded and saved in Firestore.');
    return subscription;
  } catch (err) {
    console.error('[Push] Failed to subscribe user to push notifications:', err);
    return null;
  }
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('[Push] Web Notifications are not supported on this browser/device.');
    return 'unsupported';
  }

  if (Notification.permission === 'granted') {
    // Refresh subscription in the background
    subscribeUserToPush();
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('[Push] Notification permission response:', permission);
    if (permission === 'granted') {
      await subscribeUserToPush();
    }
    return permission;
  } catch (err) {
    console.error('[Push] Error requesting notification permission:', err);
    return 'denied';
  }
}

export async function triggerNewOrderNotification(order) {
  if (typeof window === 'undefined') return;

  const title = `🛒 New Order Received!`;
  const body = `Order #${order.id || order.sale_id || 'THP'} (${order.customer_name || 'Walk-in'}) • Total: ₵${(order.total || 0).toFixed(2)}`;
  const icon = '/assets/honey-palace-logo.png';

  // 1. Direct Service Worker Notification
  if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, {
          body,
          icon,
          badge: icon,
          vibrate: [200, 100, 200, 100, 200],
          tag: `order-${order.id}`,
          data: { url: '/orders' }
        });
        console.log('[Push] Native mobile system notification displayed.');
      }
    } catch (e) {
      console.warn('[Push] Service worker notification error:', e);
    }
  }

  // 2. Broadcast via API backend to notify all registered staff devices
  try {
    await fetch('/api/send-push-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body,
        url: '/orders',
        orderId: order.id || order.sale_id
      })
    });
  } catch (e) {
    console.warn('[Push] Broadcast push notification endpoint warning:', e);
  }
}

export async function showNativeNotification(title, body, url = '/orders') {
  if (typeof window === 'undefined') return;

  const icon = '/assets/honey-palace-logo.png';

  // 1. Try showing via Service Worker (best for Mobile PWA and macOS wrapped apps)
  if ('serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, {
          body,
          icon,
          badge: icon,
          vibrate: [200, 100, 200, 100, 200],
          tag: `notif-${Date.now()}`,
          data: { url }
        });
        console.log('[Push] Notification shown via service worker.');
        return;
      }
    } catch (e) {
      console.warn('[Push] Service worker notification failed, falling back:', e);
    }
  }

  // 2. Direct browser notification fallback
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon,
        tag: `notif-${Date.now()}`
      });
      console.log('[Push] Notification shown via direct browser API.');
    } catch (err) {
      console.warn('[Push] Browser Notification constructor failed:', err);
    }
  }
}

export function playNotificationSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // First chime (higher pitch, G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5 pitch
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.25);

    // Second chime (slightly delayed, lower pitch, E5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); 
    gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.35);
  } catch (e) {
    console.warn('[Sound] AudioContext block or error:', e);
  }
}
