import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { supabase } from '../../../../lib/supabase.server';
import { settleAsianHandicap } from '@/lib/engine/settlement';
import { CronLogger } from '@/lib/services/cronLogger';
import { runHealthCheck } from '@/lib/services/healthChecker';
import { apiFootballClient } from '@/lib/apis/apifootball';
import { LEAGUE_REGISTRY } from '@/lib/crons/leagueRegistry';
import { CLVCalculator } from '@/lib/settlement/clv-calculator';
import { createSignalEvent } from '@/lib/alerts/events';
import { PerformanceAttribution } from '@/lib/intelligence/attribution';

function isTeamMatch(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase().replace(/[\s-_]/g, '');
  const n2 = name2.toLowerCase().replace(/[\s-_]/g, '');
  return n1.includes(n2) || n2.includes(n1);
}

function settleOverUnder(
  homeGoals: number,
  awayGoals: number,
  line: number,
  selection: 'over' | 'under',
  odds: number
) {
  const totalGoals = homeGoals + awayGoals;
  const dAdj = selection === 'over' ? (totalGoals - line) : (line - totalGoals);

  let status: string;
  let profit_loss: number;

  if (dAdj >= 0.5) {
    status = 'won';
    profit_loss = odds - 1.0;
  } else if (dAdj === 0.25) {
    status = 'half_win';
    profit_loss = 0.5 * (odds - 1.0);
  } else if (dAdj === 0.0) {
    status = 'push';
    profit_loss = 0.0;
  } else if (dAdj === -0.25) {
    status = 'half_loss';
    profit_loss = -0.5;
  } else {
    status = 'lost';
    profit_loss = -1.0;
  }

  return { status, profit_loss: Number(profit_loss.toFixed(4)) };
}

function settleMoneyline(
  homeGoals: number,
  awayGoals: number,
  selection: 'home' | 'draw' | 'away',
  odds: number
) {
  const actualML = homeGoals > awayGoals ? 'home' : homeGoals === awayGoals ? 'draw' : 'away';
  const won = selection === actualML;
  const status = won ? 'won' : 'lost';
  const profit_loss = won ? (odds - 1.0) : -1.0;
  return { status, profit_loss };
}

export async function GET(request: Request) {
  return handleSettle(request);
}

export async function POST(request: Request) {
  return handleSettle(request);
}

async function handleSettle(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const logId = await CronLogger.start('settle');
  let settledCount = 0;
  let failedCount = 0;

  try {
    const result = await runSignalsSettlement(logId);
    settledCount = result.signalsSettled;
    failedCount = result.signalsFailed;
    await CronLogger.end(logId, settledCount, null);
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[Settle Cron] Health check audit failed:', hcErr);
    }
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Signals settlement cron error:', error);
    await CronLogger.end(logId, settledCount, error);
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[Settle Cron] Health check audit failed:', hcErr);
    }
    return NextResponse.json({ error: error.message, settledCount, failedCount }, { status: 500 });
  }
}

