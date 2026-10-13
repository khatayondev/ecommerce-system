import { buildMasterEmailHTML } from './masterEmailTemplate.js';
import { sendEmailWithFallback } from '../lib/resendClient.js';

/**
 * Calculates telecom SMS parts/segments from message character length.
 * 1 - 160 chars = 1 credit
 * 161 - 306 chars = 2 credits (concatenated with 153 chars/part)
 * 307 - 459 chars = 3 credits
 * 460+ chars = ceil(length / 153)
 */
export function calculateSmsParts(message = '') {
  const len = (message || '').length;
  if (len <= 0) return 1;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

/**
 * Sends a detailed SMS Dispatch & Telecom Accounting Report to admin emails.
 */
export async function sendSmsDispatchReportEmail({
  subject = 'SMS Broadcast',
  message = '',
  totalRecipients = 0,
  successfulSms = 0,
  failedCount = 0,
  deliveryErrors = [],
  balanceBefore = null,
  balanceAfter = null,
  senderName = 'Admin',
  sentAt = new Date().toISOString(),
  targetEmails = null
}) {
  try {
    const charCount = (message || '').length;
    const creditsPerSms = calculateSmsParts(message);

    const creditsUsed = (balanceBefore !== null && balanceAfter !== null)
      ? Math.max(0, balanceBefore - balanceAfter)
      : successfulSms * creditsPerSms;

    // Resolve target admin emails (exclusively thehoneypalace2022@gmail.com)
    let recipientsList = targetEmails;
    if (!recipientsList || recipientsList.length === 0) {
      recipientsList = ['thehoneypalace2022@gmail.com'];
    }
    const uniqueRecipients = [...new Set(recipientsList.map(e => (e || '').trim().toLowerCase()).filter(Boolean))];

    const formattedDate = new Date(sentAt).toLocaleString('en-GB', {
      timeZone: 'Africa/Accra',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const bodyContent = `
      <div style="font-family:'Poppins', Helvetica, Arial, sans-serif; color:#222;">
        
        <!-- Status Banner -->
        <div style="background-color:#f0fdf4; border:1px solid #bbf7d0; border-radius:12px; padding:16px 20px; margin-bottom:24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="middle" style="width:28px;">
                <span style="display:inline-block; width:12px; height:12px; background-color:#16a34a; border-radius:50%;"></span>
              </td>
              <td valign="middle">
                <p style="margin:0; font-size:15px; font-weight:700; color:#14532d;">
                  SMS Dispatch Completed Successfully
                </p>
                <p style="margin:2px 0 0 0; font-size:12px; color:#166534;">
                  Campaign: <strong>${subject}</strong> &bull; Sent on ${formattedDate} GMT
                </p>
              </td>
            </tr>
          </table>
        </div>

        <!-- 1. The Math & Telecom Rules Summary Table -->
        <h3 style="font-size:15px; font-weight:800; color:#141006; margin:0 0 10px 0; text-transform:uppercase; letter-spacing:0.5px;">
          1. The Math &amp; Telecom Rules
        </h3>
        
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-bottom:24px; border:1px solid #e5e7eb; border-radius:10px; overflow:hidden;">
          <thead>
            <tr style="background-color:#141006; color:#ffffff; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;">
              <th align="left" style="padding:10px 14px; font-weight:700;">Item</th>
              <th align="center" style="padding:10px 14px; font-weight:700;">Value</th>
              <th align="left" style="padding:10px 14px; font-weight:700;">Explanation</th>
            </tr>
          </thead>
          <tbody style="font-size:13px; color:#374151;">
            <tr style="border-bottom:1px solid #f3f4f6; background-color:#ffffff;">
              <td style="padding:10px 14px; font-weight:600;">Balance Before Dispatch</td>
              <td align="center" style="padding:10px 14px; font-weight:700; color:#141006; font-family:monospace; font-size:14px;">
                ${balanceBefore !== null ? `${balanceBefore.toLocaleString()} credits` : '—'}
              </td>
              <td style="padding:10px 14px; color:#6b7280; font-size:12px;">Gateway credit balance right before this dispatch</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6; background-color:#fafafa;">
              <td style="padding:10px 14px; font-weight:600;">Balance After Dispatch</td>
              <td align="center" style="padding:10px 14px; font-weight:700; color:#16a34a; font-family:monospace; font-size:14px;">
                ${balanceAfter !== null ? `${balanceAfter.toLocaleString()} credits` : '—'}
              </td>
              <td style="padding:10px 14px; color:#6b7280; font-size:12px;">Gateway credit balance remaining in account</td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6; background-color:#fffbeb;">
              <td style="padding:10px 14px; font-weight:700; color:#b45309;">Credits Used</td>
              <td align="center" style="padding:10px 14px; font-weight:800; color:#b45309; font-family:monospace; font-size:15px;">
                ${creditsUsed.toLocaleString()} credits
              </td>
              <td style="padding:10px 14px; color:#92400e; font-size:12px; font-weight:500;">
                ${balanceBefore !== null && balanceAfter !== null ? `${balanceBefore} &minus; ${balanceAfter} = ${creditsUsed} credits deducted` : `Total credits deducted for this run`}
              </td>
            </tr>
            <tr style="border-bottom:1px solid #f3f4f6; background-color:#ffffff;">
              <td style="padding:10px 14px; font-weight:600;">Recipients Sent</td>
              <td align="center" style="padding:10px 14px; font-weight:700; color:#141006; font-size:14px;">
                ${successfulSms.toLocaleString()} customers
              </td>
              <td style="padding:10px 14px; color:#6b7280; font-size:12px;">
                Successfully delivered out of ${totalRecipients} targeted ${failedCount > 0 ? `(${failedCount} failed format)` : ''}
              </td>
            </tr>
            <tr style="background-color:#fafafa;">
              <td style="padding:10px 14px; font-weight:700; color:#141006;">Credits Per Customer</td>
              <td align="center" style="padding:10px 14px; font-weight:800; color:#d97706; font-size:15px; font-family:monospace;">
                ${creditsPerSms} ${creditsPerSms === 1 ? 'credit' : 'credits'}
              </td>
              <td style="padding:10px 14px; color:#6b7280; font-size:12px;">
                Due to message character length (${charCount} characters = ${creditsPerSms} telecom SMS segments)
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 2. Why Each Message Cost Explanation -->
        <h3 style="font-size:15px; font-weight:800; color:#141006; margin:0 0 10px 0; text-transform:uppercase; letter-spacing:0.5px;">
          2. Why Each Message Cost ${creditsPerSms} ${creditsPerSms === 1 ? 'Credit' : 'Credits'}
        </h3>
        
        <div style="background-color:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:18px 20px; margin-bottom:24px; font-size:13px; line-height:1.6; color:#78350f;">
          <p style="margin:0 0 10px 0; font-weight:700; color:#92400e; font-size:14px;">
            Standard telecommunication SMS rules worldwide (and on Arkesel / Ghana networks):
          </p>
          <ul style="margin:0 0 12px 0; padding-left:20px;">
            <li style="margin-bottom:4px;"><strong>1 to 160 characters</strong> = <strong>1 SMS credit</strong> (single standard message)</li>
            <li style="margin-bottom:4px;"><strong>161 to 306 characters</strong> = <strong>2 SMS credits</strong> (two messages joined together)</li>
            <li><strong>307+ characters</strong> = <strong>3+ SMS credits</strong> (multi-part concatenated message)</li>
          </ul>
          <div style="background-color:#ffffff; border:1px dashed #f59e0b; border-radius:8px; padding:12px 16px; margin-top:8px;">
            <p style="margin:0; font-size:12px; color:#451a03;">
              <strong>This Broadcast's Length:</strong> <code>${charCount} characters</code> &rarr; 
              ${creditsPerSms === 1 
                ? 'Fits within the 160-character limit (billed as <strong>1 credit per customer</strong>).' 
                : `Exceeds 160 characters, requiring <strong>${creditsPerSms} concatenated SMS parts</strong> per customer.`}
            </p>
          </div>
        </div>

        <!-- 3. Message Content Preview -->
        <h3 style="font-size:14px; font-weight:800; color:#141006; margin:0 0 8px 0; text-transform:uppercase; letter-spacing:0.5px;">
          Message Text Dispatched
        </h3>
        <div style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:14px 18px; margin-bottom:24px; font-size:13px; color:#1f2937; line-height:1.6; white-space:pre-wrap;">${message}</div>

        ${deliveryErrors && deliveryErrors.length > 0 ? `
        <!-- Delivery Issues / Warnings -->
        <h3 style="font-size:14px; font-weight:800; color:#dc2626; margin:0 0 8px 0; text-transform:uppercase; letter-spacing:0.5px;">
          Delivery Warnings (${deliveryErrors.length})
        </h3>
        <div style="background-color:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:14px 18px; margin-bottom:24px; font-size:12px; color:#991b1b;">
          <p style="margin:0 0 8px 0; font-weight:700;">The following numbers could not be delivered due to formatting errors in the customer database:</p>
          <ul style="margin:0; padding-left:18px;">
            ${deliveryErrors.slice(0, 10).map(e => `<li><code>${e.phone || 'N/A'}</code>: ${e.error || 'Failed'}</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <p style="font-size:12px; color:#9ca3af; margin:24px 0 0 0; text-align:center;">
          This automated accounting notification was sent from The Honey Palace Africa inventory system.
        </p>
      </div>
    `;

    const html = buildMasterEmailHTML({
      preheaderText: `SMS Dispatch Report: ${subject} (${successfulSms} sent, ${creditsUsed} credits used)`,
      title: 'SMS Dispatch Report',
      subtitle: `Campaign Delivery & Telecom Accounting Summary`,
      bodyContent,
      ctaLink: `${process.env.NEXT_PUBLIC_SHOP_URL || 'https://thehoneypalaceafrica.com'}/communications`,
      ctaLabel: 'View Communications Dashboard ↗'
    });

    for (const email of uniqueRecipients) {
      await sendEmailWithFallback({
        to: email,
        subject: `[SMS Report] ${subject} - ${successfulSms} Delivered (${creditsUsed} Credits)`,
        html
      });
    }

    return { success: true, recipients: uniqueRecipients };
  } catch (err) {
    console.error('[SMS Report Email Error]', err);
    return { success: false, error: err.message };
  }
}
