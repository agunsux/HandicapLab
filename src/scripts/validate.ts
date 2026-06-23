import { runSimulation } from '../lib/simulation/batchRunner';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const batchSize = 10000;
  const seed = 42;
  
  console.log('Running validation simulation...');
  const { metrics, edges, guardStatuses, baselines } = runSimulation(batchSize, seed);
  
  console.log('Simulation complete');
  console.log(`${batchSize} matches processed`);
  
  if (guardStatuses.includes('INSUFFICIENT_DATA')) {
    console.error('INSUFFICIENT_DATA: Sample size must be at least 500.');
    return;
  }

  // Identify new automated red flags
  const redFlags: string[] = [];
  if (baselines.edgeInsufficient) redFlags.push('EDGE_INSUFFICIENT');
  if (metrics.calibrationError > 0.1) redFlags.push('CALIBRATION_DRIFT');
  if (baselines.marketBeat) redFlags.push('MARKET_BEATEN');
  if (baselines.secondHalfUnderProfitable) redFlags.push('SECOND_HALF_UNDER_PROFITABLE');

  const isModelReady = baselines.marketBeat && baselines.secondHalfUnderProfitable && !baselines.edgeInsufficient && metrics.calibrationError <= 0.1;

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
- **Red Flags / System Flags:** ${redFlags.length > 0 ? redFlags.join(', ') : 'None'}
- **Variance Stable:** ${metrics.varianceStable ? 'Yes' : 'No'}

## Accuracy & Probabilistic Performance
- **Model Brier Score (ML Home):** ${metrics.brierScore.toFixed(4)} 
- **Market Brier Score:** ${baselines.marketBrier.toFixed(4)}
- **Naive Fav Brier Score:** ${baselines.naiveFavBrier.toFixed(4)}
- **Overall Calibration Error:** ${(metrics.calibrationError * 100).toFixed(2)}%

## Market ROI (Accounting for Vig)
- **Model ML ROI:** ${(baselines.modelMlRoi * 100).toFixed(2)}%
- **Model AH ROI:** ${(baselines.modelAhRoi * 100).toFixed(2)}%
- **Model OU ROI:** ${(baselines.modelOuRoi * 100).toFixed(2)}%
- **Second Half Under ROI:** ${(baselines.modelShUnderRoi * 100).toFixed(2)}%

## Baseline ML ROI Comparisons
- **Market Efficiency Baseline ROI:** ${(baselines.marketEfficiencyMlRoi * 100).toFixed(2)}%
- **Random Baseline ROI:** ${(baselines.randomBaselineMlRoi * 100).toFixed(2)}%
- **Naive Favorite Baseline ROI:** ${(baselines.naiveFavMlRoi * 100).toFixed(2)}%

## Market Edge Summary (Average Edge)
- **Moneyline:** ${((avgMlEdge / countMl) * 100).toFixed(2)}%
- **Asian Handicap:** ${((avgAhEdge / countAh) * 100).toFixed(2)}%
- **Over/Under:** ${((avgOuEdge / countOu) * 100).toFixed(2)}%

## Calibration Table

| Bucket | Predicted Mean | Actual Rate | Sample Size | Calibration Error |
|--------|---------------|-------------|-------------|-------------------|
${metrics.calibrationBuckets.map(b => `| ${b.bucket} | ${(b.predictionMean * 100).toFixed(1)}% | ${(b.actualRate * 100).toFixed(1)}% | ${b.sampleSize} | ${(b.calibrationError * 100).toFixed(2)}% |`).join('\n')}
`;

  fs.writeFileSync(path.join(process.cwd(), 'VALIDATION_REPORT.md'), reportContent);
  console.log('\nGenerated VALIDATION_REPORT.md successfully.');

  const readinessContent = `# Model Readiness Assessment

**Status:** ${isModelReady ? 'READY' : 'NOT READY'}

## Business Questions

**1. Does the model have a statistically significant edge over the bookmaker's line?**
${baselines.marketBeat ? 'Yes. The model ML ROI beats the Market Efficiency baseline.' : 'No. The model underperforms the Market Efficiency baseline.'}

**2. Is the Second Half Under strategy profitable after vig?**
${baselines.secondHalfUnderProfitable ? `Yes. Second Half Under ROI is ${(baselines.modelShUnderRoi * 100).toFixed(2)}%.` : `No. Second Half Under ROI is ${(baselines.modelShUnderRoi * 100).toFixed(2)}%.`}

**3. What is the minimum sample size needed before we trust the calibration?**
A minimum of 500 matches is strictly enforced. We currently evaluated ${metrics.sampleSize} matches.

**4. Should we proceed to production with real data?**
${isModelReady ? 'YES. The model is statistically viable, calibrated, and profitable against baselines.' : 'NO. The model has negative ROI compared to market efficiency or severe calibration drift. Retraining is required before moving to Sprint 2.'}

## Edge Consistency
- Edges generally flag as ${baselines.edgeInsufficient ? 'INSUFFICIENT (<2% after vig)' : 'SUFFICIENT (>2% after vig)'}.
- **ML Edge:** ${((avgMlEdge / countMl) * 100).toFixed(2)}%
`;

  fs.writeFileSync(path.join(process.cwd(), 'MODEL_READINESS.md'), readinessContent);
  console.log('Generated MODEL_READINESS.md successfully.');
}

main().catch(console.error);
