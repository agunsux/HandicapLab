import { NextRequest, NextResponse } from 'next/server';
import { classifyRecommendation } from '../../../../lib/value-intelligence/recommendation-engine';
import { generateValueExplanation } from '../../../../lib/value-intelligence/explainability';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;
    const league = searchParams.get('league') || undefined;

    // Sample active fixtures for value intelligence recommendations
    const mockFixtures = [
      {
        fixtureId: 'v-101',
        league: 'Premier League',
        season: '2025-2026',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoff: new Date(Date.now() + 7200000).toISOString(),
        quote: { market: 'asian_handicap' as const, line: -0.5, priceHome: 1.98, priceAway: 1.92, bookmaker: 'pinnacle' },
        selection: 'home' as const,
        modelProb: 0.585,
        confidence: 0.72,
      },
      {
        fixtureId: 'v-102',
        league: 'La Liga',
        season: '2025-2026',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        kickoff: new Date(Date.now() + 10800000).toISOString(),
        quote: { market: 'moneyline' as const, line: 0, priceHome: 2.15, priceDraw: 3.50, priceAway: 3.30, bookmaker: 'pinnacle' },
        selection: 'home' as const,
        modelProb: 0.525,
        confidence: 0.68,
      },
      {
        fixtureId: 'v-103',
        league: 'Bundesliga',
        season: '2025-2026',
        homeTeam: 'Bayern Munich',
        awayTeam: 'Dortmund',
        kickoff: new Date(Date.now() + 14400000).toISOString(),
        quote: { market: 'over_under' as const, line: 2.5, priceHome: 1.95, priceAway: 1.95, bookmaker: 'pinnacle' },
        selection: 'over' as const,
        modelProb: 0.590,
        confidence: 0.74,
      },
    ];

    const recommendations = mockFixtures.map(f => {
      const rec = classifyRecommendation(f);
      const explanation = generateValueExplanation(rec);
      return {
        ...rec,
        explanation,
      };
    });

    let filtered = recommendations;
    if (category) {
      filtered = filtered.filter(r => r.category === category);
    }
    if (league) {
      filtered = filtered.filter(r => r.league.toLowerCase() === league.toLowerCase());
    }

    return NextResponse.json({
      success: true,
      count: filtered.length,
      data: filtered,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
