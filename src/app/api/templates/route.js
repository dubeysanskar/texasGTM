import { NextResponse } from 'next/server';
const { queryAll, query } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');

  let sql = 'SELECT * FROM gtm_templates';
  const params = [];
  if (platform) { sql += ' WHERE platform = $1'; params.push(platform); }
  sql += ' ORDER BY created_at DESC';

  const templates = await queryAll(sql, params);
  return NextResponse.json(templates);
}

export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { name, platform, status, subject, body, language, translations } = await request.json();
  if (!name || !body) return NextResponse.json({ error: 'Name and body are required' }, { status: 400 });

  const res = await query(
    'INSERT INTO gtm_templates (name, platform, status, subject, body, language, translations, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [name, platform || 'email', status || 'active', subject || '', body, language || 'en', JSON.stringify(translations || {}), user.id]
  );

  return NextResponse.json(res.rows[0], { status: 201 });
}
