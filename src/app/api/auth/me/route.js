import { NextResponse } from 'next/server';
const { getUserFromRequest } = require('@/lib/auth');
const { queryOne } = require('@/lib/db');

export async function GET(request) {
  const payload = getUserFromRequest(request);
  if (!payload) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const user = await queryOne('SELECT id, name, email, role, company, phone, avatar, bio FROM gtm_users WHERE id = $1', [payload.id]);
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({ user });
}
