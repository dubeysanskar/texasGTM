import { NextResponse } from 'next/server';
const { queryAll, queryOne, query } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');

/**
 * GET /api/projects/members?project_id=X — list members of a project (admin only)
 * GET /api/projects/members?user_id=X — list projects a user belongs to (admin only)
 */
export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('project_id');
  const userId = searchParams.get('user_id');

  if (projectId) {
    const members = await queryAll(
      `SELECT pm.*, u.name as user_name, u.email as user_email, u.role as user_role, u.avatar as user_avatar
       FROM gtm_project_members pm
       JOIN gtm_users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY pm.created_at ASC`,
      [projectId]
    );
    return NextResponse.json({ members });
  }

  if (userId) {
    const projects = await queryAll(
      `SELECT pm.*, p.name as project_name, p.color as project_color, p.slug as project_slug
       FROM gtm_project_members pm
       JOIN gtm_projects p ON p.id = pm.project_id
       WHERE pm.user_id = $1 AND p.is_active = true
       ORDER BY p.name ASC`,
      [userId]
    );
    return NextResponse.json({ projects });
  }

  // All memberships
  const all = await queryAll(
    `SELECT pm.*, u.name as user_name, u.email as user_email, u.role as user_role,
            p.name as project_name, p.color as project_color
     FROM gtm_project_members pm
     JOIN gtm_users u ON u.id = pm.user_id
     JOIN gtm_projects p ON p.id = pm.project_id
     WHERE p.is_active = true
     ORDER BY p.name ASC, u.name ASC`
  );
  return NextResponse.json({ memberships: all });
}

/**
 * POST /api/projects/members — assign user to project (admin only)
 * Body: { user_id, project_id, role? }
 */
export async function POST(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { user_id, project_id, role } = await request.json();
  if (!user_id || !project_id) return NextResponse.json({ error: 'user_id and project_id required' }, { status: 400 });

  // Check user and project exist
  const targetUser = await queryOne('SELECT id, name FROM gtm_users WHERE id = $1', [user_id]);
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  const project = await queryOne('SELECT id, name FROM gtm_projects WHERE id = $1', [project_id]);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Check if already member
  const existing = await queryOne('SELECT id FROM gtm_project_members WHERE user_id = $1 AND project_id = $2', [user_id, project_id]);
  if (existing) return NextResponse.json({ error: 'User is already a member of this project' }, { status: 409 });

  const result = await query(
    'INSERT INTO gtm_project_members (user_id, project_id, role, added_by) VALUES ($1, $2, $3, $4) RETURNING *',
    [user_id, project_id, role || 'member', user.id]
  );

  return NextResponse.json(result.rows[0], { status: 201 });
}

/**
 * DELETE /api/projects/members — remove user from project (admin only)
 * Body: { user_id, project_id }
 */
export async function DELETE(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { user_id, project_id } = await request.json();
  if (!user_id || !project_id) return NextResponse.json({ error: 'user_id and project_id required' }, { status: 400 });

  await query('DELETE FROM gtm_project_members WHERE user_id = $1 AND project_id = $2', [user_id, project_id]);
  return NextResponse.json({ success: true });
}
