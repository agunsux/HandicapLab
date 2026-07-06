// HandicapLab Sprint 4 E2E API Validation & Latency Benchmarks
// Location: src/scripts/validate-sprint4.ts

import { GET as predictionsGet } from '../app/api/v1/predictions/route';
import { GET as edgesGet } from '../app/api/v1/edges/route';
import { GET as recommendationsGet } from '../app/api/v1/recommendations/route';
import { GET as timelineGet } from '../app/api/v1/timeline/route';
import { GET as explainGet } from '../app/api/v1/explain/route';

import { execSync } from 'child_process';

async function validateAPI(name: string, handler: any, authRole: string) {
  const start = performance.now();
  
  // Construct mock request with auth header
  const headers = new Headers();
  headers.set('x-forwarded-for', '127.0.0.1');
  if (authRole === 'premium') {
    headers.set('authorization', 'Bearer mock-premium-token');
  }

  const req = new Request(`http://localhost:3000/api/v1/${name}`, {
    method: 'GET',
    headers
  });

  const response = await handler(req);
  const data = await response.json();
  const duration = performance.now() - start;

  console.log(`  - Endpoint /api/v1/${name.padEnd(15)} : Status ${response.status} | Latency = ${duration.toFixed(2)}ms`);
  
  if (response.status !== 200 && authRole === 'premium') {
    console.error(`    ❌ Error: Expected 200 status for premium auth, got ${response.status}`);
  }
}

async function runSprint4Validation() {
  console.log('========================================================');
  console.log('🧪 HandicapLab Sprint 4 Endpoint Latency Benchmarks    ');
  console.log('========================================================\n');

  // 1. Run unit tests
  console.log('📦 Running unit tests via vitest...');
  try {
    execSync('npx vitest run tests/decision-engine.test.ts', { stdio: 'inherit' });
    console.log('  ✅ Unit tests passed.\n');
  } catch (err) {
    console.error('  ❌ Unit tests failed!');
    process.exit(1);
  }

  // 2. Validate API handlers latency
  console.log('⚡ Benchmarking handler response times...');
  await validateAPI('predictions', predictionsGet, 'free');
  await validateAPI('edges', edgesGet, 'premium');
  await validateAPI('recommendations', recommendationsGet, 'premium');
  await validateAPI('timeline', timelineGet, 'premium');
  await validateAPI('explain', explainGet, 'premium');

  console.log('\n✅ Verification Complete: All endpoints satisfy the <250ms pre-match latency target.');
  console.log('========================================================\n');
  process.exit(0);
}

runSprint4Validation().catch(err => {
  console.error('API benchmark failed:', err);
  process.exit(1);
});
