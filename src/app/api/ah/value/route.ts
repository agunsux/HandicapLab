import { NextRequest, NextResponse } from 'next/server';
import { AhUpcomingService } from '@/lib/services/ahUpcomingService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const badge = searchParams.get('badge') || undefined;
    const leagueCode = searchParams.get('league') || undefined;

    const res = await AhUpcomingService.getUpcomingAhFixtures({
      daysAhead: 7,
      leagueCode,
      limit: 100,
    });

    let valueRows = res.fixtures.map((f) => ({
      canonicalFixtureId: f.canonicalFixtureId,
      match: `${f.homeTeam} vs ${f.awayTeam}`,
      kickoff: f.kickoff,
      competition: f.competition,
      leagueCode: f.leagueCode,
      marketAvailable: f.marketAvailable,
      marketLine: f.marketLine,
      marketOdds: f.homeOdds,
      oppositeOdds: f.awayOdds,
      bookmaker: f.bookmaker,
      oddsTimestamp: f.oddsTimestamp,
      marketImpliedProb: f.marketImpliedProbHome,
      modelProbability: f.modelProbHome,
      fairOdds: f.homeFairOdds,
      expectedValuePct: f.homeEvPct,
      decision: f.decisionHome,
      evidence: f.evidence,
    }));

    if (badge && badge !== 'ALL') {
      valueRows = valueRows.filter((r) => r.decision.badge === badge);
    }
    if (status && status !== 'ALL') {
      valueRows = valueRows.filter((r) => r.decision.status === status);
    }

    return NextResponse.json({
      success: true,
      data: {
        totalOpportunities: valueRows.length,
        dataFreshness: res.dataFreshness,
        source: res.source,
        dataState: res.dataState,
        decisions: valueRows,
      },
    });
  } catch (error) {
    console.error('[API /api/ah/value] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error while evaluating AH values',
      },
      { status: 500 }
    );
  }
}
