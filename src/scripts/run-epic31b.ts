#!/usr/bin/env tsx
/**
 * EPIC 31B — Production Replay & Shadow Validation
 * Main Entry Point
 *
 * Usage:
 *   npx tsx src/scripts/run-epic31b.ts
 *   npm run epic:31b
 *
 * Environment Variables:
 *   EPIC31B_MAX_MATCHES_PER_LEAGUE — limit matches per league (default: 50)
 *   EPIC31B_DETERMINISM_RUNS — determinism verification runs (default: 3)
 *   EPIC31B_SEED — random seed (default: 42)
 */

import { Epic31BOrchestrator } from '../lib/epic31b';

async function main() {
  const maxMatches = parseInt(process.env.EPIC31B_MAX_MATCHES_PER_LEAGUE || '50', 10);
  const determinismRuns = parseInt(process.env.EPIC31B_DETERMINISM_RUNS || '3', 10);
  const seed = parseInt(process.env.EPIC31B_SEED || '42', 10);

  console.log(`\n🚀 Starting EPIC 31B — Production Replay & Shadow Validation`);
  console.log(`   Max matches per league: ${maxMatches}`);
  console.log(`   Determinism runs: ${determinismRuns}`);
  console.log(`   Seed: ${seed}\n`);

  const orchestrator = new Epic31BOrchestrator({
    maxMatchesPerLeague: maxMatches,
    determinismRunCount: determinismRuns,
    seed,
  });

  try {
    const report = await orchestrator.run();

    if (report.decision === 'BLOCK EPIC 32') {
      console.log('\n⚠️  EPIC 32 is BLOCKED. Review the report for details.');
      process.exit(1);
    }

    console.log('\n✅ EPIC 31B completed successfully. EPIC 32 is APPROVED.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ EPIC 31B failed with error:', error);
    process.exit(1);
  }
}

main();
