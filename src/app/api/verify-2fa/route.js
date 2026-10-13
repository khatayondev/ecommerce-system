import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req) {
  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return NextResponse.json({ success: false, error: 'Email and verification code are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = code.toString().trim();

    // 1. If adminDb is not initialized (e.g. mock / local sandbox test fallback)
    if (!adminDb) {
      if (cleanCode === '123456') {
        return NextResponse.json({ success: true, message: 'Code verified successfully.' });
      }
      return NextResponse.json({ success: false, error: 'Invalid verification code (Sandbox Mode: use 123456).' }, { status: 400 });
    }

    const docRef = adminDb.collection('2fa_codes').doc(cleanEmail);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ success: false, error: 'No active verification session found. Please sign in again.' }, { status: 400 });
    }

    const data = docSnap.data();
    
    // 2. Check maximum attempts (brute-force defense: max 5 attempts)
    const attempts = data.attempts || 0;
    if (attempts >= 5) {
      await docRef.delete();
      return NextResponse.json({ 
        success: false, 
        error: 'Too many incorrect attempts. For security, this code has been revoked. Please sign in again.' 
      }, { status: 429 });
    }

    // 3. Check expiration
    if (new Date(data.expiresAt) < new Date()) {
      await docRef.delete();
      return NextResponse.json({ success: false, error: 'Verification code has expired. Please sign in again to receive a fresh code.' }, { status: 400 });
    }

    // 4. In development mode only, allow 123456 sandbox shortcut
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev && cleanCode === '123456') {
      await docRef.delete();
      return NextResponse.json({ success: true, message: 'Code verified successfully.' });
    }

    // 5. Validate exact code match
    if (data.code !== cleanCode) {
      const nextAttempts = attempts + 1;
      const remainingAttempts = 5 - nextAttempts;
      
      if (remainingAttempts <= 0) {
        await docRef.delete();
        return NextResponse.json({ 
          success: false, 
          error: 'Too many incorrect attempts. This code has been revoked. Please sign in again.' 
        }, { status: 400 });
      }

      await docRef.update({ attempts: nextAttempts });

      return NextResponse.json({ 
        success: false, 
        error: `Incorrect verification code. ${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.` 
      }, { status: 400 });
    }

    // 6. Success - delete code to prevent replay attacks
    await docRef.delete();

    return NextResponse.json({ success: true, message: 'Code verified successfully.' });
  } catch (error) {
    console.error('Verify 2FA error:', error);
    let msg = error.message || 'Failed to verify code';
    if (msg.includes('NOT_FOUND') || error.code === 5) {
      const dbId = process.env.NEXT_PUBLIC_FIRESTORE_DATABASE_ID || 'staging';
      msg = `Database "${dbId}" has not been created in your Firebase Console yet. Please go to Firebase Console -> Firestore Database and click "Create database" with ID "${dbId}".`;
    }
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
