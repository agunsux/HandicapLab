import { NextResponse } from 'next/server';
import { generatePremierLeagueAhResearch } from '@/lib/research/premierLeagueAhEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // Cache 5 minutes

export async function GET() {
  try {
    const payload = generatePremierLeagueAhResearch();
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error: any) {
    console.error('[API /api/research/premier-league/ah] Execution Error:', error);
    return NextResponse.json(
      {
        status: 'INSUFFICIENT_DATA',
        error: error.message || 'Failed to process Premier League Asian Handicap research.',
      },
      { status: 500 }
    );
  }
}
