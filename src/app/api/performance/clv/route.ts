import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase.server';
import { LEAGUE_REGISTRY } from '../../../../lib/crons/leagueRegistry';

export async function GET(request: Request) {
  try {
    const { data: signals, error } = await supabase
      .from('signals')
      .select('*')
      .not('settled_at', 'is', null);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const priorityALeagues = new Set(
      LEAGUE_REGISTRY.filter(l => l.validation_priority === 'A').map(l => l.name)
    );
    const filteredSignals = (signals || []).filter(sig => sig.league && priorityALeagues.has(sig.league));

    let eliteCount = 0;
    let positiveCount = 0;
    let neutralCount = 0;
    let negativeCount = 0;
    let clvSum = 0;
    let clvCount = 0;

    const recentMovements: any[] = [];

    filteredSignals.forEach(sig => {
      const clvPct = sig.clv_percentage !== null && sig.clv_percentage !== undefined
        ? Number(sig.clv_percentage)
        : null;

      if (clvPct !== null) {
        clvSum += clvPct;
        clvCount++;

        const category = sig.clv_category || (clvPct >= 5.0 ? 'Elite' : clvPct >= 0.5 ? 'Positive' : clvPct <= -0.5 ? 'Negative' : 'Neutral');

        if (category === 'Elite') eliteCount++;
        else if (category === 'Positive') positiveCount++;
        else if (category === 'Negative') negativeCount++;
        else neutralCount++;

        if (recentMovements.length < 20) {
          recentMovements.push({
            id: sig.id,
            match: `${sig.home_team} vs ${sig.away_team}`,
            market: sig.market,
            selection: sig.selection,
            openingOdds: sig.odds,
            closingOdds: sig.closing_odds,
            clvPercentage: clvPct,
            category
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      averageClv: clvCount > 0 ? Number((clvSum / clvCount).toFixed(2)) : 0.0,
      distribution: {
        elite: eliteCount,
        positive: positiveCount,
        neutral: neutralCount,
        negative: negativeCount
      },
      recentMovements
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
