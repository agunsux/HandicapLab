import { DuckDBAdapter } from '../../src/lib/data-platform/duckdbAdapter';
import fs from 'fs';
import path from 'path';

export interface BenchmarkMetrics {
  load_ms: number;
  canonical_transform_ms: number;
  feature_ms: number;
  prediction_ms: number;
  peak_ram_mb: number;
  parquet_size_mb: number;
}

export interface BenchmarkStats {
  mean: number;
  median: number;
  p95: number;
  min: number;
  max: number;
  stddev: number;
}

export interface BenchmarkResult {
  leagues: number;
  matches: number;
  stats: {
    load_ms: BenchmarkStats;
    canonical_transform_ms: BenchmarkStats;
    feature_ms: BenchmarkStats;
    prediction_ms: BenchmarkStats;
    peak_ram_mb: BenchmarkStats;
    parquet_size_mb: BenchmarkStats;
  };
}

function calcStats(values: number[]): BenchmarkStats {
  if (values.length === 0) return { mean: 0, median: 0, p95: 0, min: 0, max: 0, stddev: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const mean = sum / sorted.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const variance = sorted.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / sorted.length;
  const stddev = Math.sqrt(variance);

  return { mean, median, p95, min, max, stddev };
}

async function runIteration(leagues: number): Promise<BenchmarkMetrics> {
  const numMatches = leagues * 10 * 380; // 10 seasons, ~380 matches per season
  const adapter = new DuckDBAdapter(':memory:');
  
  // 1. Load Parquet (Mocked as Table Creation & Insert for :memory:)
  const startLoad = performance.now();
  await adapter.exec(`CREATE TABLE raw_data (match_id VARCHAR, date VARCHAR, home_team VARCHAR, away_team VARCHAR, hg INT, ag INT);`);
  // Batch insert mock
  for (let i = 0; i < numMatches; i += 10000) {
    const chunk = Math.min(10000, numMatches - i);
    const values = Array(chunk).fill(`('m${i}', '2024-01-01', 'TeamA', 'TeamB', 1, 0)`).join(',');
    await adapter.exec(`INSERT INTO raw_data VALUES ${values};`);
  }
  const load_ms = performance.now() - startLoad;

  // 2. Canonical Transformation
  const startCanonical = performance.now();
  await adapter.exec(`CREATE TABLE canonical AS SELECT match_id, date::DATE as match_date, home_team, away_team, hg, ag FROM raw_data;`);
  const canonical_transform_ms = performance.now() - startCanonical;

  // 3. Feature Engineering
  const startFeature = performance.now();
  await adapter.exec(`CREATE TABLE features AS SELECT match_id, match_date, home_team, away_team, (hg - ag) as goal_diff FROM canonical;`);
  const feature_ms = performance.now() - startFeature;

  // 4. Prediction
  const startPrediction = performance.now();
  await adapter.query(`SELECT match_id, (goal_diff * 0.1) as expected_edge FROM features;`);
  const prediction_ms = performance.now() - startPrediction;

  // Output to Parquet to measure size
  const tempParquet = path.resolve(process.cwd(), `temp_test_${Date.now()}.parquet`);
  await adapter.exportToParquet('SELECT * FROM features', tempParquet);
  const parquet_size_mb = fs.existsSync(tempParquet) ? fs.statSync(tempParquet).size / (1024 * 1024) : 0;
  if (fs.existsSync(tempParquet)) fs.unlinkSync(tempParquet);

  await adapter.close();

  const memUsage = process.memoryUsage();
  const peak_ram_mb = memUsage.heapUsed / (1024 * 1024);

  return { load_ms, canonical_transform_ms, feature_ms, prediction_ms, peak_ram_mb, parquet_size_mb };
}

export async function runBenchmarks(): Promise<BenchmarkResult[]> {
  const scenarios = [6, 20, 50]; // number of leagues
  const iterations = 5;
  const results: BenchmarkResult[] = [];

  for (const leagues of scenarios) {
    const metricsList: BenchmarkMetrics[] = [];
    
    for (let i = 0; i < iterations; i++) {
      if (global.gc) global.gc(); // Request GC if available
      metricsList.push(await runIteration(leagues));
    }

    results.push({
      leagues,
      matches: leagues * 10 * 380,
      stats: {
        load_ms: calcStats(metricsList.map(m => m.load_ms)),
        canonical_transform_ms: calcStats(metricsList.map(m => m.canonical_transform_ms)),
        feature_ms: calcStats(metricsList.map(m => m.feature_ms)),
        prediction_ms: calcStats(metricsList.map(m => m.prediction_ms)),
        peak_ram_mb: calcStats(metricsList.map(m => m.peak_ram_mb)),
        parquet_size_mb: calcStats(metricsList.map(m => m.parquet_size_mb)),
      }
    });
  }

  return results;
}
