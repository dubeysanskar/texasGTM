import { NextResponse } from 'next/server';
const { queryAll, queryOne, query } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');
const { countEligibleLeads } = require('@/lib/auto-email');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || (!isAdmin(user.role) && user.role !== 'marketing'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const campaigns = await queryAll(`
    SELECT c.*, t.name as template_name, t.platform as template_platform
    FROM gtm_email_campaigns c
    LEFT JOIN gtm_templates t ON c.template_id = t.id
    ORDER BY c.created_at DESC
  `);

  return NextResponse.json(campaigns);
}

export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || (!isAdmin(user.role) && user.role !== 'marketing'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  if (!body.name?.trim()) return NextResponse.json({ error: 'Campaign name required' }, { status: 400 });

  const filters = body.filters || {};
  const leadCount = await countEligibleLeads(filters);

  const res = await query(
    `INSERT INTO gtm_email_campaigns (name, template_id, language, filters, llm_personalize, daily_limit, send_window_start, send_window_end, total_leads, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [
      body.name.trim(),
      body.template_id || null,
      body.language || 'en',
      JSON.stringify(filters),
      body.llm_personalize !== false,
      body.daily_limit || 50,
      body.send_window_start || '09:00',
      body.send_window_end || '18:00',
      leadCount,
      user.id,
    ]
  );

  await query(
    'INSERT INTO gtm_activity_logs (user_id, user_name, user_role, action, category, entity_type, entity_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [user.id, user.name, user.role, `Created auto-email campaign "${body.name}"`, 'auto_email', 'campaign', res.rows[0].id]
  );

  return NextResponse.json(res.rows[0], { status: 201 });
}
