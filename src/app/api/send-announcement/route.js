import { NextResponse } from 'next/server';
import { sendEmailWithFallback } from '@/lib/resendClient';
import { sendSMS, checkSMSBalance } from '@/utils/sms';
import { buildMasterEmailHTML } from '@/utils/masterEmailTemplate';
import { sendSmsDispatchReportEmail } from '@/utils/smsDispatchReport';

export async function POST(req) {
  try {
    const body = await req.json();
    const { subject, message, channel, recipients, ctaLink, ctaLabel, eventName } = body;

    let emailCount = 0;
    let smsCount = 0;
    const deliveryErrors = [];

    // Check starting SMS balance if SMS is enabled
    let balanceBefore = null;
    if (channel === 'sms' || channel === 'both') {
      try {
        const balRes = await checkSMSBalance();
        if (balRes && balRes.success && typeof balRes.balance === 'number') {
          balanceBefore = balRes.balance;
        }
      } catch (balErr) {
        console.warn('[ANNOUNCEMENT] Could not check balance before dispatch:', balErr.message);
      }
    }

    // Deduplicate recipients list by clean email & phone to ensure single send per customer
    const seenEmails = new Set();
    const seenPhones = new Set();

    const uniqueRecipients = (recipients || []).filter(r => {
      const email = (r.email || '').trim().toLowerCase();
      const phone = (r.phone || '').trim().replace(/[\s\-\+\(\)]/g, '');
      
      let isNew = false;
      if (email && !seenEmails.has(email)) {
        seenEmails.add(email);
        isNew = true;
      }
      if (phone && !seenPhones.has(phone)) {
        seenPhones.add(phone);
        isNew = true;
      }
      return isNew;
    });

    const sendPromises = uniqueRecipients.map(async (recipient) => {
      const nameVal = recipient.full_name || recipient.name || 'Valued Customer';
      const emailVal = recipient.email || '';
      const phoneVal = recipient.phone || '';
      const eventVal = recipient.event || recipient.event_name || eventName || 'The Honey Palace Event';
      const companyVal = recipient.company || recipient.organization || '';

      const personalizedMessage = message
        .replace(/\{\{Name\}\}/gi, nameVal)
        .replace(/\{\{Email\}\}/gi, emailVal)
        .replace(/\{\{Phone\}\}/gi, phoneVal)
        .replace(/\{\{Event\}\}/gi, eventVal)
        .replace(/\{\{Company\}\}/gi, companyVal);

      const personalizedSubject = subject
        .replace(/\{\{Name\}\}/gi, nameVal)
        .replace(/\{\{Email\}\}/gi, emailVal)
        .replace(/\{\{Phone\}\}/gi, phoneVal)
        .replace(/\{\{Event\}\}/gi, eventVal)
        .replace(/\{\{Company\}\}/gi, companyVal);

      // ---- EMAIL ----
      if ((channel === 'email' || channel === 'both') && recipient.email) {
        try {
          const emailRes = await sendEmailWithFallback({
            from: 'The Honey Palace <purchases@thehoneypalaceafrica.com>',
            replyTo: 'purchases@thehoneypalaceafrica.com',
            to: recipient.email.trim(),
            subject: personalizedSubject,
            html: buildMasterEmailHTML({
              preheaderText: personalizedSubject,
              title: personalizedSubject,
              subtitle: `Dear ${nameVal}, we have an update for you`,
              bodyContent: `<div style="white-space: pre-wrap; font-size: 14px; color: #333; line-height: 1.7;">${personalizedMessage}</div>`,
              ctaLink: ctaLink || `${process.env.NEXT_PUBLIC_SHOP_URL || 'https://thehoneypalaceafrica.com'}/shop`,
              ctaLabel: ctaLabel || 'Shop Honey Products ↗'
            })
          });
          if (emailRes.success) {
            emailCount++;
          }
        } catch (emailErr) {
          console.error(`Failed to send announcement email to ${recipient.email}:`, emailErr);
        }
      }

      // ---- SMS ----
      if ((channel === 'sms' || channel === 'both') && recipient.phone) {
        try {
          const smsContent = personalizedMessage;
          const res = await sendSMS(recipient.phone, smsContent);
          if (res.success) {
            smsCount++;
          } else {
            deliveryErrors.push({ phone: recipient.phone, error: res.error });
          }
        } catch (smsErr) {
          deliveryErrors.push({ phone: recipient.phone, error: smsErr.message });
          console.error(`Failed to send announcement SMS to ${recipient.phone}:`, smsErr);
        }
      }
    });

    await Promise.all(sendPromises);

    // If SMS was dispatched, check ending balance and send accounting report email
    if (channel === 'sms' || channel === 'both') {
      let balanceAfter = null;
      try {
        const balAfterRes = await checkSMSBalance();
        if (balAfterRes && balAfterRes.success && typeof balAfterRes.balance === 'number') {
          balanceAfter = balAfterRes.balance;
        }
      } catch (balAfterErr) {
        console.warn('[ANNOUNCEMENT] Could not check balance after dispatch:', balAfterErr.message);
      }

      // Trigger summary email in background
      sendSmsDispatchReportEmail({
        subject: subject || 'Announcement Broadcast',
        message,
        totalRecipients: uniqueRecipients.length,
        successfulSms: smsCount,
        failedCount: deliveryErrors.length,
        deliveryErrors,
        balanceBefore,
        balanceAfter,
        sentAt: new Date().toISOString()
      }).catch(err => console.error('[ANNOUNCEMENT] Failed to send SMS dispatch report email:', err));
    }

    return NextResponse.json({ success: true, emailCount, smsCount });
  } catch (error) {
    console.error('Send announcement error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

