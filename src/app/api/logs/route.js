import { NextResponse } from 'next/server';
const { queryAll } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');

export async function GET(request) {
  const user = getUserFromRequest(request);
  const { searchParams } = new URL(request.url);
  const pid = searchParams.get('project_id');
  const pf = pid ? ` WHERE project_id = ${parseInt(pid)}` : '';
  const logs = await queryAll(`SELECT * FROM gtm_activity_logs${pf} ORDER BY created_at DESC LIMIT 100`);
  return NextResponse.json({ logs });
}