async function runSignalsSettlement(logId: string | null) {
  console.log('[Settlement Cron] Starting signals settlement process...');

  const nowStr = new Date().toISOString();
  
  // 1. Fetch pending signals whose kickoff is in the past
  const { data: pendingSignals, error: fetchErr } = await supabase
    .from('signals')
    .select('*')
    .eq('status', 'pending')
    .lt('kickoff_utc', nowStr);

  if (fetchErr) {
    throw new Error(`Failed to fetch pending signals: ${fetchErr.message}`);
  }

  let signalsSettled = 0;
  let signalsFailed = 0;
  const settledCompetitionIds = new Set<number>();

  if (pendingSignals && pendingSignals.length > 0) {
    console.log(`[Settlement Cron] Found ${pendingSignals.length} pending past signals to process.`);

    // Group signals by league Config
    const signalsByLeague: Record<string, typeof pendingSignals> = {};
    for (const sig of pendingSignals) {
      if (!sig.league) continue;
      if (!signalsByLeague[sig.league]) {
        signalsByLeague[sig.league] = [];
      }
      signalsByLeague[sig.league].push(sig);
    }

    const fixturesCache = new Map<string, any[]>();

    for (const [leagueName, signals] of Object.entries(signalsByLeague)) {
      const leagueConfig = LEAGUE_REGISTRY.find(l => l.name === leagueName);
      if (!leagueConfig) {
        console.error(`[Settlement Cron] League config not found for league: ${leagueName}`);
        signalsFailed += signals.length;
        continue;
      }

      for (const signal of signals) {
        const kickoffDate = new Date(signal.kickoff_utc);
        const season = kickoffDate.getUTCFullYear();
        
        // Fetch and cache fixtures for this league and season
        const cacheKey = `${leagueConfig.apiFootballId}-${season}`;
        let fixtures = fixturesCache.get(cacheKey);
        if (!fixtures) {
          try {
            const fixturesResponse = await apiFootballClient.getFixtures(leagueConfig.apiFootballId, season);
            fixtures = fixturesResponse?.response || [];
            fixturesCache.set(cacheKey, fixtures);
          } catch (err) {
            console.error(`[Settlement Cron] Failed to fetch fixtures for league ${leagueName} season ${season}:`, err);
            signalsFailed++;
            continue;
          }
        }

        // Find matching fixture
        const fixture = fixtures.find((f: any) => {
          const homeMatches = isTeamMatch(f.teams.home.name, signal.home_team);
          const awayMatches = isTeamMatch(f.teams.away.name, signal.away_team);
          if (!homeMatches || !awayMatches) return false;

          const fKickoff = new Date(f.fixture.date).getTime();
          const sKickoff = kickoffDate.getTime();
          const diffHours = Math.abs(fKickoff - sKickoff) / (1000 * 60 * 60);
          return diffHours < 24;
        });

        if (!fixture) {
          console.warn(`[Settlement Cron] Match not found in API-Football for signal ${signal.id}: ${signal.home_team} vs ${signal.away_team} on ${signal.kickoff_utc}`);
          // Let it remain pending to retry next time
          continue;
        }

        const shortStatus = fixture.fixture.status.short;
        const elapsed = fixture.fixture.status.elapsed ?? 0;

        const isFinished = ['FT', 'AET', 'PEN'].includes(shortStatus);
        const isVoid = ['CANC', 'PST', 'ABD', 'SUSP', 'INT'].includes(shortStatus);

        if (!isFinished && !isVoid) {
          console.log(`[Settlement Cron] Match ${signal.home_team} vs ${signal.away_team} is not finished yet (status: ${shortStatus}, elapsed: ${elapsed}). Skipping.`);
          continue;
        }

        if (isFinished && elapsed < 90) {
          console.log(`[Settlement Cron] Match ${signal.home_team} vs ${signal.away_team} marked finished but elapsed ${elapsed} < 90. Skipping.`);
          continue;
        }

        // Concurrency Guard: Transition signal to 'settling'
        const { data: updatedSignal, error: updateStatusErr } = await supabase
          .from('signals')
          .update({ status: 'settling', updated_at: new Date().toISOString() })
          .eq('id', signal.id)
          .eq('status', 'pending')
          .select()
          .maybeSingle();

        if (updateStatusErr || !updatedSignal) {
          console.log(`[Settlement Cron] Signal ${signal.id} is already being settled. Skipping.`);
          continue;
        }

        try {
          const isFulltimeValid = fixture.score?.fulltime?.home !== null && 
                                  fixture.score?.fulltime?.away !== null && 
                                  fixture.score?.fulltime?.home !== undefined && 
                                  fixture.score?.fulltime?.away !== undefined;

          const homeGoals = isFulltimeValid ? Number(fixture.score.fulltime.home) : Number(fixture.goals.home ?? 0);
          const awayGoals = isFulltimeValid ? Number(fixture.score.fulltime.away) : Number(fixture.goals.away ?? 0);
          const settlementSource = isFulltimeValid ? 'REGULAR_TIME' : 'GOALS_FALLBACK';

          // Update matches table if not already updated
          if (isFinished) {
            await supabase
              .from('matches')
              .update({
                home_goals: homeGoals,
                away_goals: awayGoals,
                ht_home_goals: fixture.score?.halftime?.home,
                ht_away_goals: fixture.score?.halftime?.away,
                status: 'finished',
                updated_at: new Date().toISOString()
              })
              .eq('id', signal.match_id);

            // Log match result snapshot to match_results
            const finalScore = {
              home: homeGoals,
              away: awayGoals,
              halftime: {
                home: fixture.score?.halftime?.home,
                away: fixture.score?.halftime?.away
              },
              fulltime: {
                home: fixture.score?.fulltime?.home,
                away: fixture.score?.fulltime?.away
              }
            };
            await supabase
              .from('match_results')
              .upsert({
                match_id: String(signal.match_id),
                final_score: finalScore,
                verified_source: 'api-football',
                verified_at: new Date().toISOString()
              }, { onConflict: 'match_id' });

            if (leagueConfig?.apiFootballId) {
              settledCompetitionIds.add(leagueConfig.apiFootballId);
            }
          } else if (isVoid) {
            await supabase
              .from('matches')
              .update({
                status: 'void',
                updated_at: new Date().toISOString()
              })
              .eq('id', signal.match_id);
          }

          let status = 'lost';
          let profit_loss = -1.0;

          if (isVoid) {
            status = 'void';
            profit_loss = 0.0;
          } else {
            console.log(`[Settlement Cron] Settle signal ${signal.id} (${signal.market}) using goals: ${homeGoals}-${awayGoals} (source: ${settlementSource})`);
            const odds = Number(signal.odds || 1.0);
            const selection = (signal.selection || 'home').toLowerCase();
            const market = (signal.market || '').toLowerCase();
            const line = Number(signal.handicap_line || 0.0);

            if (market === 'asian_handicap') {
              const ahResult = settleAsianHandicap(homeGoals, awayGoals, line, selection as 'home' | 'away', odds);
              status = ahResult.status.toLowerCase();
              profit_loss = ahResult.profit_units;
              if (status === 'push') status = 'void'; // Normalise push/void in signals table
            } else if (market === 'over_under') {
              const ouResult = settleOverUnder(homeGoals, awayGoals, line, selection as 'over' | 'under', odds);
              status = ouResult.status.toLowerCase();
              profit_loss = ouResult.profit_loss;
              if (status === 'push') status = 'void';
            } else {
              // Moneyline
              const mlResult = settleMoneyline(homeGoals, awayGoals, selection as 'home' | 'draw' | 'away', odds);
              status = mlResult.status.toLowerCase();
              profit_loss = mlResult.profit_loss;
            }
          }

          // Calculate detailed CLV
          const openingOdds = Number(signal.odds || 1.90);
          const closingOdds = Number(signal.closing_odds) || openingOdds;
          const openingLine = Number(signal.handicap_line || 0.0);
          const closingLine = Number(signal.closing_line !== null && signal.closing_line !== undefined ? signal.closing_line : openingLine);
          
          let marketType: 'ML' | 'AH' | 'OU' = 'ML';
          const dbMarket = (signal.market || '').toLowerCase();
          if (dbMarket === 'asian_handicap') {
            marketType = 'AH';
          } else if (dbMarket === 'over_under') {
            marketType = 'OU';
          }

          const clvResult = CLVCalculator.calculateDetailed(
            marketType,
            signal.selection || 'home',
            openingLine,
            openingOdds,
            closingLine,
            closingOdds
          );

          // Finalise signal update
          await supabase
            .from('signals')
            .update({
              status,
              profit_loss,
              closing_reference_book: 'PINNACLE',
              closing_line: closingLine,
              closing_price: closingOdds,
              closing_timestamp: new Date().toISOString(),
              clv_status: 'calculated',
              clv_score: clvResult.clv_score,
              clv_percentage: clvResult.clv_percentage,
              clv_category: clvResult.clv_category,
              line_clv: clvResult.line_clv,
              price_clv: clvResult.price_clv,
              total_clv: clvResult.total_clv,
              closing_market_snapshot: {
                handicap: closingLine,
                price: closingOdds,
                bookmaker: 'PINNACLE'
              },
              closing_capture_time: new Date().toISOString(),
              market_movement: {
                opening_odds: openingOdds,
                closing_odds: closingOdds,
                delta: Number((closingOdds - openingOdds).toFixed(4))
              },
              settled_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', signal.id);

          try {
            await createSignalEvent(signal.id, 'SIGNAL_CLOSED', {
              status,
              profit_loss
            });
          } catch (eventErr) {
            console.error(`[Settlement Cron] Failed to log SIGNAL_CLOSED event for ${signal.id}:`, eventErr);
          }

          // Log performance attribution and model calibration
          try {
            const actualProb = status === 'won' ? 1.0 : (status === 'lost' ? 0.0 : 0.5);
            const predictedProb = Number(signal.predicted_probability !== null && signal.predicted_probability !== undefined ? signal.predicted_probability : (signal.probability || 0.5));
            const calibratedProb = Number(signal.calibrated_probability !== null && signal.calibrated_probability !== undefined ? signal.calibrated_probability : predictedProb);
            const calibError = Math.abs(calibratedProb - actualProb);

            // Log performance attribution record
            await PerformanceAttribution.logAttribution(signal, status, profit_loss, clvResult.clv_percentage / 100);

            // Log model calibration history record (blocked if model validation mode is active)
            if (process.env.MODEL_VALIDATION_MODE !== 'true') {
              await supabase
                .from('model_calibration_history')
                .insert({
                  signal_id: signal.id,
                  model_probability: predictedProb,
                  actual_result: actualProb,
                  calibration_error: Number(calibError.toFixed(4))
                });
            } else {
              console.log('[Settlement Cron] MODEL_VALIDATION_MODE active: skipping automatic calibration history recording.');
            }
          } catch (intelErr) {
            console.error(`[Settlement Cron] Failed to log intelligence metrics for ${signal.id}:`, intelErr);
          }

          // Log SIGNAL_SETTLED audit event (with transaction safety)
          try {
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
              console.error(`[Settle Route] Failed to fetch correlation ID for signal ${signal.id}:`, err);
            }
            const activeCorrId = correlationId || crypto.randomUUID();

            await supabase
              .from('signal_audit_events')
              .insert({
                signal_id: signal.id,
                event_type: 'SIGNAL_SETTLED',
                source: 'settlement_cron',
                correlation_id: activeCorrId,
                payload: {
                  result: status,
                  pnl: profit_loss,
                  roi: Number((profit_loss * 100).toFixed(2)),
                  closing_line: closingLine,
                  clv: clvResult.clv_percentage
                }
              });
          } catch (auditErr) {
            console.error(`[Settle Route] Failed to write SIGNAL_SETTLED audit event for signal ${signal.id}:`, auditErr);
          }

          // Settle public prediction ledger (Settlement only updates result fields)
          const ledgerStatus = status === 'win' ? 'won' : status === 'half_win' ? 'won' : status === 'half_loss' ? 'lost' : status;
          const { data: ledgerEntry } = await supabase
            .from('prediction_ledger')
            .update({
              result_status: ledgerStatus,
              settled_at: new Date().toISOString(),
              roi: Number((profit_loss * 100).toFixed(2)),
              verified: true,
              updated_at: new Date().toISOString()
            })
            .eq('match_id', String(signal.match_id))
            .eq('market', signal.market)
            .select('id')
            .maybeSingle();

          // Settle paper trade
          const ledgerId = ledgerEntry?.id;
          let tradeResult = null;
          if (ledgerId) {
            const { data } = await supabase
              .from('paper_trades')
              .select('*')
              .eq('prediction_ledger_id', ledgerId)
              .maybeSingle();
            tradeResult = data;
          }

          if (tradeResult) {
            const entryOdds = Number(tradeResult.entry_odds || tradeResult.opening_odds || tradeResult.odds || 1.90);
            const stakeUnits = Number(tradeResult.stake_units || 1.0);
            
            let pnlUnits = -1.0 * stakeUnits;
            if (ledgerStatus === 'won') {
              pnlUnits = stakeUnits * (entryOdds - 1.0);
            } else if (ledgerStatus === 'void') {
              pnlUnits = 0.0;
            } else if (status === 'half_win') {
              pnlUnits = stakeUnits * 0.5 * (entryOdds - 1.0);
            } else if (status === 'half_loss') {
              pnlUnits = stakeUnits * -0.5;
            }

            const clvVal = CLVCalculator.calculate(openingOdds, closingOdds || null);

            await supabase
              .from('paper_trades')
              .update({
                result: status,
                profit: Number((pnlUnits * 10.0).toFixed(2)),
                status: ledgerStatus.toUpperCase(),
                clv: clvVal,
                // New Engine v2 columns:
                closing_odds: closingOdds || null,
                pnl_units: Number(pnlUnits.toFixed(4)),
                clv_percentage: clvVal,
                settled_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', tradeResult.id);
          }

          signalsSettled++;
        } catch (settleError) {
          console.error(`[Settlement Cron] Failed to settle signal ${signal.id}:`, settleError);
          // Rollback signal status to pending so it can be retried
          await supabase
            .from('signals')
            .update({ status: 'pending', updated_at: new Date().toISOString() })
            .eq('id', signal.id);
          signalsFailed++;
        }
      }
    }
  }

  // Recalculate running bankroll and drawdowns chronologically for all settled paper trades
  const { data: settledTrades, error: tradesErr } = await supabase
    .from('paper_trades')
    .select('id, profit, created_at')
    .eq('status', 'settled')
    .order('created_at', { ascending: true });

  if (tradesErr) {
    console.error('[Settlement Cron] Failed to fetch settled trades for bankroll calculation:', tradesErr);
  } else if (settledTrades && settledTrades.length > 0) {
    const { data: config } = await supabase
      .from('paper_trading_config')
      .select('starting_bankroll')
      .limit(1)
      .maybeSingle();
    const startingBankroll = config?.starting_bankroll ? Number(config.starting_bankroll) : 1000.0;

    let runningBankroll = startingBankroll;
    let peakBankroll = startingBankroll;

    for (const trade of settledTrades) {
      const profit = Number(trade.profit || 0.0);
      runningBankroll += profit;

      if (runningBankroll > peakBankroll) {
        peakBankroll = runningBankroll;
      }

      const drawdown = peakBankroll > 0 ? ((peakBankroll - runningBankroll) / peakBankroll) * 100 : 0.0;

      await supabase
        .from('paper_trades')
        .update({
          bankroll_after: Number(runningBankroll.toFixed(2)),
          drawdown: Number(drawdown.toFixed(2)),
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id);
    }
  }

  // Recalculate competition calibration metrics for all settled leagues
  for (const compId of settledCompetitionIds) {
    try {
      await recalculateCompetitionMetrics(compId);
    } catch (metricErr) {
      console.error(`[Settlement Cron] Failed to recalculate metrics for competition ${compId}:`, metricErr);
    }
  }

  return {
    signalsSettled,
    signalsFailed,
    tradesCalculated: settledTrades ? settledTrades.length : 0,
    message: 'Settlement pipeline and paper trading bankroll progression completed.'
  };
}

async function recalculateCompetitionMetrics(competitionId: number) {
  const { LEAGUE_REGISTRY } = await import('@/lib/crons/leagueRegistry');
  const leagueConfig = LEAGUE_REGISTRY.find(l => l.apiFootballId === competitionId);
  if (!leagueConfig) return;

  const { data: signals, error: sigErr } = await supabase
    .from('signals')
    .select('*')
    .eq('league', leagueConfig.name)
    .not('status', 'in', '("pending", "settling")');

  if (sigErr || !signals) {
    console.error(`[Metrics Recalculate] Failed to fetch signals for ${leagueConfig.name}:`, sigErr);
    return;
  }

  const total = signals.length;
  if (total === 0) return;

  const wins = signals.filter((s: any) => s.status === 'won').length;
  const predictionAccuracy = (wins / total) * 100;

  const totalPL = signals.reduce((sum: number, s: any) => sum + Number(s.profit_loss || 0.0), 0.0);
  const roiSimulation = (totalPL / total) * 100;

  const clvPositive = signals.filter((s: any) => Number(s.clv_percentage || 0.0) > 0).length;
  const closingLineAccuracy = (clvPositive / total) * 100;

  const ahSignals = signals.filter((s: any) => s.market === 'asian_handicap');
  const ouSignals = signals.filter((s: any) => s.market === 'over_under');

  const handicapAccuracy = ahSignals.length > 0 ? (ahSignals.filter((s: any) => s.status === 'won').length / ahSignals.length) * 100 : null;
  const overUnderAccuracy = ouSignals.length > 0 ? (ouSignals.filter((s: any) => s.status === 'won').length / ouSignals.length) * 100 : null;
  const bttsAccuracy = predictionAccuracy; // Fallback

  let sampleConfidence = 'low';
  if (total >= 100) {
    sampleConfidence = 'high';
  } else if (total >= 30) {
    sampleConfidence = 'medium';
  }

  await supabase
    .from('competition_metrics')
    .upsert({
      competition_id: competitionId,
      matches_count: total,
      prediction_accuracy: predictionAccuracy,
      roi_simulation: roiSimulation,
      closing_line_accuracy: closingLineAccuracy,
      over25_accuracy: overUnderAccuracy,
      btts_accuracy: bttsAccuracy,
      handicap_accuracy: handicapAccuracy,
      sample_confidence: sampleConfidence,
      last_calculated_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'competition_id' });
}
