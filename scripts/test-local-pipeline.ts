import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

import { DailyAhShadowPipeline } from '../src/lib/pipeline/dailyAhShadowPipeline';
import { AhDataLoader } from '../src/lib/research/ah-solo/ahDataLoader';

async function testCanonicalPipeline() {
  console.log('========================================================');
  console.log('🏁 HANDICAP_LAB AH SHADOW PIPELINE — CANONICAL TEST');
  console.log('Time:', new Date().toISOString());
  console.log('========================================================\n');

  try {
    // 1. Historical Data Inventory
    console.log('[1/4] Loading Historical Inventory...');
    const { matches } = AhDataLoader.computeDataInventory();
    console.log(`  -> Historical Matches: ${matches.length}`);

    // 2. Fetch Live Fixtures & Match Odds
    console.log('\n[2/4] Fetching Live Upcoming Fixtures (API-Football + OddsPapi)...');
    const upcomingCandidates = await DailyAhShadowPipeline.fetchLiveUpcomingFixtures();
    console.log(`  -> Upcoming Candidates: ${upcomingCandidates.length}`);

    const withOdds = upcomingCandidates.filter(c => c.openingOdds && c.openingOdds.length > 0);
    console.log(`  -> Candidates with Usable AH Odds: ${withOdds.length}`);

    // 3. Execute Canonical Predictions
    console.log('\n[3/4] Executing Daily Predictions with Canonical Dixon-Coles...');
    const predResult = await DailyAhShadowPipeline.executeDailyPredictions(upcomingCandidates, matches);
    console.log(`  -> Predictions Generated: ${predResult.generatedRecords.length}`);
    console.log(`  -> Failures: ${predResult.failures.length}`);

    // 4. Summary Telemetry
    console.log('\n[4/4] Generating Pipeline Summary...');
    const summary = DailyAhShadowPipeline.generatePipelineSummary();
    console.log(JSON.stringify(summary, null, 2));

    console.log('\n========================================================');
    console.log('✅ CANONICAL PIPELINE EXECUTION SUCCESS');
    console.log('========================================================');
  } catch (err: any) {
    console.error('❌ ERROR IN TEST:', err.message);
    console.error(err.stack);
  }
}

testCanonicalPipeline();
