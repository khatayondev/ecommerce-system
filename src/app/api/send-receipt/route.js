import { NextResponse } from 'next/server';
import { sendSMS } from '@/utils/sms';
import { buildReceiptHTML } from '@/utils/receiptEmailTemplate';
import { sendEmailWithFallback } from '@/lib/resendClient';

export async function POST(req) {
  try {
    const body = await req.json();
    const { customerEmail, customerPhone, receipt, channel } = body;

    if (!receipt) {
      return NextResponse.json({ success: false, error: 'Receipt data is required' }, { status: 400 });
    }

    // Validation
    if (channel === 'email' && !customerEmail) {
      return NextResponse.json({ success: false, error: 'Customer email address is required' }, { status: 400 });
    }
    if (channel === 'sms' && !customerPhone) {
      return NextResponse.json({ success: false, error: 'Customer phone number is required' }, { status: 400 });
    }

    const itemsList = receipt.items || receipt.cartItems || [];
    const shopUrl = (process.env.NEXT_PUBLIC_SHOP_URL || 'https://thehoneypalaceafrica.com').replace(/\/$/, '');
    const receiptId = receipt.receiptNumber || receipt.id || receipt.sale_id || receipt.order_number || '';
    const receiptLink = receiptId ? `${shopUrl}/receipt/${receiptId}` : shopUrl;

    const results = {};
    const errors = [];
    const successes = [];

    // 1. Email Dispatch
    if ((channel === 'email' || channel === 'both') && customerEmail) {
      console.log(`[RECEIPT EMAIL] Sending receipt to ${customerEmail}`);
      try {
        const emailRes = await sendEmailWithFallback({
          from: 'The Honey Palace Receipts <purchases@thehoneypalaceafrica.com>',
          replyTo: 'purchases@thehoneypalaceafrica.com',
          to: customerEmail.trim(),
          subject: `Your Receipt from The Honey Palace (#${receiptId})`,
          html: buildReceiptHTML({ ...receipt, items: itemsList, cartItems: itemsList })
        });
        results.email = emailRes;
        if (emailRes.success) {
          successes.push('Email');
        } else {
          console.error("Resend send-receipt error:", emailRes.error);
          errors.push(`Email: ${emailRes.error}`);
        }
      } catch (emailErr) {
        console.error("Email dispatch exception:", emailErr);
        errors.push(`Email: ${emailErr.message}`);
      }
    }

    // 2. SMS Dispatch
    if ((channel === 'sms' || channel === 'both') && customerPhone) {
      console.log(`[RECEIPT SMS] Dispatching receipt SMS to ${customerPhone}`);
      const itemsSummary = itemsList.length > 0
        ? itemsList.map(i => `${i.quantity || 1}x ${i.name || 'Product'}`).join(', ')
        : 'Honey Products';
      const smsBody = `The Honey Palace Receipt\nTotal: GHS ${Number(receipt.total || 0).toFixed(2)}\nItems: ${itemsSummary}\nView & Download PDF Receipt: ${receiptLink}\nThank you!`;
      
      try {
        const smsRes = await sendSMS(customerPhone, smsBody);
        results.sms = smsRes;
        console.log(`[RECEIPT SMS RESULT] To: ${customerPhone} | Success: ${smsRes.success}`);
        if (smsRes.success) {
          successes.push('SMS');
        } else {
          errors.push(`SMS: ${smsRes.error || 'Failed to deliver SMS'}`);
        }
      } catch (smsErr) {
        console.error("Failed to send receipt SMS:", smsErr);
        errors.push(`SMS: ${smsErr.message}`);
      }
    }

    if (successes.length > 0) {
      const message = errors.length > 0
        ? `Sent via ${successes.join(' & ')}, but failed for ${errors.join(', ')}`
        : `Receipt sent successfully via ${successes.join(' & ')}!`;
      return NextResponse.json({ 
        success: true, 
        message,
        results,
        partial: errors.length > 0
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: errors.join('. ') || 'Failed to dispatch receipt',
      results 
    }, { status: 400 });
  } catch (error) {
    console.error('Send receipt error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
