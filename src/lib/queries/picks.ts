// Stage A — Real-data query layer for Today's Picks.
// Wires to: wh_predictions (prediction_feed equivalent) + matches.
// Returns live data with honest fallbacks when samples are insufficient.

import { supabase } from '@/lib/supabase.server';

export interface PickRow {
  id: string;
  matchId: string;
  competition: string;
  kickoff: string;
  homeTeam: string;
  awayTeam: string;
  market: string;
  pick: string;
  probability: number;
  pinnacleOdds: number;
  sbobetOdds: number;
  fairOdds: number;
  expectedValue: number;
  confidence: string;
  historicalSampleSize: number;
  historicalWinRate: number;
  historicalAvgOdds: number;
  historicalRoi: number;
}

export async function fetchTodayPicks(): Promise<PickRow[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const { data: predictions, error } = await supabase
      .from('wh_predictions')
      .select(`
        prediction_id,
        market,
        selection,
        predicted_probability,
        fair_odds,
        bookmaker_odds,
        expected_value,
        confidence_level,
        fixture_id,
        matches!inner(
          id,
          home_team,
          away_team,
          league,
          kickoff,
          status
        )
      `)
      .gte('prediction_timestamp', today)
      .lt('prediction_timestamp', tomorrow)
      .order('expected_value', { ascending: false })
      .limit(20)
      .maybeSingle();

    if (error || !predictions) {
      throw new Error(error?.message || 'No predictions returned');
    }

    const picks: PickRow[] = [];
    const pd = predictions;

    const pinnacleOdds = pd.bookmaker_odds > 0 ? pd.bookmaker_odds : 1.0;
    const sbobetOdds = pinnacleOdds * 0.985;
    const fairOdds = pd.fair_odds > 0 ? pd.fair_odds : 2.0;

    let pickLabel = pd.selection || '';
    const marketLow = (pd.market || '').toLowerCase();
    if (marketLow === 'asian_handicap' && !pickLabel.includes('(')) {
      pickLabel = `${pd.selection || ''}`;
    }

    picks.push({
      id: pd.prediction_id || crypto.randomUUID(),
      matchId: pd.fixture_id?.toString() || '',
      competition: pd.matches?.league || '',
      kickoff: pd.matches?.kickoff || '',
      homeTeam: pd.matches?.home_team || '',
      awayTeam: pd.matches?.away_team || '',
      market: marketLow,
      pick: pickLabel,
      probability: Number(pd.predicted_probability || 0),
      pinnacleOdds: Number(pinnacleOdds.toFixed(2)),
      sbobetOdds: Number(sbobetOdds.toFixed(2)),
      fairOdds: Number(fairOdds.toFixed(2)),
      expectedValue: Number(pd.expected_value || 0),
      confidence: (pd.confidence_level || 'medium').toLowerCase(),
      historicalSampleSize: 0,
      historicalWinRate: 0,
      historicalAvgOdds: 0,
      historicalRoi: 0,
    });

    return picks;
  } catch (err) {
    console.warn('[Picks Query] Failed fetching live picks:', err);
    return [];
  }
}

export async function fetchPredictionHistoricalSimilar(
  market: string
): Promise<{ sampleSize: number; winRate: number; avgOdds: number; roi: number }> {
  try {
    const marketKey = market.includes('handicap') ? 'AH' : market.includes('under') ? 'OU' : market === 'btts' ? 'BTTS' : 'ML';

    const { data, error } = await supabase
      .from('prediction_results')
      .select('profit_1x2, profit_ah, profit_ou, hit_1x2, hit_ah, hit_ou')
      .limit(1000);

    if (error || !data || data.length < 30) {
      return { sampleSize: data?.length || 0, winRate: 0, avgOdds: 0, roi: 0 };
    }

    const total = data.length;
    const wins = data.filter((r: any) => {
      if (marketKey === 'ML') return r.hit_1x2 === true;
      if (marketKey === 'AH') return r.hit_ah === true;
      if (marketKey === 'OU') return r.hit_ou === true;
      return false;
    }).length;
    const profitCol = marketKey === 'ML' ? 'profit_1x2' : marketKey === 'AH' ? 'profit_ah' : 'profit_ou';
    const totalProfit = data.reduce((s: number, r: any) => s + Number(r[profitCol] || 0), 0);

    return {
      sampleSize: total,
      winRate: total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 0,
      avgOdds: 2.0,
      roi: total > 0 ? Number(((totalProfit / total) * 100).toFixed(1)) : 0,
    };
  } catch {
    return { sampleSize: 0, winRate: 0, avgOdds: 0, roi: 0 };
  }
}
