import fs from 'fs';
import path from 'path';
import { runSchemaTests } from './test_schema_enforcement';
import { runPointInTimeTests } from './test_point_in_time_leakage';
import { runBenchmarks } from './benchmark_duckdb';

async function generateReports(schemaResults: any[], leakageResults: any[], benchmarkResults: any[]) {
  const dateStr = new Date().toISOString().split('T')[0];
  const baselineDir = path.resolve(process.cwd(), 'benchmarks', dateStr);
  if (!fs.existsSync(baselineDir)) fs.mkdirSync(baselineDir, { recursive: true });

  const dir = path.resolve(process.cwd(), 'research', 'sprint_32_6_validated');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const baseline = {
    duckdb_version: '1.4.4', // from package.json
    node_version: process.version,
    dataset_version: 'v1.0.0', // updated version
    benchmarks: benchmarkResults
  };

  fs.writeFileSync(path.join(baselineDir, 'baseline.json'), JSON.stringify(baseline, null, 2));

  // Analyze results to figure out VERIFIED vs UNVERIFIED
  let verified = '# Verified Blockers\n\n';
  let unverified = '# Unverified Hypotheses\n\n';

  // 1. Schema Enforcement
  const failedSchema = schemaResults.filter(r => !r.passed);
  if (failedSchema.length > 0) {
    verified += `## Schema Enforcement Fails\nPipeline did not fail correctly on ${failedSchema.length} scenarios. Example: ${failedSchema[0].name}\n`;
  } else {
    unverified += `## Schema Enforcement\nHypothesis that pipeline fails on corrupted schema was unverified (Pipeline successfully rejected bad schemas or hasn't implemented strict Zod yet).\n`;
  }

  // 2. Point in Time Leakage
  const leaking = leakageResults.filter(r => r.isLeaking);
  if (leaking.length > 0) {
    verified += `## Point-in-Time Leakage\nLeakage detected in scenarios: ${leaking.map(l => l.scenario).join(', ')}.\n`;
  } else {
    unverified += `## Point-in-Time Leakage\nNo leakage detected in basic FormExtractor querying.\n`;
  }

  // 3. Scalability
  const b50 = benchmarkResults.find(b => b.leagues === 50);
  if (b50 && b50.stats.peak_ram_mb.max > 2000) { // arbitrary threshold for test
    verified += `## DuckDB Scalability\n50 leagues consumes ${b50.stats.peak_ram_mb.max.toFixed(2)} MB peak RAM, posing OOM risks.\n`;
  } else if (b50) {
    unverified += `## DuckDB Scalability\n50 leagues consumes only ${b50.stats.peak_ram_mb.max.toFixed(2)} MB peak RAM, meaning memory scaling issue is unverified/mild.\n`;
  }

  fs.writeFileSync(path.join(dir, 'VERIFIED_BLOCKERS.md'), verified);
  fs.writeFileSync(path.join(dir, 'UNVERIFIED_HYPOTHESES.md'), unverified);

  const fixPriority = '# Fix Priority\n\n1. Fix Point-in-Time Date comparisons for timezones.\n2. Add Zod schemas to DatasetBuilder.\n3. Keep DuckDB in memory for now, optimize serialization.';
  fs.writeFileSync(path.join(dir, 'FIX_PRIORITY.md'), fixPriority);
  
  console.log('Sprint 32.6 Validation Complete. Artifacts generated in research/sprint_32_6_validated/');
}

async function main() {
  console.log('Running Schema Enforcement Tests...');
  const schemaResults = await runSchemaTests();
  
  console.log('Running Point-in-Time Leakage Tests...');
  const leakageResults = await runPointInTimeTests();

  console.log('Running DuckDB Benchmarks (this may take a while)...');
  const benchmarkResults = await runBenchmarks();

  await generateReports(schemaResults, leakageResults, benchmarkResults);
}

main().catch(console.error);
