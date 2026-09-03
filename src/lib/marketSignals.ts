import { getTerminalPredictions } from './terminalData';
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

  // 1. Check Terminal Predictions (Asian Handicap only)
  if (normalizedMarket === 'ASIAN_HANDICAP') {
    try {
      const terminalRows = getTerminalPredictions();
      for (const r of terminalRows) {
        // Enforce quality gate
        const validation = validateUpcomingPrediction(
          {
            id: r.id,
            fixtureId: r.fixture_id,
            homeTeam: r.home_team,
            awayTeam: r.away_team,
            kickoffTime: r.kickoff_at,
            status: r.settlement_status === 'SETTLED' ? 'FT' : 'NS',
            market: r.market,
            line: r.line,
            odds: r.taken_odds,
            fairProbability: r.fair_probability,
            modelVersion: r.model_version,
          },
          nowUtc
        );

        if (!validation.isValid) continue;

        const isSettled = r.settlement_status === 'SETTLED';
        const hasMarketOdds = (r.closing_odds && r.closing_odds > 1.0) || (r.taken_odds && r.taken_odds > 1.0);
        const dataStatus: MarketDataStatus = isSettled
          ? hasMarketOdds
            ? 'HISTORICAL_MARKET_DATA'
            : 'HISTORICAL_MATCH_FACTS'
          : 'LIVE';

        signals.push({
          id: r.id,
          fixtureId: r.fixture_id,
          match: `${r.home_team} vs ${r.away_team}`,
          homeTeam: r.home_team,
          awayTeam: r.away_team,
          league: r.league_name,
          kickoff: r.kickoff_at,
          market: 'ASIAN_HANDICAP',
          pick: `${r.side.toUpperCase()} ${r.line > 0 ? `+${r.line}` : r.line}`,
          line: r.line,
          odds: r.taken_odds,
          fairOdds: r.fair_odds,
          edge: Number((r.edge * 100).toFixed(2)),
          confidence: r.sample_size > 0 ? `${r.sample_size} matches` : 'Validated',
          status: isSettled ? 'SETTLED' : 'PENDING',
          profit_loss: r.profit_loss,
          actualOutcome: r.actual_outcome,
          modelVersion: r.model_version,
          dataStatus,
          sourceProvenance: 'OddsPAPI (Pinnacle Benchmark)',
        });
      }
    } catch (err) {
      console.warn('[MarketSignals] Terminal predictions read error:', err);
    }
  }

  // 2. Query Live Database (daily_picks) — Strict zero-dummy filter
  try {
    const { data: dbPicks, error } = await supabase
      .from('daily_picks')
      .select('*')
      .eq('market_type', normalizedMarket)
      .is('rejection_reason', null)
      .gt('kickoff_utc', nowUtc.toISOString())
      .order('kickoff_utc', { ascending: true })
      .limit(50);

    if (!error && dbPicks && dbPicks.length > 0) {
      for (const p of dbPicks) {
        if (signals.some((s) => s.id === p.id || s.fixtureId === p.fixture_id)) continue;

        // Gate validation
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

        signals.push({
          id: p.id,
          fixtureId: p.fixture_id,
          match: `${p.home_team} vs ${p.away_team}`,
          homeTeam: p.home_team,
          awayTeam: p.away_team,
          league: p.league || 'Top League',
          kickoff: p.kickoff_utc || p.created_at,
          market: normalizedMarket,
          pick: p.prediction || `${p.market_type}`,
          odds: p.market_odds || 1.90,
          fairOdds: p.fair_odds,
          edge: p.edge_pct || 0,
          confidence: p.confidence ? `${p.confidence}%` : 'Standard',
          status: p.status === 'WON' || p.status === 'LOST' || p.status === 'PUSH' ? 'SETTLED' : 'PENDING',
          profit_loss: p.profit_loss,
          actualOutcome: p.actual_score,
          dataStatus: 'LIVE',
          sourceProvenance: p.market_bookmaker ? `${p.market_bookmaker} (OddsPAPI v4)` : 'Pinnacle (OddsPAPI v4)',
        });
      }
    }
  } catch (err) {
    console.warn(`[MarketSignals] Supabase daily_picks query for ${normalizedMarket} error:`, err);
  }

  // 3. Fallback to Prediction Ledger v3 with strict future validation
  if (signals.length === 0) {
    const shortCode = marketType === 'asian-handicap' ? 'AH' : marketType === 'over-under' ? 'OU' : 'BTTS';
    try {
      const { data: ledgerRows, error } = await supabase
        .from('prediction_ledger_v3')
        .select('*, matches(id, home_team, away_team, league, kickoff, status, data_status, source_type)')
        .eq('market_type', shortCode)
        .order('prediction_timestamp', { ascending: false })
        .limit(30);

      if (!error && ledgerRows && ledgerRows.length > 0) {
        for (const r of ledgerRows) {
          const m = r.matches;

          // Reject synthetic/quarantined matches
          if (m?.data_status === 'QUARANTINED' || m?.source_type === 'SYNTHETIC') continue;

          const validation = validateUpcomingPrediction(
            {
              id: r.id,
              fixtureId: m?.id || r.match_id || r.id,
              homeTeam: m?.home_team,
              awayTeam: m?.away_team,
              kickoffTime: m?.kickoff,
              status: m?.status === 'SCHEDULED' || m?.status === 'TIMED' ? 'NS' : m?.status,
              market: shortCode,
              odds: r.market_odds,
              fairProbability: r.calibrated_probability,
              modelVersion: r.model_version,
            },
            nowUtc
          );

          if (!validation.isValid) continue;

          const prob = r.calibrated_probability || 0.5;
          const odds = r.market_odds || 1.90;
          const edge = r.expected_value ? r.expected_value * 100 : (prob * odds - 1) * 100;

          signals.push({
            id: r.id,
            fixtureId: m?.id || r.match_id || r.id,
            match: `${m?.home_team || 'Home'} vs ${m?.away_team || 'Away'}`,
            homeTeam: m?.home_team || 'Home',
            awayTeam: m?.away_team || 'Away',
            league: m?.league || 'League',
            kickoff: m?.kickoff || r.prediction_timestamp,
            market: normalizedMarket,
            pick: `${r.selection || ''} ${r.line !== undefined && r.line !== null ? r.line : ''}`.trim(),
            line: r.line,
            odds: odds,
            fairOdds: prob > 0 ? Number((1 / prob).toFixed(2)) : undefined,
            edge: Number(edge.toFixed(2)),
            confidence: r.confidence_score ? `${Math.round(r.confidence_score * 100)}%` : 'Quant Model',
            status: m?.status === 'FT' ? 'SETTLED' : 'PENDING',
            modelVersion: r.model_version,
            dataStatus:
              m?.status === 'FT'
                ? r.market_odds && r.closing_odds
                  ? 'HISTORICAL_MARKET_DATA'
                  : 'HISTORICAL_MATCH_FACTS'
                : 'LIVE',
            sourceProvenance: 'API-Football / OddsPAPI',
          });
        }
      }
    } catch (err) {
      console.warn(`[MarketSignals] Supabase prediction_ledger_v3 query for ${shortCode} error:`, err);
    }
  }

  return signals;
}

