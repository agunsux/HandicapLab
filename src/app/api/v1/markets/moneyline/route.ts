import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      status: 'DEPRECATED',
      error: 'MARKET_DEPRECATED',
      message: 'Moneyline (1X2) is deprecated and removed from production. Supported markets: AH, OU, BTTS.',
      canonicalMarkets: ['AH', 'OU', 'BTTS'],
      supportedMarkets: ['AH', 'OU', 'BTTS']
    },
    { status: 410 }
  );
}
