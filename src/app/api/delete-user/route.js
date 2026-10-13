import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { deleteAuthUser } from '@/lib/firebaseAuthAdmin';

export async function POST(req) {
  try {
    const { uid, email } = await req.json();

    if (!uid && !email) {
      return NextResponse.json({ success: false, error: 'uid or email is required.' }, { status: 400 });
    }

    const errors = [];

    // 1. Delete from Firebase Auth via REST API (avoids ESM conflict)
    if (uid) {
      try {
        await deleteAuthUser(uid);
      } catch (err) {
        errors.push(`Auth deletion failed: ${err.message}`);
      }
    }

    // 2. Delete from Firestore by UID
    if (uid && adminDb) {
      try {
        await adminDb.collection('users').doc(uid).delete();
      } catch (err) {
        errors.push(`Firestore (uid) deletion failed: ${err.message}`);
      }
    }

    // 3. Delete seed doc by email (if email provided)
    if (email && adminDb) {
      try {
        const emailDocRef = adminDb.collection('users').doc(email.trim().toLowerCase());
        const snap = await emailDocRef.get();
        if (snap.exists) {
          await emailDocRef.delete();
        }
      } catch (err) {
        errors.push(`Firestore (email) deletion failed: ${err.message}`);
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'User deleted from Firebase Auth and Firestore.' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
