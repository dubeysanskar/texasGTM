import { NextResponse } from 'next/server';
const { queryAll, queryOne, query } = require('@/lib/db');
const { getUserFromRequest } = require('@/lib/auth');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Get conversations (users I've chatted with)
  const conversations = await queryAll(`
    SELECT u.id, u.name, u.role, u.company,
      (SELECT message FROM gtm_messages WHERE (sender_id = u.id AND receiver_id = $1) OR (sender_id = $1 AND receiver_id = u.id) ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT COUNT(*) FROM gtm_messages WHERE sender_id = u.id AND receiver_id = $1 AND is_read = 0) as unread_count
    FROM gtm_users u
    WHERE u.id != $1 AND u.id IN (
      SELECT DISTINCT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END
      FROM gtm_messages WHERE sender_id = $1 OR receiver_id = $1
    )
    ORDER BY (SELECT MAX(created_at) FROM gtm_messages WHERE (sender_id = u.id AND receiver_id = $1) OR (sender_id = $1 AND receiver_id = u.id)) DESC
  `, [user.id]);

  const allUsers = await queryAll("SELECT id, name, role, company FROM gtm_users WHERE id != $1 AND is_active = 1 ORDER BY name", [user.id]);

  return NextResponse.json({ conversations, allUsers });
}

export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { receiver_id, message } = await request.json();
  if (!receiver_id || !message?.trim()) return NextResponse.json({ error: 'Receiver and message required' }, { status: 400 });

  await query('INSERT INTO gtm_messages (sender_id, receiver_id, message) VALUES ($1,$2,$3)', [user.id, receiver_id, message.trim()]);

  // Notify receiver
  await query('INSERT INTO gtm_notifications (user_id, type, title, message, entity_type) VALUES ($1,$2,$3,$4,$5)',
    [receiver_id, 'message', `New message from ${user.name}`, message.trim().substring(0, 100), 'message']);

  return NextResponse.json({ success: true });
}
