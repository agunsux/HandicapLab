import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { oddsApiClient } from '@/lib/apis/oddspapi';
import { CronLogger } from '@/lib/services/cronLogger';
import { runHealthCheck } from '@/lib/services/healthChecker';

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
  return handleCaptureClosing(request);
}

export async function POST(request: Request) {
  return handleCaptureClosing(request);
}

async function handleCaptureClosing(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const logId = await CronLogger.start('capture-closing');

  const now = new Date();
  const rangeStart = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const rangeEnd = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

  console.log(`[CaptureClosing Cron] Checking for pending signals kickoff in range: [${rangeStart}, ${rangeEnd}]`);

  try {
    // 1. Fetch pending signals starting in next 15 minutes
    const { data: pendingSignals, error: fetchErr } = await supabase
      .from('signals')
      .select('*')
      .eq('status', 'pending')
      .gte('kickoff_utc', rangeStart)
      .lte('kickoff_utc', rangeEnd);

    if (fetchErr) {
      throw new Error(`Failed to fetch pending signals for closing capture: ${fetchErr.message}`);
    }

    if (!pendingSignals || pendingSignals.length === 0) {
      console.log('[CaptureClosing Cron] No pending signals starting in the next 15 minutes.');
      return NextResponse.json({ success: true, capturedCount: 0 });
    }

    console.log(`[CaptureClosing Cron] Found ${pendingSignals.length} pending signals to capture closing odds for.`);

    // 2. Fetch league configs to resolve sport keys
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
        console.error(`[CaptureClosing Cron] Failed to fetch closing odds for ${sportKey}:`, err);
        continue;
      }

      for (const signal of signals) {
        const matchOdds = oddsList.find(o => isTeamMatch(o.home_team, signal.home_team) && isTeamMatch(o.away_team, signal.away_team));
        if (!matchOdds) {
          console.warn(`[CaptureClosing Cron] Match not found in odds list for signal ${signal.id}: ${signal.home_team} vs ${signal.away_team}`);
          continue;
        }

        const pinnacle = matchOdds.bookmakers.find((b: any) => b.key === 'pinnacle');
        if (!pinnacle) {
          console.warn(`[CaptureClosing Cron] Pinnacle bookmaker not found in odds for match: ${signal.home_team} vs ${signal.away_team}`);
          continue;
        }

        let closingOdds: number | undefined;

        if (signal.market === 'moneyline') {
          const h2hMarket = pinnacle.markets.find((m: any) => m.key === 'h2h');
          if (h2hMarket) {
            const outcome = h2hMarket.outcomes.find((o: any) => {
              if (signal.selection === 'home') return isTeamMatch(o.name, signal.home_team);
              if (signal.selection === 'away') return isTeamMatch(o.name, signal.away_team);
              return o.name.toLowerCase() === 'draw';
            });
            if (outcome) {
              closingOdds = outcome.price;
            }
          }
        } else if (signal.market === 'asian_handicap') {
          const spreadsMarket = pinnacle.markets.find((m: any) => m.key === 'spreads');
          if (spreadsMarket) {
            const outcome = spreadsMarket.outcomes.find((o: any) => {
              const isHome = isTeamMatch(o.name, signal.home_team);
              const lineVal = o.point;
              const expectedLine = isHome ? lineVal : -lineVal;
              const expectedSelection = isHome ? 'home' : 'away';
              return Math.abs(expectedLine - Number(signal.handicap_line)) < 0.001 && expectedSelection === signal.selection;
            });
            if (outcome) {
              closingOdds = outcome.price;
            }
          }
        } else if (signal.market === 'over_under') {
          const totalsMarket = pinnacle.markets.find((m: any) => m.key === 'totals');
          if (totalsMarket) {
            const outcome = totalsMarket.outcomes.find((o: any) => {
              const isOver = o.name.toLowerCase() === 'over';
              const expectedSelection = isOver ? 'over' : 'under';
              return Math.abs(o.point - Number(signal.handicap_line)) < 0.001 && expectedSelection === signal.selection;
            });
            if (outcome) {
              closingOdds = outcome.price;
            }
          }
        }

        if (closingOdds !== undefined && closingOdds > 1.0) {
          const closingProbability = Number((1.0 / closingOdds).toFixed(4));
          const { error: updateErr } = await supabase
            .from('signals')
            .update({
              closing_odds: closingOdds,
              closing_probability: closingProbability,
              updated_at: new Date().toISOString()
            })
            .eq('id', signal.id);

          if (updateErr) {
            console.error(`[CaptureClosing Cron] Failed to update signal ${signal.id} with closing odds:`, updateErr);
          } else {
            console.log(`[CaptureClosing Cron] Updated signal ${signal.id} with closing odds: ${closingOdds}`);
            capturedCount++;
          }
        } else {
          console.warn(`[CaptureClosing Cron] Could not find specific closing odds selection for signal ${signal.id}`);
        }
      }
    }

    await CronLogger.end(logId, capturedCount, null);
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[CaptureClosing Cron] Health check audit failed:', hcErr);
    }

    return NextResponse.json({ success: true, capturedCount });
  } catch (error: any) {
    console.error('[CaptureClosing Cron Fatal Error]:', error);
    await CronLogger.end(logId, 0, error);
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[CaptureClosing Cron] Health check audit failed:', hcErr);
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
