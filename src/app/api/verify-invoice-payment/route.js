import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { buildReceiptHTML } from '@/utils/receiptEmailTemplate';
import { sendEmailWithFallback } from '@/lib/resendClient';

export async function POST(req) {
  try {
    const { invoiceId, reference } = await req.json();

    if (!invoiceId || !reference) {
      return NextResponse.json({ success: false, error: 'Invoice ID and payment reference are required.' }, { status: 400 });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json({ success: false, error: 'PAYSTACK_SECRET_KEY is not configured.' }, { status: 500 });
    }

    // Verify transaction with Paystack API
    const paystackRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const paystackData = await paystackRes.json();

    if (paystackData.status && paystackData.data?.status === 'success') {
      const amountPaid = (paystackData.data.amount || 0) / 100;
      const paidAt = paystackData.data.paid_at || new Date().toISOString();

      if (adminDb) {
        const invoiceRef = adminDb.collection('invoices').doc(invoiceId);
        const docSnap = await invoiceRef.get();

        if (docSnap.exists) {
          const invData = docSnap.data();
          // Prevent double processing if already marked as paid
          if (invData.status === 'paid') {
            console.log(`[Verify Invoice Payment] Invoice ${invoiceId} was already marked as PAID. Skipping duplicate processing.`);
            return NextResponse.json({
              success: true,
              paid: true,
              alreadyRecorded: true,
              amountPaid,
              paidAt: invData.paidAt || paidAt
            });
          }

          await invoiceRef.update({
            status: 'paid',
            paidAt: paidAt,
            paymentReference: reference,
            amountPaid: amountPaid,
            paidVia: 'paystack',
            lastUpdated: new Date().toISOString()
          });

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
                  paidAt: paidAt
                })
              });
              console.log(`[Verify Invoice Payment] Dispatched receipt email to ${invData.customerEmail}`);
            } catch (emailErr) {
              console.error('[Verify Invoice Payment] Failed to send receipt email:', emailErr);
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        paid: true,
        amountPaid,
        paidAt
      });
    }

    return NextResponse.json({
      success: true,
      paid: false,
      paystackStatus: paystackData.data?.status || 'unpaid'
    });
  } catch (error) {
    console.error('[Verify Invoice Payment Error]:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
