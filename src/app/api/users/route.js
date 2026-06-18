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
  const { name, email, password, role } = await request.json();
  if (!name || !email || !password) return NextResponse.json({ error: 'Name, email, password required' }, { status: 400 });
  const existing = await queryOne('SELECT id FROM gtm_users WHERE email = $1', [email.toLowerCase().trim()]);
  if (existing) return NextResponse.json({ error: 'Email already exists' }, { status: 409 });
  const hash = await bcrypt.hash(password, 10);
  await query('INSERT INTO gtm_users (name, email, password_hash, role) VALUES ($1,$2,$3,$4)', [name.trim(), email.toLowerCase().trim(), hash, role || 'staff']);
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
