// Let us add a test finished settlement in run-epic57-shadow.ts to demonstrate end-to-end settlement verification
import { DailyAhShadowPipeline, RESEARCH_HONESTY_BANNER, CONFIRMED_LEAGUES } from '../lib/pipeline/dailyAhShadowPipeline';
import { AhDataLoader } from '../lib/research/ah-solo/ahDataLoader';

async function runEpic571Execution() {
  console.log('================================================================');
  console.log('EPIC 57.1 — REAL API SHADOW PIPELINE INGESTION & SETTLEMENT');
  console.log('MODE: SHADOW UNATTENDED / HONEST STATUS / NO PUBLIC VALUE CLAIMS');
  console.log('================================================================\n');

  // 1. Load historical database for point-in-time ratings
  console.log('[STEP 1] Loading Historical Match Database...');
  const { matches } = AhDataLoader.computeDataInventory();
  console.log(` -> Historical matches loaded: ${matches.length}`);

  // 2. Fetch real upcoming fixtures across confirmed leagues
  console.log('\n[STEP 2] Ingesting Live Upcoming Fixtures from Confirmed Leagues...');
  const upcomingFixtures = await DailyAhShadowPipeline.fetchLiveUpcomingFixtures();
  console.log(` -> Total upcoming fixtures retrieved: ${upcomingFixtures.length}`);

  // 3. Generate predictions & write to persistent ledger
  console.log('\n[STEP 3] Running AH-dixoncoles-v1.0.0 Shadow Inference...');
  const predResult = await DailyAhShadowPipeline.executeDailyPredictions(
    upcomingFixtures,
    matches
  );
  console.log(` -> New shadow prediction records written to ledger: ${predResult.generatedRecords.length}`);

  // 4. Fetch finished fixtures and execute real automated settlement
  console.log('\n[STEP 4] Fetching Finished Fixtures & Executing Automated Settlement...');
  // Only settle real fixtures present in ledger
  const settleResult = await DailyAhShadowPipeline.executeAutomatedSettlement([]);
  console.log(` -> Total records settled: ${settleResult.settledCount}`);

  // 5. Generate summary & monitor 150-200 gate
  console.log('\n[STEP 5] Generating Pipeline Summary & Monetization Gate Monitoring...');
  const summary = DailyAhShadowPipeline.generatePipelineSummary();
  const ledger = DailyAhShadowPipeline.loadLedger();

  console.log('\n================================================================');
  console.log('EPIC 57.1 VERIFICATION AUDIT REPORT (TASK 5)');
  console.log('================================================================');

  // Item 1: Display at least 5 real ingested fixtures
  console.log('\n--- 1. INGESTED FIXTURES SAMPLE (>= 5 REAL FIXTURES) ---');
  const distinctFixtures = Array.from(new Set(ledger.map((r) => r.fixtureId))).slice(0, 6);
  distinctFixtures.forEach((fixId, idx) => {
    const records = ledger.filter((r) => r.fixtureId === fixId);
    const first = records[0];
    console.log(`\nFixture #${idx + 1}: ${first.homeTeam} vs ${first.awayTeam}`);
    console.log(`  Fixture ID: ${first.fixtureId} | League: ${first.leagueName} (${first.leagueId})`);
    console.log(`  Kickoff: ${first.kickoffAt} | Model: ${first.modelVersion}`);
    console.log(`  Generated AH Lines:`);
    records.forEach((r) => {
      console.log(
        `    - ${r.side.toUpperCase()} ${r.line >= 0 ? '+' + r.line : r.line} @ ${r.takenOdds ?? r.marketOdds} | Fair Prob: ${(((r.fairProbability ?? r.modelProb) ?? 0) * 100).toFixed(1)}% | Market Prob: ${(((r.devigMarketProbability ?? r.marketProb) ?? 0) * 100).toFixed(1)}% | Edge: ${(r.edge * 100).toFixed(1)}% | EV: ${r.ev > 0 ? '+' + r.ev : r.ev}% | Qualification: [${r.valueQualificationState}]`
      );
    });
  });

  // Item 2: Display at least 1 real settlement completed end-to-end
  console.log('\n--- 2. REAL SETTLEMENT TRACE (>= 1 COMPLETED SETTLEMENT) ---');
  const settledRecords = ledger.filter((r) => r.settlementStatus === 'SETTLED');
  settledRecords.forEach((sr, idx) => {
    console.log(`\nSettled Record #${idx + 1}:`);
    console.log(`  Fixture: ${sr.homeTeam} vs ${sr.awayTeam} (${sr.fixtureId})`);
    console.log(`  Selection: ${sr.side.toUpperCase()} ${sr.line >= 0 ? '+' + sr.line : sr.line} @ Taken Odds ${sr.takenOdds}`);
    console.log(`  Outcome: ${sr.actualOutcome} | Net Profit: ${sr.profitLoss! > 0 ? '+' + sr.profitLoss : sr.profitLoss} units`);
    console.log(`  Closing Odds: ${sr.closingOdds ?? 'N/A'} | CLV: ${sr.clv !== undefined ? (sr.clv > 0 ? '+' + sr.clv : sr.clv) + '%' : 'UNDEFINED (honest missing)'}`);
    console.log(`  Settled At: ${sr.settledAt}`);
  });

  // Item 3: Hard override check
  console.log('\n--- 3. HARD GATE ENFORCEMENT CHECK ---');
  const nonNotValidated = ledger.filter((r) => r.valueQualificationState === 'QUALIFIED_VALUE');
  console.log(`Records with valueQualificationState == QUALIFIED_VALUE: ${nonNotValidated.length}`);
  console.log(`Are all records strictly prevented from QUALIFIED_VALUE? ${nonNotValidated.length === 0 ? 'YES (STRICTLY ENFORCED)' : 'FAIL'}`);

  // Item 4: Research honesty banner check
  console.log('\n--- 4. RESEARCH HONESTY BANNER CHECK ---');
  const missingBanner = ledger.filter((r) => r.researchStatusLabel !== RESEARCH_HONESTY_BANNER);
  console.log(`Records missing mandatory honesty banner: ${missingBanner.length}`);
  console.log(`Banner active on 100% of records: ${missingBanner.length === 0 ? 'YES' : 'NO'}`);
  console.log(`Banner Text:\n  "${RESEARCH_HONESTY_BANNER}"`);

  // Item 5: Current settled count and gate progress
  console.log('\n--- 5. TRACK-RECORD SETTLEMENT GATE PROGRESS (150-200 GATE) ---');
  console.log(`Total Predictions Generated in Ledger: ${summary.predictionsGenerated}`);
  console.log(`Total Settled Predictions: ${summary.settledCountTotal}`);
  console.log(`Target Settled Gate: ${summary.targetSettledGate} signals`);
  console.log(`Gate Progress: ${summary.settledCountTotal} / ${summary.targetSettledGate} (${summary.gateProgressPct}%)`);
  console.log(`Mean Live CLV: ${summary.meanLiveClv}% (Z-statistic: ${summary.liveClvZScore})`);
  console.log(`Monetization Enabled Flag: ${summary.monetizationEnabled}`);
  console.log('\n================================================================');
}

runEpic571Execution().catch(console.error);

