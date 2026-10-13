export function buildReceiptHTML(receipt) {
  const itemsList = receipt.cartItems || receipt.items || [];
  const itemsRowsHTML = itemsList.map(item => `
    <tr>
      <td style="font-size:14px; color:#1a1a1a; padding:14px 0 0 0; font-family: 'Poppins', Helvetica, Arial, sans-serif;">
        ${item.name || item.description || 'Product Item'}
        <div style="font-size:11px; color:#9aa0a6; margin-top:2px; font-family: 'Poppins', Helvetica, Arial, sans-serif;">Qty: ${item.quantity || 1}</div>
      </td>
      <td style="font-size:14px; color:#1a1a1a; padding:14px 0 0 0; text-align:right; font-family: 'Poppins', sans-serif; font-weight:700;">GHS ${((item.quantity || 1) * Number(item.price || item.unitPrice || 0))?.toFixed(2)}</td>
    </tr>
  `).join('');

  const receiptId = receipt.id || receipt.invoiceNumber || receipt.sale_id || `HP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  const totalPaid = Number(receipt.total || receipt.amountPaid || 0);
  const subtotal = Number(receipt.subtotal || totalPaid);
  const discount = Number(receipt.discount || receipt.discountAmount || 0);
  const tax = Number(receipt.tax || 0);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<style>
  :root { color-scheme: light; }
  @media (prefers-color-scheme: dark) {
    body, table, td, p, a, span { color-scheme: light !important; }
  }
</style>

<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sales Receipt</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
</head>
<body style="margin:0; padding:0; background-color:#e9eaec; font-family: 'Poppins', Helvetica, Arial, sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e9eaec; padding:32px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="380" cellpadding="0" cellspacing="0" style="max-width:380px; background-color:#ffffff; border-radius:6px; overflow:hidden;">

        <!-- Logo -->
        <tr>
          <td align="center" style="padding:28px 24px 20px 24px;">
            <img src="https://thehoneypalaceafrica.com/assets/honey-palace-logo.png" style="height:48px; width:auto; display:block;" alt="The Honey Palace Logo" />
          </td>
        </tr>

        <!-- Dark hero section -->
        <tr>
          <td style="background-color:#141006; padding:36px 24px 40px 24px;" align="center">
            <!-- checkmark circle -->
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:56px; height:56px; border-radius:50%; border:2px solid #ffa200; text-align:center; vertical-align:middle;" align="center">
                  <span style="color:#ffa200; font-size:24px; font-weight:bold;">&#10003;</span>
                </td>
              </tr>
            </table>

            <p style="color:#ffffff; font-size:20px; font-weight:800; margin:20px 0 6px 0; font-family: 'Poppins', sans-serif; text-transform:uppercase; letter-spacing:2px;">RECEIPT</p>
            <p style="color:#ffffff; font-size:36px; font-weight:800; margin:0 0 16px 0; font-family: 'Poppins', sans-serif;">GHS ${totalPaid.toFixed(2)}</p>
            <p style="color:#a9b0ac; font-size:13px; line-height:1.5; margin:0; max-width:280px; font-family: 'Poppins', sans-serif;">
              Thank you for shopping with us. Your receipt details are detailed below.
            </p>
          </td>
        </tr>

        <!-- White dashed perforation -->
        <tr>
          <td style="padding:0; line-height:0; font-size:0; background-color:#ffffff;">
            <img src="https://thehoneypalaceafrica.com/perforation.png" width="380" alt="" style="display:block; width:100%; height:auto; border:0;">
          </td>
        </tr>

        <!-- Request ID / Date -->
        <tr>
          <td style="padding:24px 28px 8px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:11px; color:#9aa0a6; text-transform:uppercase; letter-spacing:0.5px; padding-bottom:6px; font-family: 'Poppins', sans-serif;">Receipt ID:</td>
                <td style="font-size:11px; color:#9aa0a6; text-transform:uppercase; letter-spacing:0.5px; padding-bottom:6px; text-align:right; font-family: 'Poppins', sans-serif;">Date & Time:</td>
              </tr>
              <tr>
                <td style="font-size:14px; color:#1a1a1a; font-weight:700; font-family: 'Poppins', sans-serif;">${receiptId}</td>
                <td style="font-size:13px; color:#1a1a1a; font-weight:600; text-align:right; font-family: 'Poppins', sans-serif;">
                  ${new Date(receipt.paidAt || receipt.sale_date || receipt.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Requested items table -->
        <tr>
          <td style="padding:20px 28px 8px 28px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:11px; color:#9aa0a6; text-transform:uppercase; letter-spacing:0.5px; padding-bottom:10px; border-bottom:1px solid #eceeef; font-family: 'Poppins', sans-serif;">Purchased Item</td>
                <td style="font-size:11px; color:#9aa0a6; text-transform:uppercase; letter-spacing:0.5px; padding-bottom:10px; border-bottom:1px solid #eceeef; text-align:right; font-family: 'Poppins', sans-serif;">Amount</td>
              </tr>

              ${itemsRowsHTML}

              <tr>
                <td style="font-size:13px; color:#71717a; padding:16px 0 0 0; font-family: 'Poppins', sans-serif;">Subtotal</td>
                <td style="font-size:13px; color:#1a1a1a; padding:16px 0 0 0; text-align:right; font-family: 'Poppins', sans-serif; font-weight:600;">GHS ${subtotal.toFixed(2)}</td>
              </tr>
              ${discount > 0 ? `
              <tr>
                <td style="font-size:13px; color:#dc2626; padding:10px 0 0 0; font-family: 'Poppins', sans-serif;">Discount</td>
                <td style="font-size:13px; color:#dc2626; padding:10px 0 0 0; text-align:right; font-family: 'Poppins', sans-serif; font-weight:600;">-GHS ${discount.toFixed(2)}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="font-size:13px; color:#71717a; padding:10px 0 12px 0; font-family: 'Poppins', sans-serif;">Taxes</td>
                <td style="font-size:13px; color:#1a1a1a; padding:10px 0 12px 0; text-align:right; font-family: 'Poppins', sans-serif; font-weight:600;">GHS ${tax.toFixed(2)}</td>
              </tr>

              ${(receipt.applyWht || Number(receipt.whtAmount || 0) > 0) ? `
              <tr>
                <td style="font-size:13px; color:#1a1a1a; padding:6px 0; font-family: 'Poppins', sans-serif; font-weight:700;">Invoice Value</td>
                <td style="font-size:13px; color:#1a1a1a; padding:6px 0; text-align:right; font-family: 'Poppins', sans-serif; font-weight:700;">GHS ${Number(receipt.invoiceValue || (totalPaid + Number(receipt.whtAmount || 0))).toFixed(2)}</td>
              </tr>
              <tr>
                <td style="font-size:13px; color:#b45309; padding:6px 0; font-family: 'Poppins', sans-serif; font-weight:600;">Less Withholding Tax (${receipt.whtRate || 3}%)</td>
                <td style="font-size:13px; color:#b45309; padding:6px 0; text-align:right; font-family: 'Poppins', sans-serif; font-weight:700;">-GHS ${Number(receipt.whtAmount || 0).toFixed(2)}</td>
              </tr>
              ` : ''}

              <tr>
                <td style="border-top:1px solid #eceeef; padding-top:14px; font-size:14px; color:#1a1a1a; font-weight:800; font-family: 'Poppins', sans-serif;">
                  ${(receipt.applyWht || Number(receipt.whtAmount || 0) > 0) ? 'Actual Amount Paid' : 'Total Paid'}
                </td>
                <td style="border-top:1px solid #eceeef; padding-top:14px; font-size:15px; color:#D07B00; font-weight:800; text-align:right; font-family: 'Poppins', sans-serif;">
                  GHS ${Number(receipt.actualAmountPaid || totalPaid).toFixed(2)}
                </td>
              </tr>

              ${receipt.notes ? `
              <tr>
                <td colspan="2" style="padding-top:14px; font-size:11px; color:#4b5563; font-style:italic; line-height:1.5; font-family: 'Poppins', sans-serif; border-top:1px dashed #e5e7eb;">
                  <strong>Description:</strong> ${receipt.notes}
                </td>
              </tr>
              ` : ''}
            </table>
          </td>
        </tr>

        <!-- CTA button -->
        <tr>
          <td align="center" style="padding:28px 28px 32px 28px;">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td align="center" style="background-color:#ffa200; border-radius:50px;">
                  <a href="${process.env.NEXT_PUBLIC_SHOP_URL || 'https://thehoneypalaceafrica.com'}/receipt/${receiptId}?print=true" style="display:block; padding:14px 24px; color:#141006; font-size:13px; font-weight:700; text-decoration:none; text-transform:uppercase; letter-spacing:0.5px; font-family: 'Poppins', sans-serif;">Download Receipt (PDF)</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer info -->
        <tr>
          <td style="padding:20px 28px 28px 28px; background-color:#f9fafb; border-top:1px solid #eceeef; text-align:center;">
            <p style="font-size:12px; color:#6b7280; margin:0 0 4px 0;">The Honey Palace Africa</p>
            <p style="font-size:11px; color:#9ca3af; margin:0;">Inside GreenField Estate, Amrahia - Accra, Ghana</p>
            <p style="font-size:11px; color:#9ca3af; margin-top:4px;">Email: <a href="mailto:purchases@thehoneypalaceafrica.com" style="color:#ffa200;">purchases@thehoneypalaceafrica.com</a></p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>
  `;
}
