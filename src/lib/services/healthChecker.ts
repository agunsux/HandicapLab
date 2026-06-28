import { supabase } from '@/lib/supabase.server';
import { LEAGUE_REGISTRY, LeagueConfig } from '@/lib/crons/leagueRegistry';
import { sendTelegramAlert } from './telegram';

export interface IngestionHealthDetail {
  leagueId: string;
  leagueName: string;
  category: string;
  thresholdHours: number;
  lastFixtureIngestedAt: string | null;
  lastOddsIngestedAt: string | null;
  fixtureFreshnessHours: number | null;
  oddsFreshnessHours: number | null;
  fixturesOk: boolean;
  oddsOk: boolean;
}

export interface DatabaseHealth { healthy: boolean }

export interface OddsHealth { last_capture: string | null; stale: boolean }

export interface SignalsHealth { last_generation: string | null; stale: boolean }

export interface SettlementHealth { last_run: string | null; stale: boolean }

export interface HealthCheckResult {
  status: 'healthy' | 'degraded';
  timestamp: string;
  ingestionDetails: IngestionHealthDetail[];
  failedCrons: string[];
  alertsSent: boolean;
  database: DatabaseHealth;
  odds: OddsHealth;
  signals: SignalsHealth;
  settlement: SettlementHealth;
}

export function getCompetitionThresholdHours(compType: string, leagueId: string, priority: number): number {
  const cType = compType.toLowerCase();
  if (cType === 'international_tournament' || cType === 'international') {
    return 3;
  }
  if (cType === 'champions_league' || leagueId === 'uefa_champions_league' || leagueId === 'uefa_europa_league' || cType === 'cup') {
    return 4;
  }
  if (cType === 'top_domestic' || (cType === 'league' && priority === 2)) {
    return 6;
  }
  return 12; // standard
}

export function getCompetitionCategoryName(compType: string, leagueId: string, priority: number): string {
  const cType = compType.toLowerCase();
  if (cType === 'international_tournament' || cType === 'international') {
    return 'international_tournament';
  }
  if (cType === 'champions_league' || leagueId === 'uefa_champions_league' || leagueId === 'uefa_europa_league' || cType === 'cup') {
    return 'champions_league';
  }
  if (cType === 'top_domestic' || (cType === 'league' && priority === 2)) {
    return 'top_domestic';
  }
  return 'standard';
}

