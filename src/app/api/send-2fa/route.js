import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { buildMasterEmailHTML } from '@/utils/masterEmailTemplate';
import { sendEmailWithFallback } from '@/lib/resendClient';

function build2FaHTML(code) {
  const bodyContent = `
    <div style="text-align: center; padding: 10px 0 20px 0;">
      <p style="color: #444; font-size: 15px; margin-bottom: 25px; line-height: 1.6;">
        To complete your sign in to <strong>The Honey Palace Africa Dashboard</strong>, please enter the following verification code:
      </p>
      
      <div style="margin: 25px 0;">
        <span style="display: inline-block; background-color: #f7f7f9; border: 2px dashed #ffa200; color: #141006; padding: 16px 36px; border-radius: 8px; font-weight: 800; font-size: 34px; letter-spacing: 8px;">${code}</span>
      </div>

      <p style="color: #666; font-size: 13px; line-height: 1.5; margin-top: 25px;">
        This code will expire in <strong>10 minutes</strong>. If you did not request this login attempt, please change your password immediately.
      </p>
    </div>
  `;

  return buildMasterEmailHTML({
    preheaderText: `Your login verification code is ${code}`,
    title: 'Two-Factor Verification',
    subtitle: 'Security Verification for The Honey Palace Dashboard',
    bodyContent
  });
}

export async function POST(req) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ success: false, error: 'No email provided.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Rate limiting: Check if a code was already requested within the last 30 seconds
    if (adminDb) {
      try {
        const existingSnap = await adminDb.collection('2fa_codes').doc(cleanEmail).get();
        if (existingSnap.exists) {
          const existingData = existingSnap.data();
          if (existingData.createdAt) {
            const timeSinceLastSend = Date.now() - new Date(existingData.createdAt).getTime();
            if (timeSinceLastSend < 30 * 1000) {
              const secondsLeft = Math.ceil((30 * 1000 - timeSinceLastSend) / 1000);
              return NextResponse.json({
                success: false,
                error: `Please wait ${secondsLeft}s before requesting another verification code.`
              }, { status: 429 });
            }
          }
        }
      } catch (checkErr) {
        console.warn('[SEND 2FA] Could not check existing cooldown:', checkErr.message);
      }
    }

    // 2. Generate fresh 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const now = Date.now();
    const expiresAt = new Date(now + 10 * 60 * 1000).toISOString(); // 10 minutes expiration

    // 3. Save in Firestore if adminDb is initialized
    if (adminDb) {
      try {
        const docRef = adminDb.collection('2fa_codes').doc(cleanEmail);
        await docRef.set({
          code,
          createdAt: new Date(now).toISOString(),
          expiresAt,
          attempts: 0
        });
      } catch (dbErr) {
        console.warn('Could not save 2FA to adminDb:', dbErr.message);
      }
    } else {
      console.warn('[SEND 2FA] adminDb not initialized. Verification will fallback to sandbox mode.');
    }

    console.log(`[SEND 2FA] Verification code generated for ${cleanEmail}: ${code}`);

    // 3. Send email using Resend with verified fallback
    const sendResult = await sendEmailWithFallback({
      from: 'The Honey Palace Security <purchases@thehoneypalaceafrica.com>',
      replyTo: 'purchases@thehoneypalaceafrica.com',
      to: cleanEmail,
      subject: `${code} is your The Honey Palace login verification code`,
      html: build2FaHTML(code)
    });

    if (!sendResult.success) {
      console.error('[SEND 2FA] Resend failed completely:', sendResult.error);
      return NextResponse.json({ success: false, error: sendResult.error || 'Email delivery failed' }, { status: 500 });
    }

    console.log('[SEND 2FA] Email successfully sent with ID:', sendResult?.data?.id);
    return NextResponse.json({ success: true, message: `Verification code sent.` });
  } catch (error) {
    console.error('Send 2FA error:', error);
    let msg = error.message || 'Failed to send verification code';
    if (msg.includes('NOT_FOUND') || error.code === 5) {
      const dbId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || 'staging';
      msg = `Database "${dbId}" has not been created in your Firebase Console yet. Please go to Firebase Console -> Firestore Database and click "Create database" with ID "${dbId}".`;
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
