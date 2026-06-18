import { NextResponse } from 'next/server';
const { queryOne } = require('@/lib/db');
const { getUserFromRequest, isManager } = require('@/lib/auth');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || !isManager(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const total = await queryOne('SELECT COUNT(*) as c FROM gtm_leads');
  const hot = await queryOne("SELECT COUNT(*) as c FROM gtm_leads WHERE priority = 'HOT'");
  const warm = await queryOne("SELECT COUNT(*) as c FROM gtm_leads WHERE priority = 'WARM'");
  const contacted = await queryOne("SELECT COUNT(*) as c FROM gtm_leads WHERE status != 'not_contacted'");
  const meetings = await queryOne("SELECT COUNT(*) as c FROM gtm_leads WHERE status = 'meeting_set'");
  const won = await queryOne("SELECT COUNT(*) as c FROM gtm_leads WHERE status = 'won'");

  return NextResponse.json({
    total: parseInt(total?.c||0), hot: parseInt(hot?.c||0), warm: parseInt(warm?.c||0),
    contacted: parseInt(contacted?.c||0), meetings: parseInt(meetings?.c||0), won: parseInt(won?.c||0),
  });
}
