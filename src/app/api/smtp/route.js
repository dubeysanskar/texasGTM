import { NextResponse } from 'next/server';
const { queryAll, queryOne, query, initSchema } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');

// GET /api/smtp — list SMTP accounts (admin only). Passwords are never returned.
// Optional ?project_id=X to filter to a project + global accounts.
export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  try { await initSchema(); } catch {}

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');

  let rows;
  if (projectId) {
    rows = await queryAll(
      `SELECT s.id, s.project_id, s.label, s.host, s.port, s.secure, s.username, s.from_email, s.from_name,
              s.daily_limit, s.is_active, s.created_at, p.name AS project_name, p.color AS project_color,
              (s.password != '') AS has_password
       FROM gtm_smtp_accounts s LEFT JOIN gtm_projects p ON p.id = s.project_id
       WHERE s.project_id = $1 OR s.project_id IS NULL
       ORDER BY (s.project_id IS NULL) ASC, s.id ASC`,
      [projectId]
    );
  } else {
    rows = await queryAll(
      `SELECT s.id, s.project_id, s.label, s.host, s.port, s.secure, s.username, s.from_email, s.from_name,
              s.daily_limit, s.is_active, s.created_at, p.name AS project_name, p.color AS project_color,
              (s.password != '') AS has_password
       FROM gtm_smtp_accounts s LEFT JOIN gtm_projects p ON p.id = s.project_id
       ORDER BY s.project_id NULLS FIRST, s.id ASC`
    );
  }
  return NextResponse.json({ accounts: rows });
}

// POST /api/smtp — create an SMTP account (admin only)
export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  try { await initSchema(); } catch {}

  const b = await request.json();
  const { label, host, port, secure, username, password, from_email, from_name, daily_limit, project_id } = b;
  if (!host?.trim() || !username?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Host, username and password are required' }, { status: 400 });
  }

  const row = await query(
    `INSERT INTO gtm_smtp_accounts (project_id, label, host, port, secure, username, password, from_email, from_name, daily_limit, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [
      project_id || null,
      label || '',
      host.trim(),
      parseInt(port) || 465,
      secure !== false,
      username.trim(),
      password,
      from_email?.trim() || username.trim(),
      from_name?.trim() || '',
      parseInt(daily_limit) || 30,
      user.id,
    ]
  );
  return NextResponse.json({ id: row.rows[0].id, success: true }, { status: 201 });
}

// PUT /api/smtp — update an SMTP account (admin only). Password only changes if provided.
export async function PUT(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const b = await request.json();
  const { id } = b;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const fields = [];
  const vals = [];
  const set = (col, val) => { vals.push(val); fields.push(`${col} = $${vals.length}`); };

  if (b.label !== undefined) set('label', b.label);
  if (b.host !== undefined) set('host', b.host.trim());
  if (b.port !== undefined) set('port', parseInt(b.port) || 465);
  if (b.secure !== undefined) set('secure', !!b.secure);
  if (b.username !== undefined) set('username', b.username.trim());
  if (b.password) set('password', b.password); // only overwrite when a new one is given
  if (b.from_email !== undefined) set('from_email', b.from_email.trim());
  if (b.from_name !== undefined) set('from_name', b.from_name.trim());
  if (b.daily_limit !== undefined) set('daily_limit', parseInt(b.daily_limit) || 30);
  if (b.is_active !== undefined) set('is_active', !!b.is_active);
  if (b.project_id !== undefined) set('project_id', b.project_id || null);

  if (!fields.length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  vals.push(id);
  await query(`UPDATE gtm_smtp_accounts SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals);
  return NextResponse.json({ success: true });
}

// DELETE /api/smtp — remove an SMTP account (admin only)
export async function DELETE(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('DELETE FROM gtm_smtp_accounts WHERE id = $1', [id]);
  return NextResponse.json({ success: true });
}
