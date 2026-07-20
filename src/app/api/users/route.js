import { NextResponse } from 'next/server';
const bcrypt = require('bcryptjs');
const { queryAll, queryOne, query } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const users = await queryAll('SELECT id, name, email, role, company, phone, is_active, created_at FROM gtm_users ORDER BY created_at DESC');
  return NextResponse.json({ users });
}

export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name, email, password, role, project_id, project_ids, project_role } = await request.json();
  if (!name || !email || !password) return NextResponse.json({ error: 'Name, email, password required' }, { status: 400 });
  const finalRole = role || 'staff';
  // Accept either a single project_id or an array of project_ids
  const ids = [...new Set((Array.isArray(project_ids) ? project_ids : [project_id]).map(Number).filter(Boolean))];
  // Non-super-admins must be mapped to at least one project; super admins have access to all projects
  if (finalRole !== 'super_admin' && !ids.length) return NextResponse.json({ error: 'Please assign at least one project (required for all roles except Super Admin)' }, { status: 400 });
  const existing = await queryOne('SELECT id FROM gtm_users WHERE email = $1', [email.toLowerCase().trim()]);
  if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  const hash = await bcrypt.hash(password, 10);
  const result = await query('INSERT INTO gtm_users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id', [name.trim(), email.toLowerCase().trim(), hash, finalRole]);
  if (finalRole !== 'super_admin') {
    for (const pid of ids) {
      const project = await queryOne('SELECT id FROM gtm_projects WHERE id = $1 AND is_active = true', [pid]);
      if (project) {
        await query(
          'INSERT INTO gtm_project_members (user_id, project_id, role, added_by) VALUES ($1,$2,$3,$4) ON CONFLICT (user_id, project_id) DO NOTHING',
          [result.rows[0].id, project.id, project_role || 'member', user.id]
        );
      }
    }
  }
  return NextResponse.json({ success: true });
}

export async function PUT(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, name, role, is_active, password } = await request.json();
  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });
  const updates = []; const vals = [];
  if (name) { vals.push(name); updates.push(`name = $${vals.length}`); }
  if (role) { vals.push(role); updates.push(`role = $${vals.length}`); }
  if (is_active !== undefined) { vals.push(is_active ? 1 : 0); updates.push(`is_active = $${vals.length}`); }
  if (password) { const h = await bcrypt.hash(password, 10); vals.push(h); updates.push(`password_hash = $${vals.length}`); }
  if (updates.length) { vals.push(id); await query(`UPDATE gtm_users SET ${updates.join(',')} WHERE id = $${vals.length}`, vals); }
  return NextResponse.json({ success: true });
}
