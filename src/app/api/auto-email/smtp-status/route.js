import { NextResponse } from 'next/server';
const { getUserFromRequest, isAdmin } = require('@/lib/auth');
const { getRotationStatus, getTotalRemainingToday } = require('@/lib/mailer');

export async function GET(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role))
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id') || null;
    const accounts = await getRotationStatus(projectId);
    const totalRemaining = await getTotalRemainingToday(projectId);

    return NextResponse.json({
      accounts,
      totalRemaining,
      totalAccounts: accounts.length,
      summary: {
        totalSentToday: accounts.reduce((s, a) => s + a.sentToday, 0),
        totalDailyLimit: accounts.reduce((s, a) => s + a.dailyLimit, 0),
        exhaustedAccounts: accounts.filter(a => a.exhausted).length,
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
