import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import webpush from 'web-push';

// Initialize web-push VAPID details
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

try {
  if (vapidPublicKey && vapidPrivateKey && !vapidPublicKey.includes('SENSITIVE') && !vapidPrivateKey.includes('SENSITIVE')) {
    webpush.setVapidDetails(
      'mailto:purchases@thehoneypalaceafrica.com',
      vapidPublicKey,
      vapidPrivateKey
    );
  } else {
    console.warn('[Push API] VAPID keys missing or invalid. Web Push notifications will not send.');
  }
} catch (vapidErr) {
  console.warn('[Push API] VAPID init error:', vapidErr.message);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, body: msgBody, url, orderId } = body;

    console.log(`[API /api/send-push-notification] Broadcasting alert: "${title}" - "${msgBody}"`);

    if (!adminDb) {
      return NextResponse.json({ error: 'Database disconnected' }, { status: 500 });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: 'VAPID credentials missing on server' }, { status: 500 });
    }

    // 1. Fetch all registered push subscriptions from Firestore using adminDb
    const subsSnap = await adminDb.collection('push_subscriptions').get();
    const subscriptions = [];
    subsSnap.forEach(d => {
      subscriptions.push({ id: d.id, ...d.data() });
    });

    console.log(`[Push API] Sending to ${subscriptions.length} active subscription devices.`);

    const payload = JSON.stringify({
      title,
      body: msgBody,
      url: url || '/orders',
      orderId: orderId || ''
    });

    const sendPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub.subscription, payload);
      } catch (err) {
        // If subscription has expired or is no longer valid, prune it from Firestore
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log(`[Push API] Pruning expired subscription: ${sub.id}`);
          try {
            await adminDb.collection('push_subscriptions').doc(sub.id).delete();
          } catch (deleteErr) {
            console.error(`[Push API] Failed to delete sub doc ${sub.id}:`, deleteErr);
          }
        } else {
          console.warn(`[Push API] Failed sending push to subscription ${sub.id}:`, err.message);
        }
      }
    });

    // Run parallel pushes and wait for all to complete
    await Promise.all(sendPromises);

    return NextResponse.json({
      success: true,
      message: `Broadcasting completed to all active PWA devices. Sent: ${subscriptions.length}`
    });
  } catch (error) {
    console.error('[API /api/send-push-notification] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
