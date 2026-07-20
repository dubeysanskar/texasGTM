import { NextResponse } from 'next/server';
const { queryOne } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');
const { sendTestMail } = require('@/lib/mailer');

// POST /api/smtp/test — send a test email (admin only).
// Body: either { id, to } to test a saved account, or full { host, username, password, ... , to } for an unsaved one.
export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const b = await request.json();
  const to = b.to?.trim() || user.email;
  if (!to) return NextResponse.json({ error: 'Recipient email required' }, { status: 400 });

  let config = b;
  if (b.id) {
    const acc = await queryOne('SELECT * FROM gtm_smtp_accounts WHERE id = $1', [b.id]);
    if (!acc) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    config = acc;
  }

  if (!config.host || !config.username || !config.password) {
    return NextResponse.json({ error: 'Host, username and password are required to test' }, { status: 400 });
  }

  try {
    const result = await sendTestMail(config, to);
    return NextResponse.json({ success: true, to, from: result.from, messageId: result.messageId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
