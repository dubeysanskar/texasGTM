import { NextResponse } from 'next/server';
const { queryAll, query } = require('@/lib/db');
const { getUserFromRequest, isAdmin } = require('@/lib/auth');

// GET settings
export async function GET() {
  try {
    const rows = await queryAll('SELECT key, value FROM gtm_settings');
    const settings = {};
    rows.forEach(r => { settings[r.key] = r.value; });
    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ settings: {} });
  }
}

// PUT settings (admin only)
export async function PUT(request) {
  const user = getUserFromRequest(request);
  if (!user || !isAdmin(user.role)) return NextResponse.json({ error: 'Super admin only' }, { status: 403 });

  const body = await request.json();
  const { settings } = body;
  if (!settings || typeof settings !== 'object') return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

  for (const [key, value] of Object.entries(settings)) {
    if (typeof value !== 'string' || !value.trim()) continue;
    await query(
      `INSERT INTO gtm_settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value.trim()]
    );
  }
  return NextResponse.json({ success: true });
}
