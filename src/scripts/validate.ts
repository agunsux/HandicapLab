import { runSimulation } from '../lib/simulation/batchRunner';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const batchSize = 10000;
  const seed = 42;
  
  console.log('Running validation simulation...');
  const { metrics, edges, guardStatuses } = runSimulation(batchSize, seed);
  
  console.log('Simulation complete');
  console.log(`${batchSize} matches processed`);
  
  if (guardStatuses.includes('INSUFFICIENT_DATA')) {
    console.error('INSUFFICIENT_DATA: Sample size must be at least 500.');
    return;
  }
  
  console.log('\nReport Console Summary:');
  console.log(`BTTS mean: ${(metrics.bttsMean * 100).toFixed(2)}%`);
  console.log(`Over bias: ${(metrics.overBias * 100).toFixed(2)}%`);
  console.log(`Home bias: ${(metrics.homeBias * 100).toFixed(2)}%`);
  console.log(`Brier Score: ${metrics.brierScore.toFixed(4)}`);
  console.log(`Calibration Error: ${(metrics.calibrationError * 100).toFixed(2)}%`);
  console.log(`Variance stable: ${metrics.varianceStable}`);
  console.log(`Guard Statuses: ${guardStatuses.length > 0 ? guardStatuses.join(', ') : 'OK'}`);

  let avgMlEdge = 0, avgAhEdge = 0, avgOuEdge = 0;
  let countMl = 0, countAh = 0, countOu = 0;
  
  for (const e of edges) {
    if (e.market === 'Moneyline') { avgMlEdge += e.edge; countMl++; }
    if (e.market === 'Asian Handicap') { avgAhEdge += e.edge; countAh++; }
    if (e.market === 'Over/Under') { avgOuEdge += e.edge; countOu++; }
  }

  const reportContent = `# Sprint 1.5 Statistical Validation Report

## Execution Summary
- **Dataset Size:** ${metrics.sampleSize} simulated matches
- **Guard Statuses:** ${guardStatuses.length > 0 ? guardStatuses.join(', ') : 'All Systems Nominal'}
- **Variance Stable:** ${metrics.varianceStable ? 'Yes' : 'No'}

## Accuracy & Probabilistic Performance
- **Brier Score (ML Home):** ${metrics.brierScore.toFixed(4)} *(lower is better, 0.25 is random guessing)*
- **Overall Calibration Error:** ${(metrics.calibrationError * 100).toFixed(2)}%

### Market Accuracy
- **Moneyline (Match Winner):** ${(metrics.markets.ML.accuracy * 100).toFixed(2)}%
- **Asian Handicap:** ${(metrics.markets.AH.accuracy * 100).toFixed(2)}%
- **Over/Under:** ${(metrics.markets.OU.accuracy * 100).toFixed(2)}%

## Bias Detection
- **Home Bias:** ${(metrics.homeBias * 100).toFixed(2)}%
- **Over Bias:** ${(metrics.overBias * 100).toFixed(2)}%
- **BTTS Rate:** ${(metrics.bttsMean * 100).toFixed(2)}%

## Market Edge Summary (Average Edge)
- **Moneyline:** ${((avgMlEdge / countMl) * 100).toFixed(2)}%
- **Asian Handicap:** ${((avgAhEdge / countAh) * 100).toFixed(2)}%
- **Over/Under:** ${((avgOuEdge / countOu) * 100).toFixed(2)}%

## Calibration Table

| Bucket | Predicted Mean | Actual Rate | Sample Size | Calibration Error |
|--------|---------------|-------------|-------------|-------------------|
${metrics.calibrationBuckets.map(b => `| ${b.bucket} | ${(b.predictionMean * 100).toFixed(1)}% | ${(b.actualRate * 100).toFixed(1)}% | ${b.sampleSize} | ${(b.calibrationError * 100).toFixed(2)}% |`).join('\n')}

## Known Limitations
- The simulated market implied probabilities for AH and O/U are currently fixed at 50% for edge calculation, which may not reflect real asymmetric markets.
- Goal distribution generation uses a basic Poisson curve which fails to account for late-game state dependencies.
- Match input statistics (shots, form) are uniformly randomized with noise rather than strictly correlated historical curves.
`;

  fs.writeFileSync(path.join(process.cwd(), 'VALIDATION_REPORT.md'), reportContent);
  console.log('\nGenerated VALIDATION_REPORT.md successfully.');
}

main().catch(console.error);
