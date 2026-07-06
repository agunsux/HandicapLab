// HandicapLab Live Data Platform - Performance Ingestion Audit
// Location: src/scripts/data-benchmark.ts

import { OddsNormalizer } from '../lib/data-platform/oddsNormalizer';
import { DataQualityEngine } from '../lib/data-platform/dataQualityEngine';
import { CanonicalOdds } from '../lib/data-platform/canonicalModel';

function generateDummyRecords(count: number): CanonicalOdds[] {
  const records: CanonicalOdds[] = [];
  const now = new Date().toISOString();
  for (let i = 0; i < count; i++) {
    records.push({
      fixtureId: `bm-fixture-${i}`,
      provider: 'Mock',
      marketType: 'ML',
      selection: 'home',
      oddsDecimal: 2.10,
      impliedProbability: 0.476,
      receivedAt: now,
      providerTimestamp: now,
      processedTimestamp: now,
      latencyMs: 4,
      normalizerVersion: '1.0.0'
    });
  }
  return records;
}

async function runBenchmark(label: string, count: number) {
  console.log(`\n🚀 Ingestion Benchmark [${label}] running with ${count.toLocaleString()} events...`);
  
  const startMemory = process.memoryUsage().heapUsed;
  const startTime = process.hrtime.bigint();

  const records = generateDummyRecords(count);
  const quality = DataQualityEngine.evaluate(records);

  const endTime = process.hrtime.bigint();
  const endMemory = process.memoryUsage().heapUsed;

  const durationMs = Number(endTime - startTime) / 1e6;
  const memoryUsedMb = (endMemory - startMemory) / 1024 / 1024;
  const throughput = (count / durationMs) * 1000;

  console.log(`  - Quality Score: ${quality.score}`);
  console.log(`  - Processing Duration: ${durationMs.toFixed(2)} ms`);
  console.log(`  - Throughput: ${Math.round(throughput).toLocaleString()} events/sec`);
  console.log(`  - Memory Allocated: ${memoryUsedMb.toFixed(2)} MB`);
}

async function main() {
  console.log('🧪 Starting Live Data Platform Performance Ingestion Audit...');

  // Run iterations
  await runBenchmark('Ingest 100K', 100000);
  await runBenchmark('Ingest 500K', 500000);
  await runBenchmark('Ingest 1M', 1000000);

  // Normalizer conversion benchmarks
  console.log('\n📊 Normalizer Conversion Benchmarking:');
  const nStart = process.hrtime.bigint();
  for (let i = 0; i < 100000; i++) {
    OddsNormalizer.toDecimal(0.95, 'HongKong');
  }
  const nEnd = process.hrtime.bigint();
  console.log(`  - 100K HK conversions completed in ${Number(nEnd - nStart) / 1e6} ms`);
}

main().catch(console.error);
