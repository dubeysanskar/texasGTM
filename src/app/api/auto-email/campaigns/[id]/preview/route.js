import { NextResponse } from 'next/server';
const { getUserFromRequest, isAdmin } = require('@/lib/auth');
const { previewEmail } = require('@/lib/auto-email-worker');

export async function POST(request, { params }) {
  const user = getUserFromRequest(request);
  if (!user || (!isAdmin(user.role) && user.role !== 'marketing'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { lead_id } = await request.json();

  if (!lead_id) return NextResponse.json({ error: 'lead_id required' }, { status: 400 });

  try {
    const preview = await previewEmail(parseInt(id), parseInt(lead_id));
    return NextResponse.json(preview);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
