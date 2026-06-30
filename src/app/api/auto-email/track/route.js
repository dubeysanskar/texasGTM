import { NextResponse } from 'next/server';
const { recordOpen } = require('@/lib/auto-email');

// 1x1 transparent PNG
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const sendId = searchParams.get('sid');

  if (sendId && sendId !== 'preview') {
    try {
      await recordOpen(parseInt(sendId));
    } catch (err) {
      console.error('[track] Failed to record open:', err.message);
    }
  }

  return new NextResponse(PIXEL, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': PIXEL.length.toString(),
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  });
}
