import { NextResponse } from 'next/server';
import { sendEmailWithFallback } from '@/lib/resendClient';
import { sendSMS } from '@/utils/sms';
import { buildMasterEmailHTML } from '@/utils/masterEmailTemplate';

function buildDispatchHTML({ order, customerName, courierName, status }) {
  const isOutForDelivery = status === 'out_for_delivery';
  const orderNum = order.order_number || order.id || 'ORDER';
  const headingText = isOutForDelivery ? 'Your Order is On Its Way! 🐝' : 'Order Ready for Pickup! 🐝';
  const nameVal = customerName || order.customerName || 'Valued Customer';
  const shopUrl = (process.env.NEXT_PUBLIC_SHOP_URL || 'https://thehoneypalaceafrica.com').replace(/\/$/, '');

  const bodyContent = `
    <div style="background-color:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:20px; text-align:left; margin-bottom:10px;">
      <h4 style="margin:0 0 12px 0; font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Delivery & Dispatch Details</h4>
      
      <p style="margin:0 0 8px 0; font-size:14px; color:#1e293b;">
        <strong>Order #:</strong> #${orderNum}
      </p>
      
      ${isOutForDelivery ? `
      <p style="margin:0 0 8px 0; font-size:14px; color:#1e293b;">
        <strong>Courier / Rider:</strong> ${courierName || 'Standard Express Rider'}
      </p>
      <p style="margin:0; font-size:13px; color:#64748b; line-height:1.5;">
        Please keep your phone nearby as the dispatch rider will call you shortly upon arrival.
      </p>
      ` : `
      <p style="margin:0; font-size:13px; color:#64748b; line-height:1.5;">
        Your items are packaged and ready for collection at our store inside GreenField Estate, Amrahia - Accra. We look forward to seeing you!
      </p>
      `}
    </div>
  `;

  return buildMasterEmailHTML({
    preheaderText: `Update regarding your order #${orderNum}`,
    title: headingText,
    subtitle: `Good news, ${nameVal}! Your order #${orderNum} status has been updated.`,
    bodyContent,
    ctaLink: isOutForDelivery ? `${shopUrl}/checkout/success?ref=${orderNum}` : `${shopUrl}/contact`,
    ctaLabel: isOutForDelivery ? 'Track Order Status ↗' : 'View Store Directions & Location ↗'
  });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const { order, customerEmail, customerName, courierName, status, customerPhone } = body;

    if (!order) {
      return NextResponse.json({ error: 'Order details missing' }, { status: 400 });
    }

    const orderNum = order.order_number || order.id || '';
    const targetEmail = customerEmail || order.customerEmail || null;
    const targetPhone = customerPhone || order.customerPhone || order.phone || null;

    let emailSent = false;
    let smsSent = false;
    let emailId = null;

    // ---- 1. SEND SMS NOTIFICATION ----
    if (status === 'out_for_delivery' && targetPhone) {
      const smsBody = `Your Palace Honey order #${orderNum} is out for delivery with ${courierName || 'Standard Rider'}. Please keep your phone nearby!`;
      try {
        console.log(`[DISPATCH SMS] Sending dispatch SMS to ${targetPhone}...`);
        const smsRes = await sendSMS(targetPhone, smsBody);
        smsSent = smsRes.success;
      } catch (smsErr) {
        console.error('[DISPATCH SMS] Failed to send SMS:', smsErr);
      }
    } else if (status === 'ready' && targetPhone) {
      const smsBody = `Your Palace Honey order #${orderNum} is packed and ready for pickup at our store!`;
      try {
        console.log(`[DISPATCH SMS] Sending pickup ready SMS to ${targetPhone}...`);
        const smsRes = await sendSMS(targetPhone, smsBody);
        smsSent = smsRes.success;
      } catch (smsErr) {
        console.error('[DISPATCH SMS] Failed to send SMS:', smsErr);
      }
    }

    // ---- 2. SEND EMAIL NOTIFICATION ----
    if (targetEmail) {
      let subject = status === 'out_for_delivery' 
        ? `Your Honey Palace order is on its way! 🐝`
        : `Your Honey Palace order is ready for pickup! 🐝`;

      try {
        console.log(`[DISPATCH EMAIL] Sending dispatch email to ${targetEmail}...`);
        const emailRes = await sendEmailWithFallback({
          from: 'The Honey Palace Orders <purchases@thehoneypalaceafrica.com>',
          replyTo: 'purchases@thehoneypalaceafrica.com',
          to: targetEmail,
          subject: subject,
          html: buildDispatchHTML({ order, customerName: customerName || order.customerName, courierName, status }),
        });

        if (!emailRes.success) {
          console.error('[DISPATCH EMAIL] Resend error:', emailRes.error);
        } else {
          emailSent = true;
          emailId = emailRes.data?.id;
        }
      } catch (emailErr) {
        console.error('[DISPATCH EMAIL] Exception sending email:', emailErr);
      }
    }

    return NextResponse.json({ success: true, emailSent, smsSent, emailId });
  } catch (error) {
    console.error('Error processing dispatch notification:', error);
    return NextResponse.json({ error: 'Failed to process notification', details: error.message }, { status: 500 });
  }
}
