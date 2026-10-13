import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { sendSMS, checkSMSBalance } from '@/utils/sms';
import { sendEmailWithFallback } from '@/lib/resendClient';
import { buildMasterEmailHTML } from '@/utils/masterEmailTemplate';
import { sendSmsDispatchReportEmail } from '@/utils/smsDispatchReport';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function processScheduledMessages(targetAnnouncementId = null) {
  if (!adminDb) {
    return { error: 'Firestore Admin not initialized' };
  }

  const nowStr = new Date().toISOString();
  const results = { scheduled_sms: [], announcements: [] };

  // 1. Order Thank-You SMS has been permanently disabled to prevent unsolicited automated dispatches.
  // Any legacy or lingering pending records in scheduled_sms are safely cancelled.
  if (!targetAnnouncementId) {
    try {
      const orderSmsSnap = await adminDb.collection('scheduled_sms')
        .where('status', '==', 'pending')
        .limit(100)
        .get();

      for (const docSnap of orderSmsSnap.docs) {
        await docSnap.ref.update({
          status: 'cancelled',
          cancelledReason: 'Automatic order thank-you SMS disabled',
          cancelledAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('[CRON] Error clearing legacy scheduled_sms:', err);
    }
  }

  // 2. Process Scheduled Broadcast Announcements
  try {
    let dueAnnDocs = [];

    if (targetAnnouncementId) {
      const targetDoc = await adminDb.collection('announcements').doc(targetAnnouncementId).get();
      if (targetDoc.exists) {
        dueAnnDocs = [targetDoc];
      }
    } else {
      // Query scheduled or stale processing announcements (avoids requiring compound index in Firestore)
      const annSnap = await adminDb.collection('announcements')
        .where('status', 'in', ['scheduled', 'processing'])
        .get();

      dueAnnDocs = annSnap.docs.filter(docSnap => {
        const data = docSnap.data();
        if (data.status === 'processing') {
          // If stuck in processing for more than 10 minutes, auto-recover it
          if (!data.processingStartedAt) return true;
          const startedMs = new Date(data.processingStartedAt).getTime();
          return (Date.now() - startedMs) > 10 * 60 * 1000;
        }
        const scheduledFor = data.scheduledFor;
        if (!scheduledFor) return true;
        const scheduledForStr = typeof scheduledFor.toDate === 'function' ? scheduledFor.toDate().toISOString() : String(scheduledFor);
        return scheduledForStr <= nowStr;
      });
    }

    for (const docSnap of dueAnnDocs) {
      const ann = docSnap.data();
      const annRef = docSnap.ref;

      // Mark processing to avoid duplicate concurrent sends
      await annRef.update({ 
        status: 'processing',
        processingStartedAt: new Date().toISOString()
      });

      let recipientsList = ann.recipients || [];

      // If no pre-attached recipients, resolve by audience
      if (recipientsList.length === 0 && ann.audience) {
        if (ann.audience === 'individual' && ann.individualId) {
          const custDoc = await adminDb.collection('customers').doc(ann.individualId).get();
          if (custDoc.exists) {
            recipientsList = [custDoc.data()];
          }
        } else {
          // Check if audience is a contact list ID
          const listDoc = await adminDb.collection('contact_lists').doc(ann.audience).get();
          if (listDoc.exists) {
            recipientsList = listDoc.data().recipients || [];
          } else {
            // Check customers by type
            let q = adminDb.collection('customers');
            if (ann.audience === 'wholesale') q = q.where('customer_type', '==', 'Wholesale');
            if (ann.audience === 'retail') q = q.where('customer_type', '==', 'Retail');
            const custs = await q.get();
            recipientsList = custs.docs.map(d => d.data());
          }
        }
      }

      let emailCount = ann.emailCount || 0;
      let smsCount = ann.smsCount || 0;
      const deliveryErrors = Array.isArray(ann.deliveryErrors) ? [...ann.deliveryErrors] : [];
      const startIndex = typeof ann.lastProcessedIndex === 'number' ? ann.lastProcessedIndex : 0;

      // Check balance before dispatch if SMS
      let balanceBefore = null;
      if (ann.channel === 'sms' || ann.channel === 'both') {
        try {
          const balRes = await checkSMSBalance();
          if (balRes && balRes.success && typeof balRes.balance === 'number') {
            balanceBefore = balRes.balance;
          }
        } catch (e) {
          console.warn('[CRON] Could not check balance before dispatch:', e.message);
        }
      }

      // Dispatch in concurrent chunks of 15 for fast completion and resilience
      const CHUNK_SIZE = 15;
      for (let i = startIndex; i < recipientsList.length; i += CHUNK_SIZE) {
        const chunk = recipientsList.slice(i, i + CHUNK_SIZE);
        await Promise.allSettled(chunk.map(async (recipient) => {
          const nameVal = recipient.full_name || recipient.name || recipient.Name || 'Valued Customer';
          const emailVal = (recipient.email || recipient.Email || '').trim();
          const phoneVal = (recipient.phone || recipient.Phone || recipient.phoneNumber || recipient.PhoneNumber || '').trim();
          const eventVal = recipient.event || recipient.event_name || ann.eventName || 'The Honey Palace Event';
          const companyVal = recipient.company || recipient.Company || recipient.organization || '';

          const personalizedMessage = (ann.message || '')
            .replace(/\{\{Name\}\}/gi, nameVal)
            .replace(/\{\{Email\}\}/gi, emailVal)
            .replace(/\{\{Phone\}\}/gi, phoneVal)
            .replace(/\{\{Event\}\}/gi, eventVal)
            .replace(/\{\{Company\}\}/gi, companyVal);

          const personalizedSubject = (ann.subject || '')
            .replace(/\{\{Name\}\}/gi, nameVal)
            .replace(/\{\{Email\}\}/gi, emailVal)
            .replace(/\{\{Phone\}\}/gi, phoneVal)
            .replace(/\{\{Event\}\}/gi, eventVal)
            .replace(/\{\{Company\}\}/gi, companyVal);

          // SMS dispatch
          if ((ann.channel === 'sms' || ann.channel === 'both') && phoneVal) {
            try {
              const res = await sendSMS(phoneVal, personalizedMessage);
              if (res.success) {
                smsCount++;
              } else {
                deliveryErrors.push({ phone: phoneVal, error: res.error });
              }
            } catch (e) {
              deliveryErrors.push({ phone: phoneVal, error: e.message });
              console.error('[CRON] SMS error for', phoneVal, e);
            }
          }

          // Email dispatch
          if ((ann.channel === 'email' || ann.channel === 'both') && emailVal) {
            try {
              const res = await sendEmailWithFallback({
                from: 'The Honey Palace <purchases@thehoneypalaceafrica.com>',
                replyTo: 'purchases@thehoneypalaceafrica.com',
                to: emailVal,
                subject: personalizedSubject,
                html: buildMasterEmailHTML({
                  preheaderText: personalizedSubject,
                  title: personalizedSubject,
                  subtitle: `Dear ${nameVal}, we have an update for you`,
                  bodyContent: `<div style="white-space: pre-wrap; font-size: 14px; color: #333; line-height: 1.7;">${personalizedMessage}</div>`,
                  ctaLink: `${process.env.NEXT_PUBLIC_SHOP_URL || 'https://thehoneypalaceafrica.com'}/shop`,
                  ctaLabel: 'Shop Honey Products ↗'
                })
              });
              if (res.success) {
                emailCount++;
              } else {
                deliveryErrors.push({ email: emailVal, error: res.error });
              }
            } catch (e) {
              deliveryErrors.push({ email: emailVal, error: e.message });
              console.error('[CRON] Email error for', emailVal, e);
            }
          }
        }));

        // Incremental state save
        await annRef.update({
          lastProcessedIndex: Math.min(i + CHUNK_SIZE, recipientsList.length),
          smsCount,
          emailCount,
          updatedAt: new Date().toISOString()
        });
      }

      await annRef.update({
        status: 'sent',
        sentAt: new Date().toISOString(),
        dispatchedCount: recipientsList.length,
        emailCount,
        smsCount,
        lastProcessedIndex: recipientsList.length,
        deliveryErrors: deliveryErrors.length > 0 ? deliveryErrors.slice(0, 50) : null
      });

      // Send SMS Dispatch Accounting Report Email
      if (ann.channel === 'sms' || ann.channel === 'both') {
        let balanceAfter = null;
        try {
          const balAfterRes = await checkSMSBalance();
          if (balAfterRes && balAfterRes.success && typeof balAfterRes.balance === 'number') {
            balanceAfter = balAfterRes.balance;
          }
        } catch (e) {
          console.warn('[CRON] Could not check balance after dispatch:', e.message);
        }

        sendSmsDispatchReportEmail({
          subject: ann.subject || 'Scheduled SMS Broadcast',
          message: ann.message || '',
          totalRecipients: recipientsList.length,
          successfulSms: smsCount,
          failedCount: deliveryErrors.length,
          deliveryErrors,
          balanceBefore,
          balanceAfter,
          sentAt: new Date().toISOString()
        }).catch(err => console.error('[CRON] Failed to send SMS dispatch report email:', err));
      }

      results.announcements.push({
        id: docSnap.id,
        subject: ann.subject,
        recipients: recipientsList.length,
        smsCount,
        emailCount,
        errorCount: deliveryErrors.length
      });
    }
  } catch (err) {
    console.error('[CRON] Error processing scheduled announcements:', err);
    return { error: err.message, ...results };
  }

  return results;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const announcementId = searchParams.get('announcementId') || null;
    const results = await processScheduledMessages(announcementId);
    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error('[CRON SMS] Global error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    let announcementId = null;
    try {
      const body = await req.json();
      if (body && body.announcementId) {
        announcementId = body.announcementId;
      }
    } catch (_) {}

    const results = await processScheduledMessages(announcementId);
    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error('[CRON SMS] Global error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
