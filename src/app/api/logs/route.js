import { NextResponse } from 'next/server';
const { queryAll } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const logs = await queryAll('SELECT * FROM gtm_activity_logs ORDER BY created_at DESC LIMIT 100');
  return NextResponse.json({ logs });
}
