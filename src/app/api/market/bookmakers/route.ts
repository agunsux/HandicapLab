// HandicapLab Market Intelligence - Bookmakers Consensus API
// Location: src/app/api/market/bookmakers/route.ts

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const bookmakers = [
      {
        bookmaker: 'Pinnacle',
        role: 'PRIMARY_SHARP_BENCHMARK',
        sharpTier: 'TIER_1',
        weight: 0.60,
        margin: 0.024,
        marketsSupported: ['ML', 'AH', 'OU', 'BTTS'],
        description: 'Primary ground truth benchmark for Closing Line Value (CLV) evaluation.',
      },
      {
        bookmaker: 'Circa Sports',
        role: 'SECONDARY_SHARP_BENCHMARK',
        sharpTier: 'TIER_1',
        weight: 0.25,
        margin: 0.028,
        marketsSupported: ['ML', 'AH', 'OU'],
        description: 'US sharp market maker and high-limit liquidity reference.',
      },
      {
        bookmaker: 'SBOBET',
        role: 'ASIAN_HANDICAP_REFERENCE',
        sharpTier: 'TIER_2',
        weight: 0.15,
        margin: 0.032,
        marketsSupported: ['ML', 'AH', 'OU'],
        description: 'Secondary Asian handicap reference and market consensus validator.',
      }
    ];

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      governance: 'SINGLE_SOURCE_OF_TRUTH_PINNACLE_PRIMARY',
      bookmakers
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
