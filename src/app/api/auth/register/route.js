import { NextResponse } from 'next/server';
const bcrypt = require('bcryptjs');
const { query, queryOne, initSchema } = require('@/lib/db');
const { signToken } = require('@/lib/auth');

export async function POST(request) {
  try { await initSchema(); } catch {}

  const { name, email, password, role } = await request.json();
  if (!name || !email || !password) return NextResponse.json({ error: 'Name, email, password required' }, { status: 400 });

  const existing = await queryOne('SELECT id FROM gtm_users WHERE email = $1', [email.toLowerCase().trim()]);
  if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    'INSERT INTO gtm_users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
    [name.trim(), email.toLowerCase().trim(), hash, role || 'staff']
  );

  const userId = result.rows[0].id;
  const userData = { id: userId, name: name.trim(), email: email.toLowerCase().trim(), role: role || 'staff' };
  const token = signToken(userData);

  const res = NextResponse.json({ user: userData });
  res.cookies.set('gtm-token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60, path: '/' });
  return res;
}
