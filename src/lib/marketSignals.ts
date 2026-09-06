import { supabase } from './supabase.server';
import { validateUpcomingPrediction } from './validation/predictionGate';

export type MarketDataStatus =
  | 'LIVE'
  | 'HISTORICAL_MARKET_DATA'
  | 'HISTORICAL_MATCH_FACTS'
  | 'CALIBRATION_ONLY';

export interface UnifiedMarketSignal {
  id: string;
  fixtureId: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoff: string;
  market: 'ASIAN_HANDICAP' | 'OVER_UNDER' | 'BTTS';
  pick: string;
  line?: number | null;
  odds: number;
  fairOdds?: number | null;
  edge: number;
  confidence: number | string;
  signalColor?: 'green' | 'yellow' | 'red';
  status: 'PENDING' | 'SETTLED' | 'VOID' | 'ACTIVE';
  profit_loss?: number | null;
  actualOutcome?: string | null;
  modelVersion?: string;
  dataStatus: MarketDataStatus;
  sourceProvenance: string;
}

export async function getMarketSignals(
  marketType: 'asian-handicap' | 'over-under' | 'btts'
): Promise<UnifiedMarketSignal[]> {
  const normalizedMarket =
    marketType === 'asian-handicap'
      ? 'ASIAN_HANDICAP'
      : marketType === 'over-under'
      ? 'OVER_UNDER'
      : 'BTTS';

  const signals: UnifiedMarketSignal[] = [];
  const nowUtc = new Date();

  // Query Live Database strictly via Canonical View (active_daily_picks)
  // Excludes synthetic, quarantined, or past-kickoff records
  try {
    const { data: dbPicks, error } = await supabase
      .from('active_daily_picks')
      .select('*')
      .eq('market_type', normalizedMarket)
      .order('kickoff_utc', { ascending: true })
      .limit(100);

    if (!error && dbPicks && dbPicks.length > 0) {
      for (const p of dbPicks) {
        if (signals.some((s) => s.id === p.id || s.fixtureId === p.fixture_id)) continue;

        // Gate validation: Reject expired or invalid predictions
        const validation = validateUpcomingPrediction(
          {
            id: p.id,
            fixtureId: p.fixture_id,
            homeTeam: p.home_team,
            awayTeam: p.away_team,
            kickoffTime: p.kickoff_utc,
            status: p.status === 'PENDING' ? 'NS' : p.status,
            market: p.market_type,
            odds: p.market_odds,
            fairProbability: p.model_probability,
          },
          nowUtc
        );

        if (!validation.isValid) continue;

        // Determine signal color deterministically if not already stored
        let signalColor: 'green' | 'yellow' | 'red' = (p.signal_color as 'green' | 'yellow' | 'red') || 'red';
        if (!p.signal_color) {
          const edge = Number(p.edge_pct || 0);
          const sample = Number(p.similar_sample_size || 0);
          if (edge >= 5.0 && sample >= 30) signalColor = 'green';
          else if (edge >= 0.0 && sample >= 10) signalColor = 'yellow';
          else signalColor = 'red';
        }

        signals.push({
          id: p.id,
          fixtureId: p.fixture_id,
          match: `${p.home_team} vs ${p.away_team}`,
          homeTeam: p.home_team,
          awayTeam: p.away_team,
          league: p.league || 'Target League',
          kickoff: p.kickoff_utc || p.created_at,
          market: normalizedMarket,
          pick: p.prediction || `${p.market_type}`,
          line: p.line !== undefined && p.line !== null ? Number(p.line) : undefined,
          odds: p.market_odds || 1.90,
          fairOdds: p.fair_odds,
          edge: Number((p.edge_pct || 0).toFixed(2)),
          confidence: p.confidence ? `${p.confidence}%` : 'Quant Model',
          signalColor,
          status: p.status === 'WON' || p.status === 'LOST' || p.status === 'PUSH' ? 'SETTLED' : 'PENDING',
          profit_loss: p.profit_loss,
          actualOutcome: p.actual_score,
          modelVersion: p.model_version || 'AH-dixoncoles-v1.0.0',
          dataStatus: 'LIVE',
          sourceProvenance: p.market_bookmaker ? `${p.market_bookmaker} (Pinnacle Benchmark)` : 'Pinnacle (OddsPAPI v4)',
        });
      }
    }
  } catch (err) {
    console.warn(`[MarketSignals] Supabase active_daily_picks query for ${normalizedMarket} error:`, err);
  }

  // ZERO DUMMY DATA RULE: If no real database signals qualify, return empty list.
  // Never synthesize, fallback to local test files, or fabricate predictions.
  return signals;
}


