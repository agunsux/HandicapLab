import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { settleAsianHandicap } from '@/lib/engine/settlement';
import { CronLogger } from '@/lib/services/cronLogger';
import { runHealthCheck } from '@/lib/services/healthChecker';
import { apiFootballClient } from '@/lib/apis/apifootball';
import { LEAGUE_REGISTRY } from '@/lib/crons/leagueRegistry';
import { CLVCalculator } from '@/lib/settlement/clv-calculator';

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

          // Calculate CLV percentage
          const openingOdds = Number(signal.odds);
          const closingOdds = Number(signal.closing_odds);
          let clvPercentage = 0.0;
          if (closingOdds && closingOdds > 0 && openingOdds && openingOdds > 0) {
            clvPercentage = Number((((1.0 / closingOdds) - (1.0 / openingOdds)) * 100).toFixed(4));
          }

          // Finalise signal update
          await supabase
            .from('signals')
            .update({
              status,
              profit_loss,
              clv_percentage: clvPercentage,
              settled_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', signal.id);

          // Settle paper trade
          const { data: trade } = await supabase
            .from('paper_trades')
            .select('*')
            .eq('signal_id', signal.id)
            .maybeSingle();

          if (trade) {
            const stakeVal = Number(trade.stake || 10.0);
            const tradeProfit = stakeVal * profit_loss;
            const clvVal = CLVCalculator.calculate(openingOdds, closingOdds || null);

            await supabase
              .from('paper_trades')
              .update({
                result: status,
                profit: Number(tradeProfit.toFixed(2)),
                status: 'settled',
                clv: clvVal,
                updated_at: new Date().toISOString()
              })
              .eq('id', trade.id);
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

  return {
    signalsSettled,
    signalsFailed,
    message: 'Settlement pipeline and paper trading bankroll progression completed.'
  };
}
