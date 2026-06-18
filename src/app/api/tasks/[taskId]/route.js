import { NextResponse } from 'next/server';
const { queryAll, queryOne, query } = require('@/lib/db');
const { getUserFromRequest } = require('@/lib/auth');

// GET task detail + comments + status history
export async function GET(request, { params }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { taskId } = await params;

  const task = await queryOne(`
    SELECT t.*, COALESCE(u.name, '—') as assigned_to_name
    FROM gtm_tasks t LEFT JOIN gtm_users u ON t.assigned_to = u.id
    WHERE t.id = $1
  `, [taskId]);
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const comments = await queryAll(
    'SELECT * FROM gtm_task_comments WHERE task_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC',
    [taskId]
  );

  const status_history = await queryAll(
    'SELECT * FROM gtm_task_status_history WHERE task_id = $1 ORDER BY changed_at DESC',
    [taskId]
  );

  return NextResponse.json({ task, comments, status_history });
}

// POST — add comment
export async function POST(request, { params }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { taskId } = await params;
  const { message } = await request.json();
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 });

  await query(
    'INSERT INTO gtm_task_comments (task_id, user_id, user_name, user_role, message) VALUES ($1,$2,$3,$4,$5)',
    [taskId, user.id, user.name, user.role, message.trim()]
  );

  // Notify task creator/assignee
  const task = await queryOne('SELECT * FROM gtm_tasks WHERE id = $1', [taskId]);
  if (task) {
    const notifyIds = new Set();
    if (task.assigned_by && task.assigned_by !== user.id) notifyIds.add(task.assigned_by);
    if (task.assigned_to && task.assigned_to !== user.id) notifyIds.add(task.assigned_to);
    for (const uid of notifyIds) {
      await query('INSERT INTO gtm_notifications (user_id, type, title, message, entity_type, entity_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [uid, 'task', `Comment on "${task.title}"`, `${user.name}: ${message.trim().substring(0, 80)}`, 'task', taskId]);
    }
  }

  return NextResponse.json({ success: true });
}

// PUT — edit comment
export async function PUT(request, { params }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { comment_id, message } = await request.json();
  if (!comment_id || !message?.trim()) return NextResponse.json({ error: 'Comment ID and message required' }, { status: 400 });

  const comment = await queryOne('SELECT * FROM gtm_task_comments WHERE id = $1', [comment_id]);
  if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (comment.user_id !== user.id && user.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await query('UPDATE gtm_task_comments SET message = $1, edited_at = NOW() WHERE id = $2', [message.trim(), comment_id]);
  return NextResponse.json({ success: true });
}

// DELETE — soft delete comment
export async function DELETE(request, { params }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const commentId = searchParams.get('comment_id');
  const { taskId } = await params;

  if (commentId) {
    const comment = await queryOne('SELECT * FROM gtm_task_comments WHERE id = $1', [commentId]);
    if (!comment) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (comment.user_id !== user.id && user.role !== 'super_admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await query('UPDATE gtm_task_comments SET deleted_at = NOW() WHERE id = $1', [commentId]);
  } else {
    // Delete the entire task
    await query('DELETE FROM gtm_tasks WHERE id = $1', [taskId]);
  }

  return NextResponse.json({ success: true });
}
