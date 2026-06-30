import { NextResponse } from 'next/server';
const { queryAll, queryOne } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || (!isAdmin(user.role) && user.role !== 'marketing'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const campaignId = searchParams.get('campaign_id');
  const status = searchParams.get('status');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = (page - 1) * limit;

  let sql = `
    SELECT s.*, l.company_name, l.domain, l.sector, l.city
    FROM gtm_email_sends s
    LEFT JOIN gtm_leads l ON s.lead_id = l.id
    WHERE 1=1
  `;
  const params = [];

  if (campaignId) {
    params.push(campaignId);
    sql += ` AND s.campaign_id = $${params.length}`;
  }
  if (status) {
    params.push(status);
    sql += ` AND s.status = $${params.length}`;
  }

  // Count
  const countSql = sql.replace(/SELECT s\.\*, l\.company_name, l\.domain, l\.sector, l\.city/, 'SELECT COUNT(*) as c');
  const countRes = await queryOne(countSql, params);
  const total = parseInt(countRes?.c || 0);

  sql += ' ORDER BY s.created_at DESC';
  params.push(limit); sql += ` LIMIT $${params.length}`;
  params.push(offset); sql += ` OFFSET $${params.length}`;

  const sends = await queryAll(sql, params);

  return NextResponse.json({
    sends,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
