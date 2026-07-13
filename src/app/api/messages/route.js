import { NextResponse } from 'next/server';
const { queryAll, queryOne, query } = require('@/lib/db');
const { getUserFromRequest } = require('@/lib/auth');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const pid = searchParams.get('project_id');
  const pf = pid ? ` AND m.project_id = ${parseInt(pid)}` : '';
  const pf2 = pid ? ` AND project_id = ${parseInt(pid)}` : '';

  // Get conversations (users I've chatted with)
  const conversations = await queryAll(`
    SELECT u.id, u.name, u.role, u.company,
      (SELECT message FROM gtm_messages m WHERE ((m.sender_id = u.id AND m.receiver_id = $1) OR (m.sender_id = $1 AND m.receiver_id = u.id))${pf} ORDER BY m.created_at DESC LIMIT 1) as last_message,
      (SELECT COUNT(*) FROM gtm_messages m WHERE m.sender_id = u.id AND m.receiver_id = $1 AND m.is_read = 0${pf}) as unread_count
    FROM gtm_users u
    WHERE u.id != $1 AND u.id IN (
      SELECT DISTINCT CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END
      FROM gtm_messages WHERE (sender_id = $1 OR receiver_id = $1)${pf2}
    )
    ORDER BY (SELECT MAX(m.created_at) FROM gtm_messages m WHERE ((m.sender_id = u.id AND m.receiver_id = $1) OR (m.sender_id = $1 AND m.receiver_id = u.id))${pf}) DESC
  `, [user.id]);

  const allUsers = await queryAll("SELECT id, name, role, company FROM gtm_users WHERE id != $1 AND is_active = 1 ORDER BY name", [user.id]);

  return NextResponse.json({ conversations, allUsers });
}

export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { receiver_id, message, project_id } = await request.json();
  if (!receiver_id || !message?.trim()) return NextResponse.json({ error: 'Receiver and message required' }, { status: 400 });

  await query('INSERT INTO gtm_messages (sender_id, receiver_id, message, project_id) VALUES ($1,$2,$3,$4)', [user.id, receiver_id, message.trim(), project_id || null]);

  // Notify receiver
  await query('INSERT INTO gtm_notifications (user_id, type, title, message, entity_type) VALUES ($1,$2,$3,$4,$5)',
    [receiver_id, 'message', `New message from ${user.name}`, message.trim().substring(0, 100), 'message']);

  return NextResponse.json({ success: true });
}
