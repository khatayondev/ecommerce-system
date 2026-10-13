import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@/lib/firebaseAdmin';
import { buildReceiptHTML } from '@/utils/receiptEmailTemplate';
import { sendEmailWithFallback } from '@/lib/resendClient';

export async function POST(req) {
  try {
    const rawBody = await req.text();
    const paystackSignature = req.headers.get('x-paystack-signature');
    const secretKey = process.env.PAYSTACK_SECRET_KEY;

    // Verify signature if secret key is present
    if (secretKey && paystackSignature) {
      const hash = crypto
        .createHmac('sha512', secretKey)
        .update(rawBody)
        .digest('hex');

      if (hash !== paystackSignature) {
        console.error('[Paystack Webhook] Invalid signature mismatch');
        return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 400 });
      }
    }

    const payload = JSON.parse(rawBody);
    const event = payload.event;
    const data = payload.data;

    console.log(`[Paystack Webhook Received] Event: ${event}, Reference: ${data?.reference}`);

    if (event === 'charge.success') {
      const reference = data.reference;
      const metadata = data.metadata || {};
      const invoiceId = metadata.invoice_id || metadata.order_id;
      const amountPaid = (data.amount || 0) / 100;

      if (adminDb && invoiceId) {
        console.log(`[Paystack Webhook] Processing payment for invoice ${invoiceId}`);

        // 1. Update invoice document
        const invoiceRef = adminDb.collection('invoices').doc(invoiceId);
        const invoiceDoc = await invoiceRef.get();

        if (invoiceDoc.exists) {
          const invData = invoiceDoc.data();

          // Idempotency: skip if already marked as paid
          if (invData.status === 'paid') {
            console.log(`[Paystack Webhook] Invoice ${invoiceId} is already marked as PAID. Skipping duplicate processing.`);
            return NextResponse.json({ status: 'success', message: 'Already processed' }, { status: 200 });
          }

          await invoiceRef.update({
            status: 'paid',
            paidAt: new Date().toISOString(),
            paymentReference: reference,
            amountPaid: amountPaid,
            paidVia: 'paystack',
            lastUpdated: new Date().toISOString()
          });
          console.log(`[Paystack Webhook] Successfully marked invoice ${invoiceId} as PAID in Firestore!`);

          if (invData.customerEmail) {
            try {
              await sendEmailWithFallback({
                from: 'The Honey Palace Receipts <purchases@thehoneypalaceafrica.com>',
                replyTo: 'purchases@thehoneypalaceafrica.com',
                to: invData.customerEmail,
                subject: `Your Receipt for Invoice ${invData.invoiceNumber || invoiceId} - The Honey Palace`,
                html: buildReceiptHTML({
                  id: invData.invoiceNumber || invoiceId,
                  total: amountPaid || Number(invData.total || 0),
                  subtotal: Number(invData.subtotal || amountPaid || 0),
                  discount: Number(invData.discountAmount || 0),
                  tax: Number(invData.tax || 0),
                  cartItems: invData.items || invData.cartItems || [],
                  paidAt: new Date().toISOString()
                })
              });
              console.log(`[Paystack Webhook] Dispatched receipt email to ${invData.customerEmail}`);
            } catch (emailErr) {
              console.error('[Paystack Webhook] Failed to send receipt email:', emailErr);
            }
          }
        }

        // 2. Also check if matching order document exists
        const orderRef = adminDb.collection('orders').doc(invoiceId);
        const orderDoc = await orderRef.get();
        if (orderDoc.exists) {
          await orderRef.update({
            paymentStatus: 'paid',
            paidAt: new Date().toISOString(),
            paymentReference: reference,
            lastUpdated: new Date().toISOString()
          });
          console.log(`[Paystack Webhook] Successfully marked order ${invoiceId} as PAID in Firestore!`);
        }
      }
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    console.error('[Paystack Webhook Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
