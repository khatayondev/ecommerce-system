import { NextResponse } from 'next/server';
import { sendSMS } from '@/utils/sms';
import { buildInvoiceHTML } from '@/utils/invoiceEmailTemplate';
import { sendEmailWithFallback } from '@/lib/resendClient';
import { adminDb } from '@/lib/firebaseAdmin';

export async function POST(req) {
  try {
    const order = await req.json();

    if (!order.id) {
      return NextResponse.json({ success: false, error: 'No order ID provided.' }, { status: 400 });
    }

    const itemsList = order.cartItems || order.items || [];
    const subtotal = Number(order.subtotal || order.total || itemsList.reduce((acc, item) => acc + (item.quantity * Number(item.price || item.unitPrice || 0)), 0));
    const discount = Number(order.discountAmount || order.discount || 0);
    const deliveryFee = Number(order.deliveryFee || 0);
    const total = subtotal - discount + deliveryFee;

    const isPrepaid = order.paymentStatus === 'paid' || order.paymentStatus === 'Paid';
    const amountToCharge = isPrepaid ? (order.deliveryFee || 0) : total;

    // 1. Check if invoice is ALREADY PAID in Firestore to strictly prevent duplicate payment requests
    let existingPaymentUrl = (order.paymentUrl || '').trim();
    let isAlreadyPaid = false;

    if (adminDb && order.id) {
      try {
        const invDoc = await adminDb.collection('invoices').doc(order.id).get();
        if (invDoc.exists) {
          const invData = invDoc.data();
          if (invData.status === 'paid' || invData.paymentStatus === 'paid') {
            isAlreadyPaid = true;
          }
          if (invData.paymentUrl) {
            existingPaymentUrl = invData.paymentUrl;
          }
        } else {
          const ordDoc = await adminDb.collection('orders').doc(order.id).get();
          if (ordDoc.exists) {
            const ordData = ordDoc.data();
            if (ordData.paymentStatus === 'paid' || ordData.status === 'PAID') {
              isAlreadyPaid = true;
            }
            if (ordData.paymentUrl) {
              existingPaymentUrl = ordData.paymentUrl;
            }
          }
        }
      } catch (dbErr) {
        console.warn('[Send Invoice] Firestore check error:', dbErr.message);
      }
    }

    if (isAlreadyPaid) {
      return NextResponse.json({
        success: false,
        error: 'This invoice/order is already marked as PAID. Cannot generate new payment requests.'
      }, { status: 400 });
    }

    // 2. Resolve Payment URL (Strict Idempotency: Reuse existing Paystack checkout link if one exists)
    let paymentUrl = existingPaymentUrl;

    if (amountToCharge > 0 && !paymentUrl) {
      const invoiceIdentifier = order.invoiceNumber || order.order_number || order.id;
      // Deterministic reference ensures one unique session per invoice
      const cleanRef = `INV_${invoiceIdentifier.replace(/[^a-zA-Z0-9_-]/g, '')}`;

      console.log(`[Send Invoice] Initializing single Paystack checkout for ${invoiceIdentifier} with ref ${cleanRef}`);

      const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: order.customerEmail || 'billing@thehoneypalaceafrica.com',
          amount: Math.round(amountToCharge * 100), // convert GHS to pesewas
          reference: cleanRef,
          callback_url: `${process.env.NEXT_PUBLIC_SHOP_URL || 'https://thehoneypalaceafrica.com'}/checkout/success?ref=${order.id}`,
          metadata: {
            order_id: order.id,
            invoice_id: order.id,
            order_number: invoiceIdentifier,
            charge_type: isPrepaid ? 'delivery_only' : 'full'
          }
        })
      });

      const paystackData = await paystackRes.json();
      if (!paystackData.status) {
        console.error("Paystack initialization error:", paystackData);
        throw new Error(paystackData.message || "Failed to initialize payment");
      }

      paymentUrl = paystackData.data.authorization_url;

      // Persist the generated link in Firestore so future requests NEVER create a duplicate transaction
      if (adminDb && order.id) {
        try {
          const invRef = adminDb.collection('invoices').doc(order.id);
          const invSnap = await invRef.get();
          if (invSnap.exists) {
            await invRef.update({ paymentUrl, paymentReference: cleanRef });
          } else {
            const ordRef = adminDb.collection('orders').doc(order.id);
            const ordSnap = await ordRef.get();
            if (ordSnap.exists) {
              await ordRef.update({ paymentUrl, paymentReference: cleanRef });
            }
          }
        } catch (saveErr) {
          console.warn("[Send Invoice] Could not persist paymentUrl to Firestore:", saveErr.message);
        }
      }
    }

    // 3. Dispatch Notifications according to explicit channel
    // Channels supported: 'email' (only email), 'sms' (only sms), 'both' (email & sms), 'none' (neither)
    let channel = order.channel || 'both';
    if (order.skipNotification) {
      channel = 'none';
    }

    const shouldSendEmail = (channel === 'email' || channel === 'both') && !!order.customerEmail;
    const shouldSendSms = (channel === 'sms' || channel === 'both') && !!order.customerPhone;

    let emailSent = false;
    let smsSent = false;

    const isProforma = order.invoiceType === 'proforma';

    // Send Email if requested
    if (shouldSendEmail) {
      console.log(`[INVOICE EMAIL] Sending ${isProforma ? 'pro forma' : 'invoice'} ${order.invoiceNumber || order.order_number || order.id} to ${order.customerEmail}`);
      const emailSubject = isProforma
        ? `Quotation / Pro Forma Invoice ${order.invoiceNumber || order.id} - The Honey Palace Africa`
        : (isPrepaid
            ? `Delivery Quote for Order ${order.order_number || order.id} - The Honey Palace Africa`
            : `Invoice ${order.invoiceNumber || order.order_number || order.id} from The Honey Palace Africa`);

      const emailResult = await sendEmailWithFallback({
        from: 'The Honey Palace Invoices <purchases@thehoneypalaceafrica.com>',
        replyTo: 'purchases@thehoneypalaceafrica.com',
        to: order.customerEmail,
        subject: emailSubject,
        html: buildInvoiceHTML(order, paymentUrl, isPrepaid, amountToCharge)
      });

      if (!emailResult.success) {
        console.error("Resend send-invoice error details:", emailResult.error);
        throw new Error(emailResult.error || "Failed to send invoice email.");
      }
      emailSent = true;
    }

    // Send SMS ONLY if explicitly requested in channel
    if (shouldSendSms) {
      console.log(`[INVOICE SMS] Sending notification to ${order.customerPhone}`);
      const smsBody = isProforma
        ? `Your Honey Palace Pro Forma Invoice (${order.invoiceNumber || ''}) has been issued! Estimated Total: GHS ${total.toFixed(2)}. Check your email for full quotation terms & specs.`
        : (isPrepaid
            ? `Your Honey Palace order ${order.order_number || ''} delivery fee is ready! Delivery Cost: GHS ${amountToCharge.toFixed(2)}. Pay here to dispatch: ${paymentUrl}`
            : `Your Honey Palace invoice ${order.invoiceNumber || order.order_number || ''} is ready! Total: GHS ${amountToCharge.toFixed(2)}. Pay here to complete: ${paymentUrl}`);
      try {
        await sendSMS(order.customerPhone, smsBody);
        smsSent = true;
      } catch (e) {
        console.error("Failed to send invoice SMS:", e);
      }
    }

    return NextResponse.json({
      success: true,
      paymentUrl,
      emailSent,
      smsSent,
      channelUsed: channel
    });
  } catch (error) {
    console.error('Send invoice error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
