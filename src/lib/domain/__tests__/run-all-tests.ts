/**
 * HandicapLab Domain Intelligence Platform — Master Test Runner
 * Run with: npx tsx src/lib/domain/__tests__/run-all-tests.ts
 */

import './shared.test';
import './entities.test';
import './events.test';
import './aggregates.test';
import './graph.test';
import './policies.test';
import './registry.test';

console.log('\n✅ All domain tests completed.');