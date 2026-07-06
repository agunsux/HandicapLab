import { BenchmarkRunner } from '../lib/data-platform/benchmarkRunner';
import { PoissonModelWrapper } from '../lib/engines/decision-engine-v1/models/poisson-wrapper';
import * as os from 'os';

async function runStressTest(size: number) {
  console.log(`\n--- Stress Test: ${size} predictions ---`);
  
  // Generate synthetic data
  const dataset = [];
  for (let i = 0; i < size; i++) {
    dataset.push({
      id: i,
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      fullTimeHomeGoals: Math.floor(Math.random() * 3),
      fullTimeAwayGoals: Math.floor(Math.random() * 3),
      closingOddsHome: 1.5 + Math.random() * 2,
      closingOddsDraw: 3.0 + Math.random(),
      closingOddsAway: 4.0 + Math.random() * 3,
      homeAttack: 1.5,
      awayAttack: 1.0,
      homeDefense: 1.2,
      awayDefense: 1.8,
      leagueId: '39'
    });
  }

  const model = new PoissonModelWrapper();
  const runner = new BenchmarkRunner({
    datasetPath: 'memory',
    features: ['homeAttack', 'awayAttack', 'homeDefense', 'awayDefense'],
    deterministic: true,
    randomSeed: 42,
    strategy: 'rolling',
    windowSize: 1
  });

  const startMem = process.memoryUsage().heapUsed;
  const startTime = Date.now();

  try {
    const expId = await runner.evaluateModel(model, dataset);
    const endTime = Date.now();
    const endMem = process.memoryUsage().heapUsed;

    const timeElapsedSec = (endTime - startTime) / 1000;
    const memUsedMB = (endMem - startMem) / 1024 / 1024;

    console.log(`Execution Time: ${timeElapsedSec.toFixed(2)}s`);
    console.log(`Memory Used: ${memUsedMB.toFixed(2)} MB`);
    console.log(`Experiment ID: ${expId}`);

    if (timeElapsedSec > 60) {
      console.warn(`[WARNING] Failed performance budget! Target < 60s, took ${timeElapsedSec.toFixed(2)}s`);
    } else {
      console.log(`[SUCCESS] Passed performance budget!`);
    }
  } catch (error) {
    console.error(`[ERROR] Benchmark failed:`, error);
  }
}

async function main() {
  console.log(`System Memory: ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(2)} GB`);
  
  // Run small warm-up
  await runStressTest(100);

  // Run full
  await runStressTest(10000);
  
  // Note: Skipping 100,000 to save execution time in this mock, but can be scaled up.
}

main().catch(console.error);
