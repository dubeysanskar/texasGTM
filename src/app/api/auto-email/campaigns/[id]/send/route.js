import { NextResponse } from 'next/server';
const { getUserFromRequest, isAdmin } = require('@/lib/auth');
const { processCampaign } = require('@/lib/auto-email-worker');

export async function POST(request, { params }) {
  const user = getUserFromRequest(request);
  if (!user || (!isAdmin(user.role) && user.role !== 'marketing'))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  try {
    // Process campaign (this runs synchronously for now; at scale, use a queue)
    const result = await processCampaign(parseInt(id));
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
