import { NextResponse } from 'next/server';
const { queryAll, query } = require('@/lib/db');
const { getUserFromRequest } = require('@/lib/auth');

export async function GET(request, { params }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = await params;
  const messages = await queryAll(
    `SELECT m.*, u.name as sender_name, u.role as sender_role
     FROM gtm_messages m JOIN gtm_users u ON m.sender_id = u.id
     WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
     ORDER BY m.created_at ASC`,
    [user.id, userId]
  );

  // Mark as read
  await query('UPDATE gtm_messages SET is_read = 1 WHERE sender_id = $1 AND receiver_id = $2 AND is_read = 0', [userId, user.id]);

  return NextResponse.json({ messages });
}
