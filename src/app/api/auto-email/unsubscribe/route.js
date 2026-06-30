import { NextResponse } from 'next/server';
const { queryOne, query } = require('@/lib/db');

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sendId = searchParams.get('sid');

  let email = '';
  let companyName = '';

  if (sendId && sendId !== 'preview') {
    try {
      const send = await queryOne(
        'SELECT s.to_email, l.company_name FROM gtm_email_sends s LEFT JOIN gtm_leads l ON s.lead_id = l.id WHERE s.id = $1',
        [sendId]
      );
      email = send?.to_email || '';
      companyName = send?.company_name || '';
    } catch {}
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Unsubscribe</title>
  <style>
    body { font-family: 'Inter', Arial, sans-serif; background: #f8f9fb; margin: 0; padding: 40px 20px; color: #1e293b; }
    .container { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); text-align: center; }
    h1 { font-size: 1.3rem; margin-bottom: 8px; }
    p { font-size: 0.88rem; color: #64748b; line-height: 1.6; }
    .email { font-weight: 700; color: #1e293b; }
    form { margin-top: 24px; }
    button { background: #ef4444; color: #fff; border: none; padding: 12px 32px; border-radius: 10px; font-size: 0.88rem; font-weight: 600; cursor: pointer; }
    button:hover { background: #dc2626; }
    .done { color: #10b981; font-weight: 600; font-size: 0.92rem; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Unsubscribe</h1>
    <p>You are unsubscribing <span class="email">${email}</span> from future emails.</p>
    <form method="POST" action="/api/auto-email/unsubscribe">
      <input type="hidden" name="sid" value="${sendId || ''}" />
      <input type="hidden" name="email" value="${email}" />
      <button type="submit">Confirm Unsubscribe</button>
    </form>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function POST(request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let email = '';
    let sendId = '';

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      const formData = new URLSearchParams(text);
      email = formData.get('email') || '';
      sendId = formData.get('sid') || '';
    } else {
      const body = await request.json();
      email = body.email || '';
      sendId = body.sid || '';
    }

    if (!email && sendId) {
      const send = await queryOne('SELECT to_email FROM gtm_email_sends WHERE id = $1', [sendId]);
      email = send?.to_email || '';
    }

    if (!email) {
      return new NextResponse('<html><body><div style="text-align:center;padding:60px;font-family:Arial;"><h2>Error</h2><p>No email address found.</p></div></body></html>', {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Add to unsubscribe list
    await query(
      'INSERT INTO gtm_email_unsubscribes (email, reason) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING',
      [email.toLowerCase(), 'user_unsubscribed']
    );

    // Update send record
    if (sendId && sendId !== 'preview') {
      await query(
        "UPDATE gtm_email_sends SET status = 'unsubscribed' WHERE id = $1",
        [sendId]
      );
      // Update campaign counter
      const send = await queryOne('SELECT campaign_id FROM gtm_email_sends WHERE id = $1', [sendId]);
      if (send?.campaign_id) {
        await query(
          'UPDATE gtm_email_campaigns SET total_unsubscribed = total_unsubscribed + 1 WHERE id = $1',
          [send.campaign_id]
        );
      }
    }

    const confirmHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="font-family:'Inter',Arial,sans-serif;background:#f8f9fb;margin:0;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px;box-shadow:0 4px 16px rgba(0,0,0,0.08);text-align:center;">
    <div style="font-size:2rem;margin-bottom:12px;">✓</div>
    <h1 style="font-size:1.2rem;margin-bottom:8px;color:#10b981;">Successfully Unsubscribed</h1>
    <p style="font-size:0.85rem;color:#64748b;">${email} has been removed from our mailing list. You won't receive any more emails from us.</p>
  </div>
</body>
</html>`;

    return new NextResponse(confirmHtml, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    return new NextResponse('<html><body><div style="text-align:center;padding:60px;font-family:Arial;"><h2>Error</h2><p>Something went wrong. Please try again.</p></div></body></html>', {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
