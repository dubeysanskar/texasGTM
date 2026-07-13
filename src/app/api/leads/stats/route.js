import { NextResponse } from 'next/server';
const { queryOne } = require('@/lib/db');
const { getUserFromRequest, isManager } = require('@/lib/auth');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || !isManager(user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const pid = searchParams.get('project_id');
  const pf = pid ? ' AND project_id = ' + parseInt(pid) : '';

  const total = await queryOne(`SELECT COUNT(*) as c FROM gtm_leads WHERE 1=1${pf}`);
  const hot = await queryOne(`SELECT COUNT(*) as c FROM gtm_leads WHERE priority = 'HOT'${pf}`);
  const high = await queryOne(`SELECT COUNT(*) as c FROM gtm_leads WHERE priority = 'HIGH'${pf}`);
  const active = await queryOne(`SELECT COUNT(*) as c FROM gtm_leads WHERE status NOT IN ('not_contacted','not_interested')${pf}`);
  const signed = await queryOne(`SELECT COUNT(*) as c FROM gtm_leads WHERE status = 'contract_signed'${pf}`);
  const partner = await queryOne(`SELECT COUNT(*) as c FROM gtm_leads WHERE priority = 'PARTNER'${pf}`);

  return NextResponse.json({
    total: parseInt(total?.c||0), hot: parseInt(hot?.c||0), high: parseInt(high?.c||0),
    active: parseInt(active?.c||0), signed: parseInt(signed?.c||0), partner: parseInt(partner?.c||0),
  });
}
