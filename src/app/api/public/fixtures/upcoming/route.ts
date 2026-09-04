import { NextRequest, NextResponse } from 'next/server';
import { UpcomingFixturesService } from '@/lib/services/upcomingFixturesService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const windowParam = searchParams.get('window') || '7days';
    const limitParam = parseInt(searchParams.get('limit') || '12', 10);
    const leagueParam = searchParams.get('league') || undefined;

    let daysAhead = 7;
    if (windowParam === 'today') daysAhead = 1;
    else if (windowParam === 'tomorrow') daysAhead = 2;
    else if (windowParam === '3days') daysAhead = 3;

    const result = await UpcomingFixturesService.getUpcomingFixtures({
      daysAhead,
      leagueCode: leagueParam,
    });

    const limit = Math.min(Math.max(1, limitParam), 100);
    const sliced = result.fixtures.slice(0, limit);

    return NextResponse.json({
      fixtures: sliced,
      totalMatchesAvailable: result.fixtures.length,
      generatedAt: result.generatedAt,
      source: result.source,
      coverage: {
        leagues: result.coverage.leagues,
        fixtures: sliced.length,
      },
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error: any) {
    console.error('[API /public/fixtures/upcoming] Error:', error);
    return NextResponse.json({
      fixtures: [],
      error: 'Upcoming fixtures feed temporarily unavailable.',
      generatedAt: new Date().toISOString(),
      source: 'api-football',
      coverage: { leagues: 0, fixtures: 0 },
    }, { status: 500 });
  }
}
