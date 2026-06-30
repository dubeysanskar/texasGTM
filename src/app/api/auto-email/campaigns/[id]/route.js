import { NextResponse } from 'next/server';
const { queryOne, queryAll, query } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');

export async function GET(request, { params }) {
  const user = getUserFromRequest(request);
  if (!user || (!isAdmin(user.role) && user.role !== 'marketing'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const campaign = await queryOne(`
    SELECT c.*, t.name as template_name, t.platform as template_platform
    FROM gtm_email_campaigns c
    LEFT JOIN gtm_templates t ON c.template_id = t.id
    WHERE c.id = $1
  `, [id]);

  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Get send breakdown
  const statusCounts = await queryAll(
    'SELECT status, COUNT(*) as count FROM gtm_email_sends WHERE campaign_id = $1 GROUP BY status',
    [id]
  );

  return NextResponse.json({ ...campaign, send_breakdown: statusCounts });
}

export async function PUT(request, { params }) {
  const user = getUserFromRequest(request);
  if (!user || (!isAdmin(user.role) && user.role !== 'marketing'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const fields = [];
  const values = [];
  let idx = 1;

  ['name', 'status', 'template_id', 'language', 'daily_limit', 'send_window_start', 'send_window_end'].forEach(f => {
    if (body[f] !== undefined) { fields.push(`${f} = $${idx}`); values.push(body[f]); idx++; }
  });

  if (body.llm_personalize !== undefined) {
    fields.push(`llm_personalize = $${idx}`); values.push(body.llm_personalize); idx++;
  }

  if (body.filters !== undefined) {
    fields.push(`filters = $${idx}`); values.push(JSON.stringify(body.filters)); idx++;
  }

  fields.push('updated_at = NOW()');
  values.push(id);

  const res = await query(
    `UPDATE gtm_email_campaigns SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (!res.rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(res.rows[0]);
}

export async function DELETE(request, { params }) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role))
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { id } = await params;

  // Delete sends first, then campaign
  await query('DELETE FROM gtm_email_sends WHERE campaign_id = $1', [id]);
  await query('DELETE FROM gtm_email_campaigns WHERE id = $1', [id]);

  await query(
    'INSERT INTO gtm_activity_logs (user_id, user_name, user_role, action, category, entity_type, entity_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [user.id, user.name, user.role, `Deleted auto-email campaign #${id}`, 'auto_email', 'campaign', id]
  );

  return NextResponse.json({ ok: true });
}
