#!/usr/bin/env tsx
/**
 * SUPER EPIC 31B.5 — Historical Validation Laboratory
 * Entrypoint Script
 */

import fs from 'fs';
import path from 'path';
import { Epic31BOrchestrator } from '../lib/epic31b';

async function main() {
  const seed = parseInt(process.env.EPIC31B_SEED || '42', 10);

  console.log(`\n🚀 Starting SUPER EPIC 31B.5 — Historical Validation Laboratory`);
  console.log(`   Random Seed: ${seed}\n`);

  const orchestrator = new Epic31BOrchestrator({
    seed,
  });

  try {
    const evidence = await orchestrator.run();
    
    // Load final decision report
    const decisionPath = path.join(process.cwd(), 'artifacts', 'epic31b', 'final_decision.json');
    if (!fs.existsSync(decisionPath)) {
      console.log('\n❌ Final decision file was not generated.');
      process.exit(1);
    }

    const decisionObj = JSON.parse(fs.readFileSync(decisionPath, 'utf-8'));
    console.log(`\nEvidence Signature: ${evidence.evidenceSignature}`);
    console.log(`Evidence Hash: ${evidence.evidenceHash}`);
    console.log(`Decision Status: ${decisionObj.decision}`);

    if (decisionObj.decision === 'BLOCK') {
      console.log('\n⚠️  Research validation failed. Promotion BLOCKED. Review reports in artifacts/epic31b/ for details.');
      process.exit(1);
    }

    console.log('\n✅ Research validation passed. Promotion APPROVED.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Validation pipeline failed with error:', error);
    process.exit(1);
  }
}

main();
