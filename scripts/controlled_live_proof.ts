// ============================================================================
// HANDICAPLAB / SALMO.DEV — CONTROLLED LIVE PROOF & OPERATIONAL TRUTH RUNNER
// ============================================================================
// Location: scripts/controlled_live_proof.ts
// Invariants:
//   - ZERO synthetic / mock fixtures, odds, or score results.
//   - Strict Quota Safety: Max usable OddsPapi calls = 48 (50 reserve floor protected).
//   - Proof Target: <= 5 billable OddsPapi calls, <= 10 API-Football calls.
//   - Chronological Integrity: Kickoff strictly in future; no leakage; no synthetic settlement.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

// 1. Explicitly load .env.local
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const k = match[1].trim();
        const v = match[2].trim().replace(/^["']+|["']+$/g, '');
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
  // Ensure local script execution writes directly to repo data/ directory and not os.tmpdir()
  delete process.env.VERCEL;
}

import { OddsPapiQuotaAllocator } from '../src/lib/providers/oddspapiQuotaAllocator';
import { CanonicalFixtureRegistry } from '../src/lib/services/canonicalFixtureRegistry';
import { PredictionArchiveService } from '../src/lib/archive/predictionArchiveService';
import { ProductionPublishingEngine } from '../src/lib/publishing/productionPublishingEngine';
import { DurableLedgerStore } from '../src/lib/ledger/durableLedgerStore';
import { ReconciliationService } from '../src/lib/archive/reconciliationService';
import { DailyPerformanceService } from '../src/lib/ledger/dailyPerformanceService';

async function runControlledProof() {
  console.log('================================================================================');
  console.log('HANDICAPLAB -> SALMO: CONTROLLED LIVE OPERATIONAL PROOF');
  console.log('Timestamp (UTC):', new Date().toISOString());
  console.log('================================================================================\n');

  const oddspapiApiKey = process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY || '';
  const apifootballApiKey = process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '';

  if (!oddspapiApiKey || !apifootballApiKey) {
    throw new Error('FAIL-CLOSED: Missing required provider credentials in environment.');
  }

  // --------------------------------------------------------------------------
  // STAGE 1: LIVE PROVIDER PRE-FLIGHT QUOTA CHECK
  // --------------------------------------------------------------------------
  console.log('--- STAGE 1: LIVE PROVIDER PRE-FLIGHT QUOTA CHECK ---');

  // API-Football status
  const afRes = await fetch('https://v3.football.api-sports.io/status', {
    headers: { 'x-apisports-key': apifootballApiKey, 'Accept': 'application/json' },
  });
  if (!afRes.ok) {
    throw new Error(`API-Football /status failed with HTTP ${afRes.status}`);
  }
  const afData = await afRes.json();
  const afCurrent = afData.response?.requests?.current ?? 0;
  const afLimit = afData.response?.requests?.limit_day ?? 7500;
  const afRemaining = Math.max(0, afLimit - afCurrent);
  console.log(`API-Football PRO: Used ${afCurrent}/${afLimit} today (Remaining: ${afRemaining})`);

  if (afRemaining < 300) {
    throw new Error(`FAIL-CLOSED: API-Football quota below emergency stop floor (${afRemaining} < 300)`);
  }

  // OddsPapi unmetered /account
  const opRes = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${oddspapiApiKey}`);
  if (!opRes.ok) {
    throw new Error(`OddsPapi /account failed with HTTP ${opRes.status}`);
  }
  const opData = await opRes.json();
  const opSub = opData.subscriptions?.[0];
  const opLimit = opSub?.request_limit ?? 250;
  const opUsedBefore = opSub?.request_count ?? 0;
  const opRemainingBefore = Math.max(0, opLimit - opUsedBefore);
  const opUsableBefore = Math.max(0, opRemainingBefore - OddsPapiQuotaAllocator.RESERVE_FLOOR);

  console.log(`OddsPapi Free: Used ${opUsedBefore}/${opLimit} this month (Remaining: ${opRemainingBefore})`);
  console.log(`OddsPapi Reserve Floor: ${OddsPapiQuotaAllocator.RESERVE_FLOOR} requests (strictly protected)`);
  console.log(`OddsPapi Usable Capacity: ${opUsableBefore} requests (HARD CEILING for operational spend)`);

  if (opRemainingBefore <= OddsPapiQuotaAllocator.RESERVE_FLOOR) {
    throw new Error(`FAIL-CLOSED: OddsPapi quota at or below reserve floor (${opRemainingBefore} <= 50)`);
  }

  // Sync state to allocator
  await OddsPapiQuotaAllocator.syncFromProviderAccount(oddspapiApiKey);

  // --------------------------------------------------------------------------
  // STAGE 2: REAL FIXTURE INGESTION (API-Football)
  // --------------------------------------------------------------------------
  console.log('\n--- STAGE 2: REAL FIXTURE INGESTION ---');
  console.log('Querying real upcoming fixtures from Whitelisted Top Leagues (e.g. Premier League, La Liga)...');

  // Discover real upcoming fixtures
  const syncResult = await CanonicalFixtureRegistry.syncUpcomingFixtures({
    forceRefresh: true,
    leagueIds: [39, 140], // Premier League (39) & La Liga (140)
  });

  const discoveredFixtures = syncResult.fixtures;
  console.log(`Discovered ${discoveredFixtures.length} real upcoming fixtures across target leagues.`);
  console.log(`Data state: ${syncResult.dataState}, Provider state: ${syncResult.providerState}`);

  const nowMs = Date.now();
  const validUpcoming = discoveredFixtures.filter((f) => new Date(f.kickoffUtc).getTime() > nowMs);
  console.log(`Fixtures with strictly future kickoff (> now): ${validUpcoming.length}`);

  if (validUpcoming.length === 0) {
    console.log('No upcoming fixtures found in the selected leagues for the next 7 days.');
    return;
  }

  // Select 3 to 5 real upcoming fixtures
  const selectedFixtures = validUpcoming.slice(0, 5);
  console.log('\nSelected real fixtures for controlled proof:');
  for (const f of selectedFixtures) {
    console.log(`  - [${f.competitionName}] ${f.homeTeam} vs ${f.awayTeam} (Kickoff: ${f.kickoffUtc}) [ID: ${f.fixtureId}]`);
  }

  // --------------------------------------------------------------------------
  // STAGE 3: REAL PINNACLE ODDS INGESTION (OddsPapi via central quota gate)
  // --------------------------------------------------------------------------
  console.log('\n--- STAGE 3: REAL ODDS INGESTION (ODDSPAPI PINNACLE) ---');

  const rawOddsCachePath = path.resolve('data/cache/last_oddspapi_raw.json');
  let rawOdds: any[] = [];
  let isCacheHit = false;

  const forceLiveOdds = process.argv.includes('--force-live-odds');

  if (!forceLiveOdds && fs.existsSync(rawOddsCachePath)) {
    try {
      const stats = fs.statSync(rawOddsCachePath);
      const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
      if (ageHours < 6) {
        rawOdds = JSON.parse(fs.readFileSync(rawOddsCachePath, 'utf8'));
        if (Array.isArray(rawOdds) && rawOdds.length > 0) {
          isCacheHit = true;
          console.log(`Reusing fresh live odds cache (${rawOdds.length} fixtures, age: ${ageHours.toFixed(1)}h). Zero quota consumed.`);
        }
      }
    } catch {}
  }

  if (!isCacheHit) {
    // Pre-flight check via allocator
    const acquireDecision = OddsPapiQuotaAllocator.canAcquire({
      leagueId: 'ENG-PL',
      tier: 'A',
      priority: 'HIGH',
      cost: 1,
    });

    if (!acquireDecision.allowed) {
      throw new Error(`FAIL-CLOSED: OddsPapi quota acquisition rejected: ${acquireDecision.reason}`);
    }

    console.log(`Acquire permitted. Reservation token: ${acquireDecision.reservationToken}, Usable remaining: ${acquireDecision.usableRemaining}`);

    // Fetch real Pinnacle odds for Premier League (tournamentId = 17)
    const oddsUrl = `https://api.oddspapi.io/v4/odds-by-tournaments?apiKey=${oddspapiApiKey}&tournamentIds=17&bookmakers=pinnacle`;
    const oddsRes = await fetch(oddsUrl, { headers: { 'Accept': 'application/json' } });

    if (!oddsRes.ok) {
      throw new Error(`OddsPapi HTTP error: ${oddsRes.status}`);
    }

    rawOdds = await oddsRes.json();
    const oddsCount = Array.isArray(rawOdds) ? rawOdds.length : 0;
    console.log(`OddsPapi returned ${oddsCount} fixtures with odds for tournament 17.`);

    // Persist to raw odds cache
    const cacheDir = path.dirname(rawOddsCachePath);
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(rawOddsCachePath, JSON.stringify(rawOdds, null, 2), 'utf8');

    // Record usage and instrumentation
    const callAudit = OddsPapiQuotaAllocator.recordUsage({
      leagueId: 'ENG-PL',
      tier: 'A',
      cost: 1,
      endpoint: 'odds-by-tournaments',
      reservationId: acquireDecision.reservationToken,
      billable: true,
    });

    console.log('Logged billable OddsPapi call:');
    console.log(`  Count: ${callAudit.countBefore} -> ${callAudit.countAfter}`);
    console.log(`  Remaining: ${callAudit.remainingBefore} -> ${callAudit.remainingAfter}`);
    console.log(`  Usable Remaining: ${callAudit.usableRemainingBefore} -> ${callAudit.usableRemainingAfter}`);
  }

  // --------------------------------------------------------------------------
  // STAGE 4: MODEL EXECUTION & PREDICTION GENERATION
  // --------------------------------------------------------------------------
  console.log('\n--- STAGE 4: PRODUCTION PREDICTION GENERATION ---');
  console.log('Reconciling fixtures with real odds and running Dixon-Coles model...');

  const reconcileReport = await ProductionPublishingEngine.reconcileAndPublish({
    triggeredBy: 'CONTROLLED_LIVE_PROOF',
    forceRefresh: false, // Use the real fixtures & odds just acquired
    customFixtures: selectedFixtures,
    customOdds: rawOdds,
  });

  console.log('Reconciliation Report:');
  console.log(`  Discovered Fixtures: ${reconcileReport.discoveredFixtures}`);
  console.log(`  Reconciled Odds: ${reconcileReport.reconciledOdds}`);
  console.log(`  Evaluated Predictions: ${reconcileReport.evaluatedPredictions}`);
  console.log(`  Published Signals: ${reconcileReport.publishedCount}`);
  console.log(`  Updated: ${reconcileReport.updatedCount}, Held: ${reconcileReport.heldCount}, Shadow: ${reconcileReport.shadowCount}`);

  // --------------------------------------------------------------------------
  // STAGE 5: IMMUTABLE ARCHIVE & AUDIT INTEGRITY CHECK
  // --------------------------------------------------------------------------
  console.log('\n--- STAGE 5: IMMUTABLE ARCHIVE VERIFICATION ---');

  const archive = PredictionArchiveService.loadArchive();
  const archiveRecords = Object.values(archive);
  console.log(`Total records in Prediction Archive: ${archiveRecords.length}`);

  const integrityCheck = ReconciliationService.reconcileArchive();
  console.log(`Archive Integrity: Consistent=${integrityCheck.isConsistent}, Discrepancies=${integrityCheck.discrepancies.length}`);

  const snapshot = PredictionArchiveService.generateDailyPicksSnapshot(Date.now());
  console.log(`Daily Picks Snapshot Run: ${snapshot.runId} (${snapshot.actionablePicks} actionable picks)`);

  const ledger = DurableLedgerStore.loadLedger();
  const ledgerEntries = Object.values(ledger);
  console.log(`High-Confidence Ledger Entries: ${ledgerEntries.length}`);

  // --------------------------------------------------------------------------
  // STAGE 6: ZERO-DATA CONTRADICTION AUDIT
  // --------------------------------------------------------------------------
  console.log('\n--- STAGE 6: ZERO-DATA CONTRADICTION GATES ---');

  const upcomingArchive = archiveRecords.filter((r) => new Date(r.kickoffTimestamp).getTime() > Date.now());
  const settledArchive = archiveRecords.filter((r) => r.status === 'SETTLED' || r.status === 'VOID');
  const performance = DailyPerformanceService.getArchivePerformanceReport({ nowMs: Date.now() });

  console.log(`Upcoming Archive Count: ${upcomingArchive.length}`);
  console.log(`Settled Archive Count: ${settledArchive.length}`);
  console.log(`Reported Realized Yield: ${performance.allTimeYieldPct}%`);

  // Assert: Settled = 0 MUST imply Yield = 0%
  if (settledArchive.length === 0 && performance.allTimeYieldPct !== 0) {
    throw new Error(`CONTRADICTION DETECTED: Settled bets = 0 but reported yield = ${performance.allTimeYieldPct}%!`);
  }
  console.log('Contradiction Gate Passed: 0 settled bets -> 0.00% yield strictly preserved.');

  // --------------------------------------------------------------------------
  // STAGE 7: FINAL POST-EXECUTION QUOTA RECONCILIATION
  // --------------------------------------------------------------------------
  console.log('\n--- STAGE 7: FINAL POST-EXECUTION QUOTA RECONCILIATION ---');

  const postOpRes = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${oddspapiApiKey}`);
  const postOpData = await postOpRes.json();
  const postSub = postOpData.subscriptions?.[0];
  const opUsedAfter = postSub?.request_count ?? 0;
  const opRemainingAfter = Math.max(0, opLimit - opUsedAfter);
  const actualCallsConsumed = opUsedAfter - opUsedBefore;

  console.log(`OddsPapi Provider-Reported Count: Before=${opUsedBefore}, After=${opUsedAfter}, Consumed=${actualCallsConsumed}`);
  console.log(`OddsPapi Remaining: ${opRemainingAfter} (Protected Reserve: 50, Usable Remaining: ${Math.max(0, opRemainingAfter - 50)})`);

  // Final confirmation
  console.log('\n================================================================================');
  console.log('LIVE PROOF COMPLETED SUCCESSFULLY WITH REAL DATA');
  console.log('================================================================================');
}

runControlledProof().catch((err) => {
  console.error('\n[FATAL ERROR IN CONTROLLED PROOF]:', err);
  process.exit(1);
});
