import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import crypto from 'crypto';

export async function POST(request) {
  try {
    const body = await request.json();
    const { subscription, userId } = body;

    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database disconnected' }, { status: 500 });
    }

    // Create a unique deterministic ID from the endpoint URL
    const docId = crypto.createHash('sha256').update(subscription.endpoint).digest('hex');
    const subRef = adminDb.collection('push_subscriptions').doc(docId);

    await subRef.set({
      subscription,
      userId: userId || 'anonymous',
      updatedAt: new Date().toISOString()
    });

    console.log(`[Push API] Registered/Updated subscription: ${docId.substring(0, 8)}...`);

    return NextResponse.json({ success: true, message: 'Subscription registered successfully' });
  } catch (error) {
    console.error('[Push API] Error registering subscription:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
