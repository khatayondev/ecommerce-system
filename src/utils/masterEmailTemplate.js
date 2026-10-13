export function buildMasterEmailHTML({
  preheaderText = 'The Honey Palace Africa Notification',
  title = 'The Honey Palace Africa',
  subtitle = 'Pure apicultural varieties with complete transparency',
  bodyContent = '',
  ctaLink = null,
  ctaLabel = 'Visit Website ↗'
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>${title} - The Honey Palace Africa</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: light; }
  @media (prefers-color-scheme: dark) {
    body, table, td, p, a, span { color-scheme: light !important; }
  }
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: #e9eaec; }

  @media screen and (max-width: 480px) {
    .email-wrapper { width: 100% !important; max-width: 100% !important; border-radius: 0 !important; }
    .px-body { padding-left: 20px !important; padding-right: 20px !important; }
    .hero-title { font-size: 20px !important; }
    .hero-pad { padding: 30px 20px 34px 20px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#e9eaec; font-family:'Poppins', Helvetica, Arial, sans-serif;">

  <!-- Preheader -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
    ${preheaderText} &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#e9eaec; padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="email-wrapper" style="width:600px; max-width:600px; background-color:#ffffff; border-radius:6px; overflow:hidden;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:28px 24px 20px 24px;">
              <img src="https://thehoneypalaceafrica.com/assets/honey-palace-logo.png" width="150" height="48" alt="The Honey Palace Africa" style="height:48px; width:150px; max-width:150px; display:block; border:0; outline:none;" />
            </td>
          </tr>

          <!-- Black Title Section -->
          <tr>
            <td class="hero-pad" style="background-color:#141006; padding:36px 32px 40px 32px;" align="center">
              <p class="hero-title" style="color:#ffffff; font-size:24px; font-weight:800; margin:0 0 10px 0; font-family:'Poppins', sans-serif; line-height:1.3;">
                ${title}
              </p>
              ${subtitle ? `
              <p style="color:#a9b0ac; font-size:13px; line-height:1.6; margin:0 auto; max-width:380px; font-family:'Poppins', sans-serif;">
                ${subtitle}
              </p>
              ` : ''}
            </td>
          </tr>

          <!-- White Body Section -->
          <tr>
            <td class="px-body" style="padding:32px 32px 12px 32px; background-color:#ffffff;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:14px; color:#333333; line-height:1.7; font-family:'Poppins', Helvetica, Arial, sans-serif;">

                    ${bodyContent}

                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button (optional — omit block if not provided) -->
          ${ctaLink ? `
          <tr>
            <td align="center" style="padding:16px 28px 36px 28px;">
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center" style="background-color:#ffa200; border-radius:50px;">
                    <a href="${ctaLink}" style="display:block; padding:14px 28px; color:#141006; font-size:13px; font-weight:700; text-decoration:none; text-transform:uppercase; letter-spacing:0.5px; font-family:'Poppins', sans-serif;">${ctaLabel}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding:20px 28px 28px 28px; background-color:#f9fafb; border-top:1px solid #eceeef; text-align:center;">
              <p style="font-size:11px; color:#9ca3af; margin:0; font-family:'Poppins', sans-serif;">Inside GreenField Estate, Amrahia - Accra, Ghana</p>
              <p style="font-size:11px; color:#9ca3af; margin-top:4px; font-family:'Poppins', sans-serif;">
                Call: <a href="tel:+233502606270" style="color:#ffa200; text-decoration:underline;">+233 50 260 6270</a>
                &nbsp;&bull;&nbsp;
                Web: <a href="https://thehoneypalaceafrica.com" style="color:#ffa200; text-decoration:underline;">thehoneypalaceafrica.com</a>
              </p>
              <p style="font-size:11px; color:#9ca3af; margin-top:6px; font-family:'Poppins', sans-serif;">
                Email: <a href="mailto:purchases@thehoneypalaceafrica.com" style="color:#ffa200; text-decoration:underline;">purchases@thehoneypalaceafrica.com</a>
              </p>
              <p style="font-size:10px; color:#c1c5cb; margin-top:14px; font-family:'Poppins', sans-serif;">
                © 2026 The Honey Palace Africa Ltd. All rights reserved.
              </p>
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