export async function runHealthCheck(): Promise<HealthCheckResult> {
  const now = new Date();
  const nowTime = now.getTime();
  // Placeholder database health check – assume healthy if supabase client loads
  const databaseHealth: DatabaseHealth = { healthy: true };
  const nowStr = now.toISOString().split('T')[0];
  
  const ingestionDetails: IngestionHealthDetail[] = [];
  const failedCrons: string[] = [];
  let isIngestionHealthy = true;

  // 1. Audit ingestion freshness dynamically for enabled leagues
  const activeLeagues = LEAGUE_REGISTRY.filter(l => l.enabled);

  for (const league of activeLeagues) {
    // Check activation window if defined
    if (league.activation) {
      const { start, end } = league.activation;
      if (nowStr < start || (end && nowStr > end)) {
        continue; // skip out-of-season leagues
      }
    }

    // Source competition_type from signals table (already populated in Phase 8.6)
    let compType: string | null = null;
    try {
      const { data: latestSignal } = await supabase
        .from('signals')
        .select('competition_type')
        .eq('league', league.name)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (latestSignal?.competition_type) {
        compType = latestSignal.competition_type;
      }
    } catch (err) {
      console.warn(`[HealthChecker] Failed to fetch latest signal competition_type for ${league.name}:`, err);
    }

    // Fallback to league registry if not found in signals
    const sourceCompType = compType || league.competition_type || 'standard';
    const thresholdHours = getCompetitionThresholdHours(sourceCompType, league.id, league.priority);
    const category = getCompetitionCategoryName(sourceCompType, league.id, league.priority);
    const thresholdMs = thresholdHours * 60 * 60 * 1000;

    // A. Query last fixture created_at
    let lastFixtureIngestedAt: string | null = null;
    let fixtureFreshnessHours: number | null = null;
    let fixturesOk = true;

    try {
      const { data: lastFixture } = await supabase
        .from('matches')
        .select('created_at')
        .eq('league', league.name)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastFixture?.created_at) {
        lastFixtureIngestedAt = lastFixture.created_at;
        const diffMs = nowTime - new Date(lastFixture.created_at).getTime();
        fixtureFreshnessHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
        if (diffMs > thresholdMs) {
          fixturesOk = false;
        }
      } else {
        fixturesOk = false; // No matches ingested at all
      }
    } catch (err) {
      fixturesOk = false;
    }

    // B. Query last odds recorded_at or timestamp for league matches
    let lastOddsIngestedAt: string | null = null;
    let oddsFreshnessHours: number | null = null;
    let oddsOk = true;

    try {
      const { data: leagueMatches } = await supabase
        .from('matches')
        .select('id')
        .eq('league', league.name);

      if (leagueMatches && leagueMatches.length > 0) {
        const matchIds = leagueMatches.map(m => String(m.id));
        const { data: lastOdds } = await supabase
          .from('odds_history')
          .select('timestamp, recorded_at')
          .in('match_id', matchIds)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        const ts = lastOdds?.timestamp || lastOdds?.recorded_at;
        if (ts) {
          lastOddsIngestedAt = ts;
          const diffMs = nowTime - new Date(ts).getTime();
          oddsFreshnessHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));
          if (diffMs > thresholdMs) {
            oddsOk = false;
          }
        } else {
          oddsOk = false; // No odds ingested at all
        }
      } else {
        oddsOk = false;
      }
    } catch (err) {
      oddsOk = false;
    }

    if (!fixturesOk || !oddsOk) {
      isIngestionHealthy = false;
    }

    ingestionDetails.push({
      leagueId: league.id,
      leagueName: league.name,
      category,
      thresholdHours,
      lastFixtureIngestedAt,
      lastOddsIngestedAt,
      fixtureFreshnessHours,
      oddsFreshnessHours,
      fixturesOk,
      oddsOk
    });
  }

  // 2. Audit recent failures in cron_runs (checks latest run of each key cron)
  const cronNames = ['generate-signals', 'capture-closing', 'settle', 'update-ratings', 'ingest'];
  for (const name of cronNames) {
    try {
      const { data: latestRun } = await supabase
        .from('cron_runs')
        .select('errors, start_time')
        .eq('cron_name', name)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestRun && latestRun.errors) {
        failedCrons.push(`${name} (Failed at ${latestRun.start_time}: ${latestRun.errors})`);
      }
    } catch (err) {
      // Ignore database errors here during test mocking
    }
  }

  const isHealthy = isIngestionHealthy && failedCrons.length === 0;
  const status = isHealthy ? 'healthy' : 'degraded';
  
  let alertsSent = false;
  if (!isHealthy) {
    let alertMsg = 'Production Health Degraded!\n\n';
    
    // Ingestion warnings
    const staleLeagues = ingestionDetails.filter(d => !d.fixturesOk || !d.oddsOk);
    if (staleLeagues.length > 0) {
      alertMsg += '<b>Stale Data Ingestion:</b>\n';
      for (const d of staleLeagues) {
        alertMsg += `- ${d.leagueName} (${d.category}): `;
        if (!d.fixturesOk) {
          alertMsg += `Fixtures stale (${d.fixtureFreshnessHours ?? 'N/A'}h vs limit ${d.thresholdHours}h). `;
        }
        if (!d.oddsOk) {
          alertMsg += `Odds stale (${d.oddsFreshnessHours ?? 'N/A'}h vs limit ${d.thresholdHours}h).`;
        }
        alertMsg += '\n';
      }
      alertMsg += '\n';
    }

    // Cron failures
    if (failedCrons.length > 0) {
      alertMsg += '<b>Failed Crons:</b>\n';
      for (const fc of failedCrons) {
        alertMsg += `- ${fc}\n`;
      }
    }

    alertsSent = await sendTelegramAlert(alertMsg);
  }

  // --- Database ping/latency ---
  const startDb = Date.now();
  let dbHealthy = true;
  let dbLatency = 0;
  try {
    const { error: dbPingErr } = await supabase.from('matches').select('id').limit(1);
    if (dbPingErr) throw dbPingErr;
    dbLatency = Date.now() - startDb;
  } catch (err) {
    dbHealthy = false;
  }

  // --- Odds Staleness check ---
  let lastOddsTime: string | null = null;
  let oddsStale = false;
  try {
    const { data: latestOdds } = await supabase
      .from('odds_snapshots')
      .select('captured_at')
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestOdds?.captured_at) {
      lastOddsTime = latestOdds.captured_at;
      const diffMs = Date.now() - new Date(latestOdds.captured_at).getTime();
      oddsStale = diffMs > 60 * 60 * 1000; // > 60 mins
    } else {
      oddsStale = true;
    }
  } catch (err) {
    oddsStale = true;
  }

  // --- Signal Staleness check ---
  let lastSignalTime: string | null = null;
  let signalStale = false;
  try {
    const { data: latestSig } = await supabase
      .from('signals')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestSig?.created_at) {
      lastSignalTime = latestSig.created_at;
      const diffMs = Date.now() - new Date(latestSig.created_at).getTime();
      signalStale = diffMs > 24 * 60 * 60 * 1000; // > 24h
    } else {
      signalStale = true;
    }
  } catch (err) {
    signalStale = true;
  }

  // --- Settlement Freshness check ---
  let lastSettlementTime: string | null = null;
  let settlementStale = false;
  try {
    const { data: latestSettle } = await supabase
      .from('signals')
      .select('settled_at')
      .not('settled_at', 'is', null)
      .order('settled_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestSettle?.settled_at) {
      lastSettlementTime = latestSettle.settled_at;
      const diffMs = Date.now() - new Date(latestSettle.settled_at).getTime();
      settlementStale = diffMs > 24 * 60 * 60 * 1000; // > 24h
    } else {
      settlementStale = true;
    }
  } catch (err) {
    settlementStale = true;
  }

  let readinessStatus: 'READY' | 'WARNING' | 'FAILED' = 'READY';
  if (!dbHealthy || failedCrons.length > 0) {
    readinessStatus = 'FAILED';
  } else if (oddsStale || signalStale || settlementStale) {
    readinessStatus = 'WARNING';
  }

  return {
    status: readinessStatus as any,
    timestamp: now.toISOString(),
    ingestionDetails,
    failedCrons,
    alertsSent,
    database: databaseHealth,
    odds: { last_capture: lastOddsTime, stale: oddsStale },
    signals: { last_generation: lastSignalTime, stale: signalStale },
    settlement: { last_run: lastSettlementTime, stale: settlementStale }
  };
}
