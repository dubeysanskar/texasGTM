import { NextResponse } from 'next/server';
const { queryAll, queryOne, query } = require('@/lib/db');
const { getUserFromRequest, isManager } = require('@/lib/auth');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || !isManager(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  let sql = 'SELECT * FROM gtm_leads WHERE 1=1';
  const params = [];
  const status = searchParams.get('status'); if (status) { params.push(status); sql += ` AND status = $${params.length}`; }
  const priority = searchParams.get('priority'); if (priority) { params.push(priority); sql += ` AND priority = $${params.length}`; }
  const sector = searchParams.get('sector'); if (sector) { params.push(sector); sql += ` AND sector = $${params.length}`; }
  const search = searchParams.get('search'); if (search) { params.push(`%${search}%`); sql += ` AND (company_name ILIKE $${params.length} OR city ILIKE $${params.length} OR email ILIKE $${params.length})`; }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  const leads = await queryAll(sql, params);
  return NextResponse.json({ leads });
}

export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || !isManager(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await request.json();
  if (!b.company_name?.trim()) return NextResponse.json({ error: 'Company name required' }, { status: 400 });
  const dedup = `${b.company_name.trim().toLowerCase()}_${(b.city||'').toLowerCase()}`;
  const existing = await queryOne('SELECT id FROM gtm_leads WHERE dedup_key = $1', [dedup]);
  if (existing) return NextResponse.json({ error: 'Duplicate lead' }, { status: 409 });

  const result = await query(
    `INSERT INTO gtm_leads (company_name,domain,sector,priority,status,city,region,country,company_size,pain_point,decision_maker_title,phone,email,contact_method,source_url,find_instructions,notes,dedup_key,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
    [b.company_name.trim(),b.domain||'',b.sector||'other',b.priority||'MEDIUM',b.status||'not_contacted',b.city||'',b.region||'',b.country||'',b.company_size||'',b.pain_point||'',b.decision_maker_title||'',b.phone||'',b.email||'',b.contact_method||'',b.source_url||'',b.find_instructions||'',b.notes||'',dedup,user.id]
  );
  // Activity log
  await query('INSERT INTO gtm_activity_logs (user_id, user_name, user_role, action, category, entity_type, entity_id) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [user.id, user.name, user.role, `Added lead "${b.company_name}"`, 'lead', 'lead', result.rows[0].id]);

  return NextResponse.json({ id: result.rows[0].id });
}
