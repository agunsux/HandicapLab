// HandicapLab Market Intelligence - Performance Benchmark Audit
// Location: src/scripts/market-benchmark.ts

import { CLVEngine } from '../lib/market/clvEngine';
import { VolatilityEngine } from '../lib/market/volatilityEngine';
import { OddsMovementEvent } from '../lib/market/providerInterface';

function generateDummyEvents(count: number): OddsMovementEvent[] {
  const events: OddsMovementEvent[] = [];
  let currentOdds = 2.10;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 0.1;
    const oldOdds = currentOdds;
    currentOdds = Math.max(1.10, currentOdds + change);
    events.push({
      id: `evt-${i}`,
      eventType: 'OddsUpdated',
      timestamp: new Date().toISOString(),
      bookmaker: 'Pinnacle',
      market: 'ML',
      selection: 'home',
      oldOdds,
      newOdds: currentOdds,
      impliedProbability: 1 / currentOdds,
      movementMagnitude: Math.abs(change),
      movementDirection: change > 0 ? 'up' : 'down'
    });
  }
  return events;
}

async function runBenchmark(label: string, count: number) {
  console.log(`\n🚀 Running Benchmark [${label}] with ${count.toLocaleString()} iterations...`);
  
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = process.hrtime.bigint();

  // Process iterations
  let dummyVal = 0;
  for (let i = 0; i < count; i++) {
    // Perform simulated fast CLV calculation
    const res = CLVEngine.calculate(2.10, 1.95, 1.90, 0.025);
    dummyVal += res.clvPercent;
  }

  const endTime = process.hrtime.bigint();
  const endMemory = process.memoryUsage().heapUsed;

  const durationMs = Number(endTime - startTime) / 1e6;
  const memoryUsedMb = (endMemory - startMemory) / 1024 / 1024;
  const throughput = (count / durationMs) * 1000;

  console.log(`  - Duration: ${durationMs.toFixed(2)} ms`);
  console.log(`  - Average Latency: ${(durationMs / count).toFixed(6)} ms / iteration`);
  console.log(`  - Throughput: ${Math.round(throughput).toLocaleString()} ops/sec`);
  console.log(`  - Memory Delta: ${memoryUsedMb.toFixed(2)} MB`);
}

async function main() {
  console.log('🧪 Starting HandicapLab Sprint 25 Performance Audit...');

  // 1. Stress test CLV calculations
  await runBenchmark('CLV 10K', 10000);
  await runBenchmark('CLV 100K', 100000);
  await runBenchmark('CLV 1M', 1000000);

  // 2. Stress test Volatility parsing
  console.log('\n📊 Volatility Parsing stress test:');
  const dummyHistory = generateDummyEvents(10000);
  const vStart = process.hrtime.bigint();
  const vol = VolatilityEngine.calculate(dummyHistory);
  const vEnd = process.hrtime.bigint();
  console.log(`  - Volatility Score for 10K events: ${vol.volatilityScore}`);
  console.log(`  - Calculated in ${Number(vEnd - vStart) / 1e6} ms`);
}

main().catch(console.error);
