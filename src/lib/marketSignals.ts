import { getTerminalPredictions } from './terminalData';
import { supabase } from './supabase.server';

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

  if (normalizedMarket === 'ASIAN_HANDICAP') {
    try {
      const terminalRows = getTerminalPredictions();
      for (const r of terminalRows) {
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
          status: r.settlement_status,
          profit_loss: r.profit_loss,
          actualOutcome: r.actual_outcome,
          modelVersion: r.model_version,
        });
      }
    } catch (err) {
      console.warn('[MarketSignals] Terminal predictions read error:', err);
    }
  }

  try {
    const { data: dbPicks, error } = await supabase
      .from('daily_picks')
      .select('*')
      .eq('market_type', normalizedMarket)
      .order('kickoff_utc', { ascending: false })
      .limit(50);

    if (!error && dbPicks && dbPicks.length > 0) {
      for (const p of dbPicks) {
        if (signals.some((s) => s.id === p.id || s.fixtureId === p.fixture_id)) continue;

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
        });
      }
    }
  } catch (err) {
    console.warn(`[MarketSignals] Supabase daily_picks query for ${normalizedMarket} error:`, err);
  }

  if (signals.length === 0) {
    const shortCode = marketType === 'asian-handicap' ? 'AH' : marketType === 'over-under' ? 'OU' : 'BTTS';
    try {
      const { data: ledgerRows, error } = await supabase
        .from('prediction_ledger_v3')
        .select('*, matches(id, home_team, away_team, league, kickoff, status)')
        .eq('market_type', shortCode)
        .order('prediction_timestamp', { ascending: false })
        .limit(30);

      if (!error && ledgerRows && ledgerRows.length > 0) {
        for (const r of ledgerRows) {
          const m = r.matches;
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
          });
        }
      }
    } catch (err) {
      console.warn(`[MarketSignals] Supabase prediction_ledger_v3 query for ${shortCode} error:`, err);
    }
  }

  return signals;
}

