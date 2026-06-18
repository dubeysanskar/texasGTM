import { NextResponse } from 'next/server';
const { queryAll } = require('@/lib/db');
const { getUserFromRequest, isManager } = require('@/lib/auth');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || !isManager(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const members = await queryAll('SELECT id, name, email, role, company, phone, is_active, created_at FROM gtm_users ORDER BY role, name');
  return NextResponse.json({ members });
}
