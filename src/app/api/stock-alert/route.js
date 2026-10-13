import { NextResponse } from 'next/server';
import { sendEmailWithFallback } from '@/lib/resendClient';
import { sendSMS } from '@/utils/sms';
import { buildMasterEmailHTML } from '@/utils/masterEmailTemplate';

export async function POST(req) {
  try {
    const body = await req.json();
    const { productName, stockLevel, reorderLevel } = body;

    const email = process.env.ADMIN_ALERT_EMAIL || 'hello@thehoneypalaceafrica.com';
    const phone = process.env.ADMIN_ALERT_PHONE || '233000000000';
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://inventory.thehoneypalaceafrica.com').replace(/\/$/, '');

    const subject = `🚨 LOW STOCK ALERT: ${productName}`;
    const message = `Alert: ${productName} has dropped to ${stockLevel} units (Reorder level is ${reorderLevel}). Please restock soon.`;

    let emailSent = false;
    let smsSent = false;

    // Send Email to multiple recipients
    if (email) {
      try {
        const emails = email.split(',').map(e => e.trim()).filter(Boolean);
        if (emails.length > 0) {
          const res = await sendEmailWithFallback({
            from: 'The Honey Palace System <purchases@thehoneypalaceafrica.com>',
            replyTo: 'purchases@thehoneypalaceafrica.com',
            to: emails,
            subject: subject,
            html: buildMasterEmailHTML({
              preheaderText: `Low Stock Warning: ${productName} (${stockLevel} left)`,
              title: '🚨 LOW STOCK ALERT',
              subtitle: `Stock Level Attention Required for ${productName}`,
              bodyContent: `
                <div style="background-color:#fff1f2; border:1px solid #fecdd3; border-radius:8px; padding:20px; text-align:left;">
                  <h3 style="margin:0 0 10px 0; font-size:16px; color:#be123c;">${productName}</h3>
                  <p style="margin:0 0 10px 0; font-size:14px; color:#334155; line-height:1.6;">
                    Current stock level has dropped to <strong style="color:#e11d48; font-size:16px;">${stockLevel} units</strong>.
                  </p>
                  <p style="margin:0; font-size:13px; color:#64748b; line-height:1.5;">
                    This item is at or below the threshold reorder level of <strong>${reorderLevel} units</strong>. Please arrange a restock order soon to prevent stockout.
                  </p>
                </div>
              `,
              ctaLink: `${appUrl}/inventory`,
              ctaLabel: 'View Inventory & Reorder ↗'
            })
          });
          emailSent = true;
        }
      } catch (e) {
        console.error('Low stock alert email failed:', e);
      }
    }

    // Send SMS to multiple numbers
    if (phone) {
      try {
        const phones = phone.split(',').map(p => p.trim()).filter(p => p && p !== '233000000000');
        const smsPromises = phones.map(p => sendSMS(p, message));
        const results = await Promise.allSettled(smsPromises);
        
        // If at least one succeeded
        if (results.some(r => r.status === 'fulfilled' && r.value.success)) {
          smsSent = true;
        }
      } catch (e) {
        console.error('Low stock alert SMS failed:', e);
      }
    }

    return NextResponse.json({ success: true, emailSent, smsSent });
  } catch (error) {
    console.error('Stock alert API error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
