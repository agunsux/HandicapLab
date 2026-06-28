import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '../../../../lib/supabase.server';
import { oddsApiClient } from '@/lib/apis/oddspapi';
import { CronLogger } from '@/lib/services/cronLogger';
import { runHealthCheck } from '@/lib/services/healthChecker';
import { calculateQualityMetrics } from '@/lib/analytics/data-quality';

const SPORT_MAP: Record<number, string> = {
  39: 'soccer_epl',
  2: 'soccer_uefa_champs_league',
  140: 'soccer_spain_la_liga',
  135: 'soccer_italy_serie_a',
  78: 'soccer_germany_bundesliga',
  61: 'soccer_france_ligue1',
  1: 'soccer_fifa_world_cup',
  848: 'soccer_france_ligue2'
};

function isTeamMatch(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase().replace(/[\s-_]/g, '');
  const n2 = name2.toLowerCase().replace(/[\s-_]/g, '');
  return n1.includes(n2) || n2.includes(n1);
}

export async function GET(request: Request) {
  return handleCaptureOdds(request);
}

export async function POST(request: Request) {
  return handleCaptureOdds(request);
}

async function handleCaptureOdds(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const logId = await CronLogger.start('capture-odds');

  const now = new Date();
  const rangeStart = now.toISOString();
  const rangeEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();

  console.log(`[CaptureOdds Cron] Checking pending signals with kickoff in range: [${rangeStart}, ${rangeEnd}]`);

  try {
    // 1. Fetch pending signals starting in next 48 hours where closing_odds is null
    const { data: pendingSignals, error: fetchErr } = await supabase
      .from('signals')
      .select('*')
      .eq('status', 'pending')
      .is('closing_odds', null)
      .gt('kickoff_utc', rangeStart)
      .lte('kickoff_utc', rangeEnd);

    if (fetchErr) {
      throw new Error(`Failed to fetch pending signals for odds capture: ${fetchErr.message}`);
    }

    if (!pendingSignals || pendingSignals.length === 0) {
      console.log('[CaptureOdds Cron] No pending signals starting in the next 48 hours.');
      await CronLogger.end(logId, 0, null);
      return NextResponse.json({ success: true, capturedCount: 0 });
    }

    console.log(`[CaptureOdds Cron] Found ${pendingSignals.length} pending signals to capture closing odds for.`);

    const { LEAGUE_REGISTRY } = await import('@/lib/crons/leagueRegistry');

    // Group signals by sportKey
    const signalsBySport: Record<string, typeof pendingSignals> = {};
    for (const signal of pendingSignals) {
      const leagueConfig = LEAGUE_REGISTRY.find(l => l.name === signal.league);
      const apiFootballId = leagueConfig?.apiFootballId ?? 39;
      const sportKey = SPORT_MAP[apiFootballId] || 'soccer_epl';
      if (!signalsBySport[sportKey]) {
        signalsBySport[sportKey] = [];
      }
      signalsBySport[sportKey].push(signal);
    }

    let capturedCount = 0;

    // 3. Query current odds from Odds API per sportKey
    for (const [sportKey, signals] of Object.entries(signalsBySport)) {
      let oddsList: any[] = [];
      try {
        oddsList = await oddsApiClient.getOdds(sportKey);
      } catch (err) {
        console.error(`[CaptureOdds Cron] Failed to fetch odds for sport key ${sportKey}:`, err);
        continue;
      }

      for (const signal of signals) {
        const matchOdds = oddsList.find(o => isTeamMatch(o.home_team, signal.home_team) && isTeamMatch(o.away_team, signal.away_team));
        if (!matchOdds) {
          console.warn(`[CaptureOdds Cron] Match not found in odds list for signal ${signal.id}: ${signal.home_team} vs ${signal.away_team}`);
          continue;
        }

        const pinnacle = matchOdds.bookmakers.find((b: any) => b.key === 'pinnacle');
        if (!pinnacle) {
          console.warn(`[CaptureOdds Cron] Pinnacle bookmaker not found in odds for match: ${signal.home_team} vs ${signal.away_team}`);
          continue;
        }

        let closingOdds: number | undefined;
        let closingLine: number | undefined;
        let oddsHome: number | null = null;
        let oddsAway: number | null = null;

        if (signal.market === 'moneyline') {
          const h2hMarket = pinnacle.markets.find((m: any) => m.key === 'h2h');
          if (h2hMarket) {
            const homeOutcome = h2hMarket.outcomes.find((o: any) => isTeamMatch(o.name, signal.home_team));
            const drawOutcome = h2hMarket.outcomes.find((o: any) => o.name.toLowerCase() === 'draw');
            const awayOutcome = h2hMarket.outcomes.find((o: any) => isTeamMatch(o.name, signal.away_team));
            oddsHome = homeOutcome?.price || null;
            oddsAway = awayOutcome?.price || null;
            const outcome = signal.selection === 'home' ? homeOutcome : (signal.selection === 'away' ? awayOutcome : drawOutcome);
            if (outcome) {
              closingOdds = outcome.price;
              closingLine = 0.0;
            }
          }
        } else if (signal.market === 'asian_handicap') {
          const spreadsMarket = pinnacle.markets.find((m: any) => m.key === 'spreads');
          if (spreadsMarket) {
            const homeOutcome = spreadsMarket.outcomes.find((o: any) => isTeamMatch(o.name, signal.home_team));
            const awayOutcome = spreadsMarket.outcomes.find((o: any) => isTeamMatch(o.name, signal.away_team));
            oddsHome = homeOutcome?.price || null;
            oddsAway = awayOutcome?.price || null;

            let outcome = spreadsMarket.outcomes.find((o: any) => {
              const isHome = isTeamMatch(o.name, signal.home_team);
              const lineVal = o.point;
              const expectedLine = isHome ? lineVal : -lineVal;
              const expectedSelection = isHome ? 'home' : 'away';
              return Math.abs(expectedLine - Number(signal.handicap_line || 0)) < 0.001 && expectedSelection === signal.selection;
            });
            if (!outcome) {
              outcome = spreadsMarket.outcomes.find((o: any) => {
                const isHome = isTeamMatch(o.name, signal.home_team);
                const expectedSelection = isHome ? 'home' : 'away';
                return expectedSelection === signal.selection;
              });
            }
            if (outcome) {
              closingOdds = outcome.price;
              const isHome = isTeamMatch(outcome.name, signal.home_team);
              const lineVal = outcome.point;
              closingLine = isHome ? lineVal : -lineVal;
            }
          }
        } else if (signal.market === 'over_under') {
          const totalsMarket = pinnacle.markets.find((m: any) => m.key === 'totals');
          if (totalsMarket) {
            const overOutcome = totalsMarket.outcomes.find((o: any) => o.name.toLowerCase() === 'over');
            const underOutcome = totalsMarket.outcomes.find((o: any) => o.name.toLowerCase() === 'under');
            oddsHome = overOutcome?.price || null;
            oddsAway = underOutcome?.price || null;

            let outcome = totalsMarket.outcomes.find((o: any) => {
              const isOver = o.name.toLowerCase() === 'over';
              const expectedSelection = isOver ? 'over' : 'under';
              return Math.abs(o.point - Number(signal.handicap_line || 0)) < 0.001 && expectedSelection === signal.selection;
            });
            if (!outcome) {
              outcome = totalsMarket.outcomes.find((o: any) => {
                const isOver = o.name.toLowerCase() === 'over';
                const expectedSelection = isOver ? 'over' : 'under';
                return expectedSelection === signal.selection;
              });
            }
            if (outcome) {
              closingOdds = outcome.price;
              closingLine = outcome.point;
            }
          }
        }

        if (closingOdds !== undefined && closingOdds > 1.0 && closingLine !== undefined) {
          const openingOdds = Number(signal.opening_odds || signal.odds || 1.0);
          const openingLine = Number(signal.opening_line || signal.handicap_line || 0.0);

          const clvRaw = (openingOdds / closingOdds) - 1;
          const oddsMove = closingOdds - openingOdds;
          const lineMove = closingLine - openingLine;

          const { error: updateErr } = await supabase
            .from('signals')
            .update({
              opening_odds: openingOdds,
              opening_line: openingLine,
              closing_odds: closingOdds,
              closing_line: closingLine,
              clv: clvRaw,
              odds_move: oddsMove,
              line_move: lineMove,
              last_odds_update: new Date().toISOString(),
              odds_age_minutes: 0,
              updated_at: new Date().toISOString()
            })
            .eq('id', signal.id);

          if (updateErr) {
            console.error(`[CaptureOdds Cron] Failed to update signal ${signal.id}:`, updateErr);
          } else {
            console.log(`[CaptureOdds Cron] Updated signal ${signal.id} - Closing Odds: ${closingOdds}, Line: ${closingLine}, CLV: ${(clvRaw * 100).toFixed(2)}%`);
            
            // Store captured odds snapshot in odds_snapshots table
            const { error: snapshotErr } = await supabase
              .from('odds_snapshots')
              .insert({
                match_id: signal.match_id,
                signal_id: signal.id,
                bookmaker: 'pinnacle',
                market: signal.market,
                line: closingLine,
                odds: closingOdds,
                market_type: signal.market === 'asian_handicap' ? 'AH' : (signal.market === 'over_under' ? 'OU' : 'ML'),
                handicap_line: closingLine,
                odds_home: oddsHome,
                odds_away: oddsAway,
                captured_at: new Date().toISOString()
              });

            if (snapshotErr) {
              console.error(`[CaptureOdds Cron] Failed to insert odds_snapshot for signal ${signal.id}:`, snapshotErr);
            }

            // Calculate final quality score and insert in signal_metrics
            try {
              const metrics = calculateQualityMetrics({
                provider: 'pinnacle',
                opening_odds: openingOdds,
                closing_odds: closingOdds,
                opening_line: openingLine,
                closing_line: closingLine,
                confidence: signal.confidence,
                league: signal.league
              }, clvRaw);

              await supabase
                .from('signal_metrics')
                .insert({
                  signal_id: signal.id,
                  quality_score: metrics.quality_score,
                  sharp_score: metrics.sharp_score,
                  clv_score: metrics.clv_score,
                  liquidity_score: metrics.liquidity_score,
                  confidence_score: metrics.confidence_score,
                  model_version: signal.model_version || 'rule_v1',
                  calculated_at: new Date().toISOString()
                });
            } catch (metricsErr) {
              console.error(`[CaptureOdds Cron] Failed to write final quality metrics for signal ${signal.id}:`, metricsErr);
            }

            // Trace correlation ID from SIGNAL_CREATED
            let correlationId = null;
            try {
              const { data: auditEvent } = await supabase
                .from('signal_audit_events')
                .select('correlation_id')
                .eq('signal_id', signal.id)
                .eq('event_type', 'SIGNAL_CREATED')
                .maybeSingle();
              correlationId = auditEvent?.correlation_id || null;
            } catch (err) {
              console.error(`[CaptureOdds Cron] Failed to fetch correlation ID for signal ${signal.id}:`, err);
            }
            const activeCorrId = correlationId || crypto.randomUUID();

            // Reuse and write to existing odds_history table with new properties
            try {
              await supabase
                .from('odds_history')
                .insert({
                  match_id: String(signal.match_id),
                  signal_id: signal.id,
                  correlation_id: activeCorrId,
                  market_type: signal.market,
                  home_odds: signal.selection === 'home' ? closingOdds : undefined,
                  draw_odds: signal.selection === 'draw' ? closingOdds : undefined,
                  away_odds: signal.selection === 'away' ? closingOdds : undefined,
                  odds: closingOdds,
                  line: closingLine,
                  provider: 'pinnacle',
                  recorded_at: new Date().toISOString(),
                  captured_at: new Date().toISOString(),
                  provider_timestamp: new Date().toISOString(),
                  api_request_id: activeCorrId,
                  source_version: 'v4'
                });
            } catch (historyErr) {
              console.error(`[CaptureOdds Cron] Failed to insert odds_history for signal ${signal.id}:`, historyErr);
            }

            // Create ODDS_CAPTURED audit event (with transaction safety)
            try {
              await supabase
                .from('signal_audit_events')
                .insert({
                  signal_id: signal.id,
                  event_type: 'ODDS_CAPTURED',
                  source: 'capture_odds_cron',
                  correlation_id: activeCorrId,
                  payload: {
                    old_line: openingLine,
                    new_line: closingLine,
                    old_odds: openingOdds,
                    new_odds: closingOdds,
                    provider: 'pinnacle'
                  }
                });
            } catch (auditErr) {
              console.error(`[CaptureOdds Cron] Failed to write ODDS_CAPTURED audit event for signal ${signal.id}:`, auditErr);
            }

            // If the line moved, log LINE_MOVED audit event
            if (openingLine !== closingLine) {
              try {
                await supabase
                  .from('signal_audit_events')
                  .insert({
                    signal_id: signal.id,
                    event_type: 'LINE_MOVED',
                    source: 'capture_odds_cron',
                    correlation_id: activeCorrId,
                    payload: {
                      old_line: openingLine,
                      new_line: closingLine,
                      old_odds: openingOdds,
                      new_odds: closingOdds,
                      provider: 'pinnacle'
                    }
                  });
              } catch (auditErr) {
                console.error(`[CaptureOdds Cron] Failed to write LINE_MOVED audit event for signal ${signal.id}:`, auditErr);
              }
            }
            
            capturedCount++;
          }
        } else {
          console.warn(`[CaptureOdds Cron] Could not find specific closing odds selection for signal ${signal.id}`);
        }
      }
    }

    await CronLogger.end(logId, capturedCount, null);
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[CaptureOdds Cron] Health check audit failed:', hcErr);
    }

    return NextResponse.json({ success: true, capturedCount });
  } catch (error: any) {
    console.error('[CaptureOdds Cron Fatal Error]:', error);
    await CronLogger.end(logId, 0, error);
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[CaptureOdds Cron] Health check audit failed:', hcErr);
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
