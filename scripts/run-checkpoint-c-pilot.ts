import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

import { discoverGlobalLeagues, type GlobalLeague } from '../src/lib/config/leagueRegistry';
import { GlobalIngestionEngine } from '../src/lib/ingestion/globalIngestionEngine';
import { getQuotaSnapshot } from '../src/lib/providers/quotaManagerV4';

// Target Representative Pilot Set (15 diverse leagues)
const REPRESENTATIVE_LEAGUE_IDS = [
  39,  // Premier League (England, UEFA, Tier 1, Winter)
  140, // La Liga (Spain, UEFA, Tier 1, Winter)
  135, // Serie A (Italy, UEFA, Tier 1, Winter)
  78,  // Bundesliga (Germany, UEFA, Tier 1, Winter)
  61,  // Ligue 1 (France, UEFA, Tier 1, Winter)
  88,  // Eredivisie (Netherlands, UEFA, Tier 1, Winter)
  40,  // Championship (England, UEFA, Tier 2, Winter)
  98,  // J1 League (Japan, AFC, Tier 1, Summer/Calendar)
  292, // K League 1 (South Korea, AFC, Tier 1, Summer/Split)
  274, // Liga 1 (Indonesia, AFC, High Value / Research)
  71,  // Serie A (Brazil, CONMEBOL, Summer/Calendar)
  128, // Liga Profesional (Argentina, CONMEBOL)
  262, // Liga MX (Mexico, CONCACAF, Apertura/Clausura)
  103, // Eliteserien (Norway, UEFA, Summer/Calendar)
  179, // Premiership (Scotland, UEFA, Split-table)
];

async function main() {
  console.log('================================================================');
  console.log('CHECKPOINT C: CONTROLLED LIVE INGESTION PILOT');
  console.log('================================================================');

  // Step 1: Discover Canonical Leagues
  console.log('\n[Step 1] Loading Canonical Global League Registry...');
  const discovery = await discoverGlobalLeagues();
  console.log(`Discovered ${discovery.total} leagues across ${discovery.countries.length} countries.`);

  // Step 2: Select the 15 Representative Pilot Leagues
  const pilotLeagues: GlobalLeague[] = [];
  for (const id of REPRESENTATIVE_LEAGUE_IDS) {
    const found = discovery.leagues.find((l) => l.league_id === id);
    if (found) {
      pilotLeagues.push(found);
    } else {
      console.warn(`[Pilot Warning] League ID ${id} not found in catalog.`);
    }
  }

  console.log(`Selected ${pilotLeagues.length} representative pilot leagues for controlled ingestion:`);
  console.table(
    pilotLeagues.map((l) => ({
      ID: l.league_id,
      Name: l.name,
      Country: l.country,
      Tier: l.tier,
      Depth: l.historical_depth,
      Season: l.season,
      Odds: l.odds_availability,
    }))
  );

  // Step 3: Quota Pre-Check
  const quotaBefore = await getQuotaSnapshot('apifootball');
  console.log('\n[Step 2] Initial Quota State:');
  console.log({
    provider: quotaBefore?.provider ?? 'apifootball',
    mode: quotaBefore?.mode ?? 'NORMAL',
    hardLimit: quotaBefore?.hardLimit ?? 1500000,
    softLimit: quotaBefore?.softLimit ?? 1350000,
    consumed: quotaBefore?.consumed ?? 0,
    hardRemaining: quotaBefore?.hardRemaining ?? 1500000,
  });

  // Step 4: Execute Controlled Ingestion
  console.log('\n[Step 3] Executing Real Ingestion via GlobalIngestionEngine...');
  const engine = new GlobalIngestionEngine();
  const startTime = Date.now();

  const pilotResult = await engine.runControlledPilot(pilotLeagues, {
    maxLeagues: pilotLeagues.length,
    skipDatabaseSync: false,
  });

  const durationMs = Date.now() - startTime;

  // Step 5: Quota Post-Check
  const quotaAfter = await getQuotaSnapshot('apifootball');

  console.log('\n================================================================');
  console.log('PILOT EXECUTION COMPLETE');
  console.log('================================================================');
  console.log(`Duration: ${durationMs}ms`);
  console.log(`Total Pilot Leagues Processed: ${pilotResult.totalLeaguesProcessed}`);
  console.log(`Successful (RESEARCH_READY): ${pilotResult.successfulLeagues}`);
  console.log(`Partial: ${pilotResult.partialLeagues}`);
  console.log(`Failed: ${pilotResult.failedLeagues}`);
  console.log(`Total Fixtures Ingested: ${pilotResult.fixturesIngested}`);
  console.log(`Historical Matches: ${pilotResult.historicalMatches}`);
  console.log(`Upcoming Matches: ${pilotResult.upcomingMatches}`);
  console.log(`Quarantined Fixtures: ${pilotResult.quarantinedCount}`);
  console.log(`API Requests Consumed: ${pilotResult.requestsConsumed}`);
  console.log(`Hard Limit: ${quotaAfter?.hardLimit ?? 1500000}`);
  console.log(`Consumed: ${quotaAfter?.consumed ?? 'N/A'}`);
  console.log(`Hard Remaining: ${quotaAfter?.hardRemaining ?? 'N/A'}`);
  console.log(`Quota Mode: ${quotaAfter?.mode ?? 'NORMAL'}`);

  console.log('\n--- PER-LEAGUE SUMMARY ---');
  console.table(
    pilotResult.summaries.map((s) => ({
      ID: s.league_id,
      Name: s.league_name,
      Country: s.country,
      Fixtures: s.fixtures_ingested,
      Historical: s.historical_matches,
      Upcoming: s.upcoming_matches,
      Duplicates: s.duplicates_rejected,
      Quarantined: s.quarantined_count,
      State: s.state,
      RESULT_READY: s.readiness.RESULT_READY,
      AH_READY: s.readiness.AH_READY,
      OU_READY: s.readiness.OU_READY,
      BTTS_READY: s.readiness.BTTS_READY,
      ML_READY: s.readiness.ML_READY,
    }))
  );

  console.log('\n--- OBSERVABILITY METRICS ---');
  const metrics = engine.getObservabilityMetrics(discovery.leagues);
  console.log(metrics);
}

main().catch((err) => {
  console.error('Fatal pilot error:', err);
  process.exit(1);
});
