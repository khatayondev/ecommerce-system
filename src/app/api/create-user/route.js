import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { createAuthUser, lookupAuthUser, updateAuthUser } from '@/lib/firebaseAuthAdmin';
import { sendEmailWithFallback } from '@/lib/resendClient';
import { buildMasterEmailHTML } from '@/utils/masterEmailTemplate';

function buildAccountCreatedHTML({ name, email, password, role, loginUrl }) {
  const recipientName = name || 'Team Member';

  const bodyContent = `
    <p style="font-size:15px; color:#333; line-height:1.7; margin-bottom:18px;">
      Hello <strong>${recipientName}</strong>,
    </p>
    <p style="font-size:14px; color:#444; line-height:1.7; margin-bottom:20px;">
      Your staff account for <strong>The Honey Palace Africa Management Dashboard</strong> has been created and activated.
      You have been assigned the role: <strong style="color:#d97706;">${role}</strong>.
    </p>

    <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:20px 22px; margin-bottom:25px;">
      <p style="margin:0 0 12px 0; font-size:12px; color:#64748b; font-weight:700; text-transform:uppercase; letter-spacing:0.8px;">Your Login Credentials</p>
      <div style="margin-bottom:10px;">
        <span style="font-size:13px; color:#64748b; display:block; margin-bottom:2px;">Email Address:</span>
        <strong style="font-size:15px; color:#0f172a; font-family:monospace;">${email}</strong>
      </div>
      <div>
        <span style="font-size:13px; color:#64748b; display:block; margin-bottom:2px;">Temporary Password:</span>
        <strong style="font-size:15px; color:#b45309; background:#fef3c7; padding:3px 8px; border-radius:6px; font-family:monospace; display:inline-block;">${password}</strong>
      </div>
    </div>

    <p style="font-size:13px; color:#64748b; line-height:1.6; margin-bottom:10px;">
      Please keep these credentials secure. You can log in directly at the link below.
    </p>
  `;

  return buildMasterEmailHTML({
    preheaderText: `Your Honey Palace staff credentials (${role})`,
    title: 'Welcome to the Team',
    subtitle: `Your staff account is ready with role: ${role}`,
    bodyContent,
    ctaLink: loginUrl,
    ctaLabel: 'Log In to Dashboard ↗'
  });
}

export async function POST(req) {
  try {
    const { email, password, full_name, roles, is_active } = await req.json();

    if (!email || !password || !full_name) {
      return NextResponse.json(
        { success: false, error: 'Full name, email, and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const resolvedRoles = (roles && roles.length > 0) ? roles : ['Sales Exec'];
    const activeState = is_active !== false;

    // 1. Create account in Firebase Authentication (or update if already exists)
    let authResult;
    try {
      authResult = await createAuthUser({
        email: cleanEmail,
        password: password,
        displayName: full_name.trim()
      });
    } catch (authErr) {
      if (authErr.code === 'EMAIL_EXISTS' || (authErr.message && authErr.message.includes('EMAIL_EXISTS'))) {
        console.log(`[CREATE USER] Email ${cleanEmail} already exists in Auth. Updating credentials and roles...`);
        const existing = await lookupAuthUser(cleanEmail);
        if (!existing || !existing.uid) {
          throw new Error('User exists but could not retrieve account details.');
        }
        authResult = await updateAuthUser({
          uid: existing.uid,
          password: password,
          displayName: full_name.trim()
        });
      } else {
        throw authErr;
      }
    }

    const uid = authResult.uid;

    // 2. Create or sync Firestore profile under users/{uid}
    if (adminDb) {
      const userPayload = {
        uid,
        email: cleanEmail,
        full_name: full_name.trim(),
        role: resolvedRoles,
        roles: resolvedRoles,
        active: activeState,
        is_active: activeState,
        created_at: new Date().toISOString()
      };

      await adminDb.collection('users').doc(uid).set(userPayload, { merge: true });

      // 3. Delete any legacy seed doc under users/{email}
      try {
        const seedRef = adminDb.collection('users').doc(cleanEmail);
        const seedSnap = await seedRef.get();
        if (seedSnap.exists) {
          await seedRef.delete();
        }
      } catch (seedErr) {
        console.warn('[CREATE USER] Legacy seed doc cleanup note:', seedErr.message);
      }
    }

    // 4. Send email with login credentials directly to the staff member
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://inventory.thehoneypalaceafrica.com')
      .replace(/\/$/, '');
    const loginUrl = `${appUrl}/login`;

    let emailSent = false;
    let emailDeliveryDetails = null;

    try {
      const emailResult = await sendEmailWithFallback({
        from: 'The Honey Palace Security <purchases@thehoneypalaceafrica.com>',
        to: cleanEmail,
        subject: 'Your Honey Palace Staff Account Credentials',
        html: buildAccountCreatedHTML({
          name: full_name.trim(),
          email: cleanEmail,
          password: password,
          role: resolvedRoles.join(', '),
          loginUrl
        })
      });

      if (emailResult.success) {
        emailSent = true;
        emailDeliveryDetails = emailResult.data;
        console.log(`[CREATE USER] Credentials email sent directly to ${cleanEmail} (ID: ${emailResult.data?.id})`);
      } else {
        console.warn(`[CREATE USER] Email delivery returned error:`, emailResult.error);
        emailDeliveryDetails = { error: emailResult.error };
      }
    } catch (emailErr) {
      console.warn('[CREATE USER] Resend email exception:', emailErr.message);
      emailDeliveryDetails = { error: emailErr.message };
    }

    return NextResponse.json({
      success: true,
      uid,
      email: cleanEmail,
      full_name: full_name.trim(),
      roles: resolvedRoles,
      emailSent,
      emailDeliveryDetails,
      message: emailSent
        ? `Staff account created and credentials emailed directly to ${cleanEmail}.`
        : `Staff account created for ${cleanEmail}. (Could not dispatch email notification)`
    });

  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create user account' },
      { status: 500 }
    );
  }
}
