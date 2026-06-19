import { NextResponse } from 'next/server';
const { queryAll, queryOne, query } = require('@/lib/db');
const { getUserFromRequest, isManager, isAdmin } = require('@/lib/auth');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || !isManager(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const members = await queryAll('SELECT id, name, email, role, company, phone, is_active, created_at FROM gtm_users ORDER BY role, name');
  return NextResponse.json({ members });
}

// POST /api/team — Invite new user (super_admin only)
export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 });

  const { name, email, role } = await request.json();
  if (!name?.trim() || !email?.trim()) return NextResponse.json({ error: 'Name and email required' }, { status: 400 });

  const validRoles = ['super_admin', 'manager', 'staff', 'marketing'];
  const assignRole = validRoles.includes(role) ? role : 'staff';

  const existing = await queryOne('SELECT id FROM gtm_users WHERE email = $1', [email.toLowerCase().trim()]);
  if (existing) return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });

  // Create user with temp password (they'll use forgot-password to set their own)
  const bcrypt = require('bcryptjs');
  const tempHash = await bcrypt.hash('temp_' + Date.now(), 10);

  const res = await query(
    'INSERT INTO gtm_users (name, email, password_hash, role, is_active) VALUES ($1, $2, $3, $4, 1) RETURNING id',
    [name.trim(), email.toLowerCase().trim(), tempHash, assignRole]
  );

  // Send invite email
  try {
    const { sendMail } = require('@/lib/mailer');
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://gtm.tahaairwavescrm.cloud';
    await sendMail({
      to: email.toLowerCase().trim(),
      subject: 'TexasGTM — You have been invited',
      html: `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:40px 24px;background:#f8f9fb;border-radius:16px;">
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="font-size:1.5rem;color:#6366f1;margin:0;">TexasGTM</h1>
            <p style="color:#94a3b8;font-size:0.85rem;margin:4px 0 0;">Team Invitation</p>
          </div>
          <div style="background:#fff;border-radius:12px;padding:24px;text-align:center;border:1px solid #e2e8f0;">
            <p style="margin:0 0 8px;color:#475569;font-size:0.92rem;">Hi <strong>${name}</strong>,</p>
            <p style="margin:0 0 20px;color:#475569;font-size:0.88rem;">You've been invited to join <strong>TexasGTM CRM</strong> as <strong>${assignRole.replace('_', ' ')}</strong>.</p>
            <a href="${baseUrl}" style="display:inline-block;padding:12px 32px;background:#6366f1;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:0.92rem;">Go to TexasGTM</a>
            <p style="margin:20px 0 0;font-size:0.78rem;color:#94a3b8;">Just enter your email on the login page — you'll receive an OTP to sign in.</p>
          </div>
        </div>`,
    });
  } catch (e) {
    console.error('[invite] Email send failed:', e.message);
  }

  await query('INSERT INTO gtm_activity_logs (user_id, user_name, user_role, action, category, entity_type, entity_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [user.id, user.name, user.role, `Invited "${name}" (${email}) as ${assignRole}`, 'team', 'user', res.rows[0].id]);

  return NextResponse.json({ id: res.rows[0].id, message: 'User invited' }, { status: 201 });
}
