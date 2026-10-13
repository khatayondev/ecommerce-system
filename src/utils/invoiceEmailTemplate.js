export function buildInvoiceHTML(order, paymentUrl = '', isPrepaid = false, amountToCharge = 0, settings = {}) {
  const itemsList = order.items || order.cartItems || [];
  const itemsRowsHTML = (Array.isArray(itemsList) ? itemsList : []).map(item => {
    const price = Number(item.price || item.unitPrice || 0);
    const qty = Number(item.quantity || 1);
    const itemTotal = Number(item.total || (qty * price));
    return `
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 12px 15px; font-weight: 500; color: #111827; font-family: 'Poppins', Arial, sans-serif; font-size: 13px;">${item.name || 'Product'}</td>
        <td style="padding: 12px 15px; text-align: right; color: #4b5563; font-family: 'Poppins', Arial, sans-serif; font-size: 13px;">GHS ${price.toFixed(2)}</td>
        <td style="padding: 12px 15px; text-align: center; color: #4b5563; border-right: 1px solid #e5e7eb; font-family: 'Poppins', Arial, sans-serif; font-size: 13px;">${qty}</td>
        <td style="padding: 12px 15px; text-align: right; font-weight: bold; color: #111827; font-family: 'Poppins', Arial, sans-serif; font-size: 13px;">GHS ${itemTotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  const subtotal = Number(order.subtotal || order.total || itemsList.reduce((acc, item) => acc + ((item.quantity || 1) * Number(item.price || item.unitPrice || 0)), 0));
  const vat = Number(order.vat || order.tax || 0);
  const discount = Number(order.discountAmount || order.discount || 0);
  const deliveryFee = Number(order.deliveryFee || 0);
  const total = Number(order.total || (subtotal + vat - discount + deliveryFee));
  const invoiceNum = order.invoiceNumber || order.order_number || order.id || 'INVOICE';

  const issueDateFormatted = order.issueDate || order.createdAt
    ? new Date(order.issueDate || order.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  const dueDateFormatted = order.dueDate
    ? new Date(order.dueDate).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Upon Receipt';

  const company = {
    name: 'The Honey Palace Africa',
    email: 'purchases@thehoneypalaceafrica.com',
    phone: '+233 55 454 8978',
    address: 'Inside GreenField Estate, Amrahia - Accra, Ghana',
    website: 'thehoneypalaceafrica.com'
  };

  const isProforma = order.invoiceType === 'proforma';

  const chargeAmount = amountToCharge > 0 ? amountToCharge : total;

  let paymentCTA = '';
  if (isProforma) {
    paymentCTA = `
      <tr>
        <td align="center" style="padding: 20px 30px;">
          <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 18px; text-align: center;">
            <span style="display: inline-block; background-color: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 20px; text-transform: uppercase; margin-bottom: 8px;">
              Official Pro Forma Quotation
            </span>
            <p style="margin: 6px 0 0 0; color: #78350f; font-size: 13px; font-family: 'Poppins', sans-serif; line-height: 1.5;">
              This is a preliminary price estimate issued for budgeting and Purchase Order (PO) approval.
              ${order.validUntil ? `<br><strong>Validity:</strong> Valid until ${new Date(order.validUntil).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}
              ${order.leadTime ? `<br><strong>Estimated Lead Time:</strong> ${order.leadTime}` : ''}
            </p>
            ${paymentUrl ? `
              <div style="margin-top: 14px;">
                <a href="${paymentUrl}" target="_blank" style="display: inline-block; background-color: #ffa200; padding: 12px 24px; color: #141006; font-size: 13px; font-weight: 800; text-decoration: none; border-radius: 50px; text-transform: uppercase; letter-spacing: 0.5px;">
                  Confirm Order & Pay (GHS ${chargeAmount.toFixed(2)})
                </a>
              </div>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  } else if (chargeAmount > 0 && paymentUrl) {
    paymentCTA = `
      <tr>
        <td align="center" style="padding: 24px 30px;">
          <p style="margin-bottom: 16px; color: #4b5563; font-size: 13px; text-align: center; font-family: 'Poppins', sans-serif;">
            ${isPrepaid 
              ? `Your items are prepaid. Click below to pay the delivery fee of <strong>GHS ${chargeAmount.toFixed(2)}</strong> so we can dispatch your order.` 
              : `Your invoice is ready. Click the button below to complete your payment securely via Paystack.`}
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" style="background-color: #ffa200; border-radius: 50px;">
                <a href="${paymentUrl}" target="_blank" style="display: inline-block; background-color: #ffa200; padding: 16px 36px; color: #141006; font-size: 14px; font-weight: 800; text-decoration: none; border-radius: 50px; text-transform: uppercase; letter-spacing: 1px; font-family: 'Poppins', sans-serif;">
                  ${isPrepaid ? `Pay Delivery Fee &bull; GHS ${chargeAmount.toFixed(2)}` : `Pay Now &bull; GHS ${chargeAmount.toFixed(2)}`}
                </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  } else if (order.status === 'paid' || isPrepaid) {
    paymentCTA = `
      <tr>
        <td align="center" style="padding: 20px 30px;">
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 14px; text-align: center;">
            <p style="margin: 0; color: #166534; font-weight: 700; font-size: 13px; font-family: 'Poppins', sans-serif;">
              &#10003; This invoice is fully paid. No further payment required.
            </p>
          </div>
        </td>
      </tr>
    `;
  }

    const taxesList = Array.isArray(order.taxes) && order.taxes.length > 0
    ? order.taxes
    : (vat > 0 ? [{ name: 'Taxes', rate: 0, amount: vat }] : []);

  const taxesRowsHTML = taxesList.map(t => `
    <tr>
      <td style="color: #4b5563; font-weight: bold;">${t.name || 'Tax'}${t.rate ? ` (${t.rate}%)` : ''}:</td>
      <td style="text-align: right; font-weight: bold; color: #111827;">GHS ${Number(t.amount || 0).toFixed(2)}</td>
    </tr>
  `).join('');

  if (isProforma) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Pro Forma Invoice #${invoiceNum} - The Honey Palace Africa</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Poppins', Helvetica, Arial, sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 30px 10px;">
  <tr>
    <td align="center">
      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; max-width: 680px; width: 100%; margin: auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; padding: 36px; box-sizing: border-box;">
        
        <!-- 1. Top Header: Logo Left, Title Right -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="vertical-align: middle; width: 50%;">
              <img src="https://thehoneypalaceafrica.com/assets/honey-palace-logo.png" style="width: 125px; height: auto; display: block;" alt="The Honey Palace" />
              <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; font-weight: 600;">
                The Home of Quality Honey
              </div>
            </td>
            <td style="vertical-align: middle; text-align: right; width: 50%;">
              <h1 style="font-size: 24px; font-weight: 900; color: #111827; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1;">
                PRO FORMA INVOICE
              </h1>
              <div style="width: 44px; height: 3px; background-color: #ffa200; margin-left: auto; margin-top: 6px; border-radius: 2px;"></div>
              <div style="font-size: 10px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; font-weight: 600;">
                Commercial Price Quotation
              </div>
            </td>
          </tr>
        </table>

        <!-- 2. Metadata Strip (4 Columns) -->
        <div style="border-top: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 14px 0; margin-bottom: 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 11px;">
            <tr>
              <td style="width: 22%; vertical-align: top; border-right: 1px solid #f3f4f6; padding-right: 10px;">
                <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;">Invoice no.</div>
                <div style="font-size: 12px; font-weight: 800; color: #111827; font-family: monospace;">#${invoiceNum}</div>
              </td>
              <td style="width: 20%; vertical-align: top; border-right: 1px solid #f3f4f6; padding-left: 10px; padding-right: 10px;">
                <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;">Date</div>
                <div style="font-size: 12px; font-weight: 700; color: #111827;">${issueDateFormatted}</div>
              </td>
              <td style="width: 22%; vertical-align: top; border-right: 1px solid #f3f4f6; padding-left: 10px; padding-right: 10px;">
                <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;">Valid Until</div>
                <div style="font-size: 12px; font-weight: 800; color: #b45309;">
                  ${order.validUntil ? new Date(order.validUntil).toLocaleDateString('en-GB') : '14 Days'}
                </div>
                ${order.leadTime ? `<div style="font-size: 10px; color: #6b7280; margin-top: 2px;">Lead: ${order.leadTime}</div>` : ''}
              </td>
              <td style="width: 36%; vertical-align: top; padding-left: 10px;">
                <div style="font-size: 10px; color: #9ca3af; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; margin-bottom: 4px;">Invoice to:</div>
                <div style="font-size: 12px; font-weight: 800; color: #111827;">${order.customerName || 'Valued Client'}</div>
                ${order.customerCompany ? `<div style="font-size: 11px; color: #4b5563; font-weight: 600;">${order.customerCompany}</div>` : ''}
                ${order.poNumber ? `<div style="font-size: 10px; color: #6b7280; margin-top: 2px; font-family: monospace;">PO Ref: ${order.poNumber}</div>` : ''}
              </td>
            </tr>
          </table>
        </div>

        <!-- 3. Featured Total Display & Client Contact Info -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="vertical-align: middle; width: 55%;">
              <div style="font-size: 11px; font-weight: 800; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">
                TOTAL DUE
              </div>
              <div style="font-size: 28px; font-weight: 900; color: #111827; margin-top: 2px; letter-spacing: -0.5px; line-height: 1.1;">
                GHS ${total.toFixed(2)}
              </div>
            </td>
            <td style="vertical-align: middle; text-align: right; width: 45%; font-size: 11px; color: #4b5563; line-height: 1.6;">
              ${order.customerAddress || order.deliveryAddress ? `<div>${order.customerAddress || order.deliveryAddress}</div>` : ''}
              ${order.customerPhone ? `<div>${order.customerPhone}</div>` : ''}
              ${order.customerEmail ? `<div>${order.customerEmail}</div>` : ''}
            </td>
          </tr>
        </table>

        <!-- 4. Itemized Table with Filled Accent Header and Zebra Rows -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px; font-size: 12px;">
          <thead>
            <tr style="background-color: #ffa200; color: #000000; font-weight: 800; font-size: 11px; text-transform: capitalize;">
              <th style="padding: 10px 14px; text-align: left; border-radius: 4px 0 0 4px; width: 48%;">Item Description</th>
              <th style="padding: 10px 14px; text-align: right; width: 18%;">Unit Price</th>
              <th style="padding: 10px 14px; text-align: center; width: 14%;">Qty</th>
              <th style="padding: 10px 14px; text-align: right; border-radius: 0 4px 4px 0; width: 20%;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(Array.isArray(itemsList) ? itemsList : []).map((item, idx) => {
              const price = Number(item.price || item.unitPrice || 0);
              const qty = Number(item.quantity || 1);
              const itemTotal = Number(item.total || (qty * price));
              const isZebra = idx % 2 === 1;
              return `
                <tr style="background-color: ${isZebra ? '#f9fafb' : '#ffffff'}; border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 10px 14px; font-weight: 600; color: #111827;">${item.name || 'Product'}</td>
                  <td style="padding: 10px 14px; text-align: right; color: #4b5563;">GHS ${price.toFixed(2)}</td>
                  <td style="padding: 10px 14px; text-align: center; color: #4b5563;">${qty < 10 ? '0' + qty : qty}</td>
                  <td style="padding: 10px 14px; text-align: right; font-weight: 700; color: #111827;">GHS ${itemTotal.toFixed(2)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <!-- 5. Totals & Payment Method We Accept -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <!-- Left Column: Settlement & Terms -->
            <td style="width: 50%; vertical-align: top; padding-right: 18px;">
              <div style="font-size: 11px; font-weight: 800; color: #111827; margin-bottom: 6px;">
                Payment Method We Accept
              </div>
              <div style="font-size: 11px; color: #4b5563; line-height: 1.6;">
                <div><strong>Mobile Money:</strong> ${settings?.momoNetwork || 'MTN MoMo'} — ${settings?.momoNumber || '+233 54 883 4874'}</div>
                <div><strong>Account Name:</strong> ${settings?.bankAccountName || 'The Honey Palace'}</div>
                ${settings?.bankAccountNo && settings.bankAccountNo !== '1234567890123' ? `<div><strong>Bank:</strong> ${settings?.bankName || 'Bank'} (A/C: ${settings.bankAccountNo})</div>` : ''}
              </div>

              <div style="margin-top: 12px; padding: 10px 12px; background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 6px; font-size: 10px; color: #78350f; line-height: 1.5;">
                <strong>Quotation Note:</strong> ${order.notes && order.notes !== 'Draft Invoice Preview' ? order.notes : 'This Pro Forma Invoice is an official commercial price quotation and cost estimate. Prices quoted are valid for 14 calendar days from date of issue and subject to batch stock availability upon formal Purchase Order confirmation.'}
              </div>
            </td>

            <!-- Right Column: Breakdown & Filled Grand Total Bar -->
            <td style="width: 50%; vertical-align: top;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 12px; line-height: 1.8;">
                <tr>
                  <td style="color: #4b5563; font-weight: 600; width: 50%;">Sub Total:</td>
                  <td style="text-align: right; font-weight: 700; color: #111827;">GHS ${subtotal.toFixed(2)}</td>
                </tr>
                ${taxesRowsHTML}
                ${discount > 0 ? `
                <tr>
                  <td style="color: #dc2626; font-weight: 600;">Discount:</td>
                  <td style="text-align: right; font-weight: 700; color: #dc2626;">-GHS ${discount.toFixed(2)}</td>
                </tr>
                ` : ''}
                <tr>
                  <td colspan="2" style="padding-top: 8px;">
                    <div style="background-color: #ffa200; color: #000000; padding: 10px 14px; border-radius: 4px; font-weight: 900; font-size: 13px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="color: #000000; font-weight: 900;">
                        <tr>
                          <td>Grand Total</td>
                          <td style="text-align: right; font-size: 15px;">GHS ${total.toFixed(2)}</td>
                        </tr>
                      </table>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Signature Block -->
              <div style="margin-top: 24px; text-align: center; margin-left: auto; width: 220px;">
                <div style="font-family: 'Brush Script MT', 'Dancing Script', 'Caveat', cursive, sans-serif; font-size: 22px; color: #111827; line-height: 1.1; margin-bottom: 4px;">
                  The Honey Palace Africa
                </div>
                <div style="border-top: 1px solid #d1d5db; padding-top: 4px; font-size: 10px; color: #6b7280; font-weight: 700; text-transform: capitalize;">
                  Accounts Manager
                </div>
              </div>
            </td>
          </tr>
        </table>

        <!-- 6. Payment CTA Button (if online link available) -->
        ${paymentUrl ? `
          <div style="margin: 20px 0; text-align: center;">
            <a href="${paymentUrl}" target="_blank" style="display: inline-block; background-color: #ffa200; padding: 12px 28px; color: #000000; font-size: 13px; font-weight: 800; text-decoration: none; border-radius: 50px; text-transform: uppercase; letter-spacing: 0.5px;">
              Confirm Order & Pay Online (GHS ${chargeAmount.toFixed(2)})
            </a>
          </div>
        ` : ''}

        <!-- 7. Footer Section: Contact Details Left, Logo Right -->
        <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align: middle; width: 65%; font-size: 10px; color: #6b7280;">
                <div style="font-weight: 800; color: #111827; text-transform: capitalize; margin-bottom: 3px;">Contact details</div>
                <div style="line-height: 1.6;">
                  <span>${company.address}</span> &bull; <span>${company.phone}</span> &bull; <span>${company.email}</span>
                </div>
              </td>
              <td style="vertical-align: middle; text-align: right; width: 35%;">
                <img src="https://thehoneypalaceafrica.com/assets/honey-palace-logo.png" style="width: 90px; height: auto; display: inline-block;" alt="Logo" />
              </td>
            </tr>
          </table>
        </div>

      </div>
    </td>
  </tr>
</table>

</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${isProforma ? 'Pro Forma Invoice' : 'Invoice'} #${invoiceNum} - The Honey Palace Africa</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Poppins', Helvetica, Arial, sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f3f4f6; padding: 30px 10px;">
  <tr>
    <td align="center">
      <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; max-width: 680px; width: 100%; margin: auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden;">
        
        <!-- Main Body Table -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding: 30px;">
          
          <!-- Top Header Table (Left Dark Block + Right Company & Payment Details) -->
          <tr>
            <td style="padding-bottom: 25px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <tr>
                  <!-- Left Sidebar Block (Date, Due Date, Billed To) -->
                  <td style="width: 40%; background-color: #000000; color: #ffffff; padding: 24px; vertical-align: top; border-radius: 6px 0 0 6px;">
                    <div style="margin-bottom: 6px; font-size: 10px; text-transform: uppercase; color: #9ca3af; font-weight: bold; letter-spacing: 0.5px;">Date:</div>
                    <div style="font-size: 12px; margin-bottom: 16px; font-weight: 500;">${issueDateFormatted}</div>
                    
                    <div style="margin-bottom: 6px; font-size: 10px; text-transform: uppercase; color: #9ca3af; font-weight: bold; letter-spacing: 0.5px;">${isProforma ? 'Valid Until:' : 'Due Date:'}</div>
                    <div style="font-size: 12px; margin-bottom: ${isProforma && order.leadTime ? '14px' : '20px'}; font-weight: 500; color: ${isProforma ? '#ffa200' : '#ffffff'};">
                      ${isProforma 
                        ? (order.validUntil ? new Date(order.validUntil).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '14 Days from Issue')
                        : dueDateFormatted}
                    </div>

                    ${isProforma && order.leadTime ? `
                      <div style="margin-bottom: 6px; font-size: 10px; text-transform: uppercase; color: #9ca3af; font-weight: bold; letter-spacing: 0.5px;">Est. Lead Time:</div>
                      <div style="font-size: 12px; margin-bottom: 20px; font-weight: 500; color: #ffffff;">${order.leadTime}</div>
                    ` : ''}
                    
                    <div style="border-top: 1px solid #262626; margin-bottom: 18px; padding-top: 14px;">
                      <div style="margin-bottom: 6px; font-size: 10px; text-transform: uppercase; color: #9ca3af; font-weight: bold; letter-spacing: 0.5px;">${isProforma ? 'Quotation For' : 'To'}</div>
                      <div style="font-size: 14px; font-weight: bold; margin-bottom: 4px; color: #ffffff;">${order.customerName || 'Valued Customer'}</div>
                      <div style="font-size: 11px; color: #d1d5db; line-height: 1.5;">
                        ${order.customerCompany ? `<div style="font-weight: 500; margin-bottom: 2px;">${order.customerCompany}</div>` : ''}
                        ${order.customerPhone ? `<div>${order.customerPhone}</div>` : ''}
                        ${order.customerEmail ? `<div>${order.customerEmail}</div>` : ''}
                        ${order.customerAddress || order.deliveryAddress ? `<div style="margin-top: 4px;">${order.customerAddress || order.deliveryAddress}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  
                  <!-- Right Header Block (Logo, Details, Invoice Title) -->
                  <td style="width: 60%; padding-left: 28px; vertical-align: top;">
                    <!-- Company Logo -->
                    <div style="text-align: left; margin-bottom: 14px;">
                      <img src="https://thehoneypalaceafrica.com/assets/honey-palace-logo.png" style="width: 120px; height: auto; display: inline-block;" alt="The Honey Palace Logo" />
                    </div>
                    
                    <!-- Invoice Title & Status -->
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 14px;">
                      <tr>
                        <td>
                          <h1 style="font-size: 24px; font-weight: 900; color: #111827; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${isProforma ? 'PRO FORMA INVOICE' : 'INVOICE'}
                          </h1>
                          <div style="font-size: 12px; font-weight: 700; color: #ffa200; margin-top: 2px;">
                            #${invoiceNum} ${isProforma ? '• Quotation' : ''}
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Payment Details Table -->
                    <div style="font-size: 11px; color: #374151; line-height: 1.5; background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 6px; padding: 12px;">
                      <div style="font-weight: bold; color: #111827; margin-bottom: 6px; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Payment Details</div>
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 11px; color: #4b5563;">
                        <tr>
                          <td style="font-weight: bold; color: #111827; width: 95px; padding-bottom: 3px;">Account Name:</td>
                          <td style="padding-bottom: 3px;">${settings?.bankAccountName || 'The Honey Palace'}</td>
                        </tr>
                        <tr>
                          <td style="font-weight: bold; color: #111827; padding-bottom: 3px;">Mobile Money:</td>
                          <td style="padding-bottom: 3px;">${settings?.momoNumber || '+233 54 883 4874'} (${settings?.momoNetwork || 'MTN'})</td>
                        </tr>
                        ${settings?.bankAccountNo && settings.bankAccountNo !== '1234567890123' ? `
                        <tr>
                          <td style="font-weight: bold; color: #111827; padding-bottom: 3px;">Bank:</td>
                          <td style="padding-bottom: 3px;">${settings?.bankName || 'Bank'}${settings?.bankBranch ? ` (${settings.bankBranch})` : ''}</td>
                        </tr>
                        <tr>
                          <td style="font-weight: bold; color: #111827; padding-bottom: 3px;">Account No:</td>
                          <td style="padding-bottom: 3px;">${settings.bankAccountNo}</td>
                        </tr>
                        ` : ''}
                      </table>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Items Table -->
          <tr>
            <td style="padding-bottom: 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 12px;">
                <thead>
                  <tr style="background-color: #ffa200; color: #ffffff; text-align: left; font-weight: bold; font-size: 11px; text-transform: uppercase;">
                    <th style="padding: 10px 15px; width: 45%;">Item Description</th>
                    <th style="padding: 10px 15px; text-align: right; width: 20%;">Rate</th>
                    <th style="padding: 10px 15px; text-align: center; width: 15%;">Unit</th>
                    <th style="padding: 10px 15px; text-align: right; width: 20%;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRowsHTML}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Totals Summary Table -->
          <tr>
            <td style="padding-bottom: 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 12px;">
                <tr>
                  <td style="width: 50%;"></td>
                  <td style="width: 50%;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="line-height: 1.8;">
                      <tr>
                        <td style="color: #4b5563; font-weight: bold; width: 50%;">Subtotal:</td>
                        <td style="text-align: right; font-weight: bold; color: #111827;">GHS ${subtotal.toFixed(2)}</td>
                      </tr>
                      ${discount > 0 ? `
                      <tr>
                        <td style="color: #dc2626; font-weight: bold;">Discount:</td>
                        <td style="text-align: right; font-weight: bold; color: #dc2626;">-GHS ${discount.toFixed(2)}</td>
                      </tr>
                      ` : ''}
                      ${taxesRowsHTML}
                      ${deliveryFee > 0 ? `
                      <tr>
                        <td style="color: #4b5563; font-weight: bold;">Delivery Fee:</td>
                        <td style="text-align: right; font-weight: bold; color: #111827;">GHS ${deliveryFee.toFixed(2)}</td>
                      </tr>
                      ` : ''}
                      <tr style="border-top: 1px solid #d1d5db;">
                        <td style="font-weight: 900; font-size: 14px; color: #111827; padding-top: 8px;">Total:</td>
                        <td style="text-align: right; font-weight: 900; font-size: 14px; color: #111827; padding-top: 8px;">GHS ${total.toFixed(2)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Payment CTA Button -->
          ${paymentCTA}

          <!-- Footer Section (Notes & Company Contact) -->
          <tr>
            <td style="border-top: 1px solid #e5e7eb; padding-top: 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size: 10px; color: #6b7280;">
                <tr>
                  <td style="width: 50%; vertical-align: top; padding-right: 20px; line-height: 1.6;">
                    <div style="font-weight: bold; color: #111827; margin-bottom: 4px; text-transform: uppercase;">Notes:</div>
                    ${(!order.notes || order.notes === 'Draft Invoice Preview') 
                      ? 'Thank you for your business! All payments should be made within the due date.' 
                      : order.notes}
                  </td>
                  <td style="width: 50%; vertical-align: top; text-align: right; line-height: 1.8;">
                    <div style="font-weight: bold; color: #111827; margin-bottom: 4px; text-transform: uppercase;">Company Contact:</div>
                    <div style="color: #4b5563; font-weight: 500;">Phone: ${company.phone}</div>
                    <div style="color: #4b5563; font-weight: 500;">Email: <a href="mailto:${company.email}" style="color: #ffa200; text-decoration: none;">${company.email}</a></div>
                    <div style="color: #4b5563; font-weight: 500;">Website: ${company.website}</div>
                    <div style="color: #4b5563; font-weight: 500; margin-top: 2px;">${company.address}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>

      </div>
    </td>
  </tr>
</table>

</body>
</html>`;
}
