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

    const marketStats: Record<string, {
      market: string;
      bets: number;
      wins: number;
      profitUnits: number;
      clvSum: number;
      clvCount: number;
      modelProbSum: number;
      closingProbSum: number;
      probCount: number;
    }> = {
      'asian_handicap': { market: 'Asian Handicap', bets: 0, wins: 0, profitUnits: 0, clvSum: 0, clvCount: 0, modelProbSum: 0, closingProbSum: 0, probCount: 0 },
      'over_under': { market: 'Over/Under', bets: 0, wins: 0, profitUnits: 0, clvSum: 0, clvCount: 0, modelProbSum: 0, closingProbSum: 0, probCount: 0 },
      'moneyline': { market: 'Moneyline', bets: 0, wins: 0, profitUnits: 0, clvSum: 0, clvCount: 0, modelProbSum: 0, closingProbSum: 0, probCount: 0 }
    };

    filteredSignals.forEach(sig => {
      const marketKey = (sig.market || '').toLowerCase();
      const stats = marketStats[marketKey] || marketStats['moneyline']; // fallback
      stats.bets++;

      const odds = Number(sig.odds || 1.0);
      const status = (sig.status || 'pending').toLowerCase();
      let profit = 0;

      if (status === 'won' || status === 'win') {
        profit = odds - 1.0;
        stats.wins++;
      } else if (status === 'half_win') {
        profit = 0.5 * (odds - 1.0);
        stats.wins++;
      } else if (status === 'push' || status === 'void') {
        profit = 0.0;
      } else if (status === 'half_loss') {
        profit = -0.5;
      } else {
        profit = -1.0;
      }

      stats.profitUnits += profit;

      const clvPct = sig.clv_percentage !== null && sig.clv_percentage !== undefined
        ? Number(sig.clv_percentage)
        : null;
      if (clvPct !== null) {
        stats.clvSum += clvPct;
        stats.clvCount++;
      }

      const modelProb = sig.probability !== null && sig.probability !== undefined ? Number(sig.probability) : null;
      const closingOdds = sig.closing_odds !== null && sig.closing_odds !== undefined ? Number(sig.closing_odds) : null;
      if (modelProb !== null && closingOdds && closingOdds > 1.0) {
        stats.modelProbSum += modelProb;
        stats.closingProbSum += (1.0 / closingOdds);
        stats.probCount++;
      }
    });

    const breakdown = Object.values(marketStats).map(s => {
      const roi = s.bets > 0 ? (s.profitUnits / s.bets) * 100 : 0.0;
      const clv = s.clvCount > 0 ? s.clvSum / s.clvCount : 0.0;
      const accuracy = s.bets > 0 ? (s.wins / s.bets) * 100 : 0.0;

      const avgModelProb = s.probCount > 0 ? (s.modelProbSum / s.probCount) * 100 : 0.0;
      const avgClosingProb = s.probCount > 0 ? (s.closingProbSum / s.probCount) * 100 : 0.0;

      return {
        market: s.market,
        bets: s.bets,
        roi: Number(roi.toFixed(2)),
        clv: Number(clv.toFixed(2)),
        accuracy: Number(accuracy.toFixed(2)),
        avgModelProb: Number(avgModelProb.toFixed(2)),
        avgClosingProb: Number(avgClosingProb.toFixed(2)),
        trueEdge: Number((avgModelProb - avgClosingProb).toFixed(2))
      };
    });

    return NextResponse.json({
      success: true,
      breakdown
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
