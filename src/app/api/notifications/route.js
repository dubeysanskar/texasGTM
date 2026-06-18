import { NextResponse } from 'next/server';
const { queryAll, queryOne, query } = require('@/lib/db');
const { getUserFromRequest } = require('@/lib/auth');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  if (searchParams.get('count_only')) {
    const row = await queryOne('SELECT COUNT(*) as unread FROM gtm_notifications WHERE user_id = $1 AND is_read = 0', [user.id]);
    return NextResponse.json({ unread: parseInt(row?.unread || 0) });
  }

  const notifications = await queryAll(
    'SELECT * FROM gtm_notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30', [user.id]
  );
  return NextResponse.json({ notifications });
}

export async function PUT(request) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  if (body.all) {
    await query('UPDATE gtm_notifications SET is_read = 1 WHERE user_id = $1', [user.id]);
  } else if (body.id) {
    await query('UPDATE gtm_notifications SET is_read = 1 WHERE id = $1 AND user_id = $2', [body.id, user.id]);
  }
  return NextResponse.json({ success: true });
}
