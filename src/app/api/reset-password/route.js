import { NextResponse } from 'next/server';
import { updateAuthPassword } from '@/lib/firebaseAuthAdmin';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req) {
  try {
    const { uid, password, email } = await req.json();

    if (!uid || !password) {
      return NextResponse.json(
        { success: false, error: 'User UID and new password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters.' },
        { status: 400 }
      );
    }

    // Update password in Firebase Auth via Identity Toolkit
    await updateAuthPassword({ uid, password });

    // Look up email if not provided
    let targetEmail = (email || '').trim().toLowerCase();
    let recipientName = 'Team Member';

    if (adminDb) {
      try {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        if (userDoc.exists) {
          const udata = userDoc.data();
          if (!targetEmail && udata.email) {
            targetEmail = udata.email.trim().toLowerCase();
          }
          if (udata.full_name) {
            recipientName = udata.full_name;
          }
        }
        await adminDb.collection('users').doc(uid).set({
          password_updated_at: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        // non-blocking
      }
    }

    // Send email with new password if email is available
    let emailSent = false;
    if (targetEmail) {
      try {
        const { sendEmailWithFallback } = await import('@/lib/resendClient');
        const { buildMasterEmailHTML } = await import('@/utils/masterEmailTemplate');
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://inventory.thehoneypalaceafrica.com').replace(/\/$/, '');
        const loginUrl = `${appUrl}/login`;

        const bodyContent = `
          <p style="font-size:15px; color:#333; line-height:1.7; margin-bottom:18px;">
            Hello <strong>${recipientName}</strong>,
          </p>
          <p style="font-size:14px; color:#444; line-height:1.7; margin-bottom:20px;">
            Your password for <strong>The Honey Palace Africa Management Dashboard</strong> has been reset by an administrator.
          </p>

          <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:20px 22px; margin-bottom:25px;">
            <p style="margin:0 0 12px 0; font-size:12px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.8px;">Your New Login Credentials</p>
            <div style="margin-bottom:10px;">
              <span style="font-size:13px; color:#64748b; display:block; margin-bottom:2px;">Email Address:</span>
              <strong style="font-size:15px; color:#0f172a; font-family:monospace;">${targetEmail}</strong>
            </div>
            <div>
              <span style="font-size:13px; color:#64748b; display:block; margin-bottom:2px;">New Password:</span>
              <strong style="font-size:15px; color:#b45309; background:#fef3c7; padding:3px 8px; border-radius:6px; font-family:monospace; display:inline-block;">${password}</strong>
            </div>
          </div>

          <p style="font-size:13px; color:#64748b; line-height:1.6; margin-bottom:10px;">
            You can log in right away using the link below.
          </p>
        `;

        const emailResult = await sendEmailWithFallback({
          from: 'The Honey Palace Security <purchases@thehoneypalaceafrica.com>',
          to: targetEmail,
          subject: 'Your Honey Palace Password Has Been Reset',
          html: buildMasterEmailHTML({
            preheaderText: 'Your Honey Palace password has been updated',
            title: 'Password Updated',
            subtitle: 'Security update for your staff account',
            bodyContent,
            ctaLink: loginUrl,
            ctaLabel: 'Log In with New Password ↗'
          })
        });

        if (emailResult.success) {
          emailSent = true;
          console.log(`[RESET PASSWORD] New credentials emailed to ${targetEmail}`);
        }
      } catch (mailErr) {
        console.warn('[RESET PASSWORD] Email send warning:', mailErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      emailSent,
      message: emailSent
        ? `Password updated and new credentials sent to ${targetEmail}.`
        : 'Password updated successfully.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update password' },
      { status: 500 }
    );
  }
}
