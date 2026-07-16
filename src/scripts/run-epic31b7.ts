import { BronzeBacktestEngine } from '../services/backtest/bronzeBacktestEngine';
import { EvaluationEngine } from '../services/backtest/evaluationEngine';

async function main() {
  const engine = new BronzeBacktestEngine();
  const seasons = [
    '2015-2016',
    '2016-2017',
    '2017-2018',
    '2018-2019',
    '2019-2020',
    '2020-2021',
    '2021-2022',
    '2022-2023',
    '2023-2024',
    '2024-2025',
    '2025-2026'
  ];

  console.log('Starting Backtest for EPL...');
  const snapshots = await engine.runBacktest('EPL', seasons);
  console.log(`Backtest completed. Total predictions generated: ${snapshots.length}`);

  console.log('Evaluating predictions...');
  const evaluator = new EvaluationEngine();
  const metrics = evaluator.evaluate(snapshots);

  console.log('\n--- EVALUATION RESULTS ---');
  console.log(`Total Matches Evaluated: ${metrics.totalMatches}`);
  console.log(`Accuracy: ${(metrics.accuracy * 100).toFixed(2)}%`);
  console.log(`Log Loss: ${metrics.logLoss.toFixed(4)}`);
  console.log(`Brier Score: ${metrics.brierScore.toFixed(4)}`);
  console.log('\nCalibration (Home Win):');
  console.table(metrics.calibration.homeWin.map(b => ({
    Bucket: b.bucketStr,
    Matches: b.count,
    Expected: `${(b.expectedWinRate * 100).toFixed(1)}%`,
    Actual: `${(b.actualWinRate * 100).toFixed(1)}%`,
    Error: `${(b.calibrationError * 100).toFixed(2)}%`
  })));
}

main().catch(console.error);
