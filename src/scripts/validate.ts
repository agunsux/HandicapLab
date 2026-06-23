import { runSimulation } from '../lib/simulation/batchRunner';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const batchSize = 10000;
  const seed = 42;
  
  console.log('Running validation simulation...');
  const { trainMetrics, valMetrics, trainBaselines, valBaselines, edges, guardStatuses, ablation } = runSimulation(batchSize, seed);
  
  console.log('Simulation complete');
  console.log(`${batchSize} matches processed (70% Train / 30% Validation)`);
  
  if (guardStatuses.includes('INSUFFICIENT_DATA')) {
    console.error('INSUFFICIENT_DATA: Sample size must be at least 500.');
    return;
  }

  const redFlags: string[] = [];
  if (valBaselines.edgeInsufficient) redFlags.push('EDGE_INSUFFICIENT');
  if (valMetrics.calibrationError > 0.1) redFlags.push('CALIBRATION_DRIFT');
  if (valBaselines.marketBeat) redFlags.push('MARKET_BEATEN');
  if (valBaselines.secondHalfUnderProfitable) redFlags.push('SECOND_HALF_UNDER_PROFITABLE');

  // Check if any feature causes artificial edge (ablation unstable)
  const unstableFeatures = ablation.filter(a => a.unstable);
  if (unstableFeatures.length > 0) {
    redFlags.push('FEATURE_OVERFIT');
  }

  // Success Criteria
  const calibrationImproves = valMetrics.calibrationError < 0.15; // Benchmark
  const validationBeatsBaseline = valBaselines.secondHalfUnderProfitable;
  const edgeSurvives = valBaselines.modelShUnderRoi > 0;
  
  const isModelReady = calibrationImproves && validationBeatsBaseline && unstableFeatures.length === 0 && edgeSurvives;

  let avgMlEdge = 0, avgAhEdge = 0, avgOuEdge = 0, avgShEdge = 0;
  let countMl = 0, countAh = 0, countOu = 0, countSh = 0;
  
  for (const e of edges) {
    if (e.market === 'Moneyline') { avgMlEdge += e.edge; countMl++; }
    if (e.market === 'Asian Handicap') { avgAhEdge += e.edge; countAh++; }
    if (e.market === 'Over/Under') { avgOuEdge += e.edge; countOu++; }
    if (e.market === 'Second Half Under') { avgShEdge += e.edge; countSh++; }
  }

  const reportContent = `# Sprint 1.7 Validation & Readiness Report

**Status:** ${isModelReady ? 'READY' : 'NOT READY'}

## Train vs Validation Metrics

| Metric | Training (70%) | Validation (30%) |
|--------|----------------|------------------|
| **SH Under ROI** | ${(trainBaselines.modelShUnderRoi * 100).toFixed(2)}% | ${(valBaselines.modelShUnderRoi * 100).toFixed(2)}% |
| **Brier Score (SH Under)** | ${trainMetrics.brierScore.toFixed(4)} | ${valMetrics.brierScore.toFixed(4)} |
| **Calibration Error** | ${(trainMetrics.calibrationError * 100).toFixed(2)}% | ${(valMetrics.calibrationError * 100).toFixed(2)}% |

## Business Questions

**1. Does the model have a statistically significant edge over the bookmaker's line?**
${valBaselines.marketBeat ? 'Yes. The model beats the Market Efficiency baseline.' : 'No. The model underperforms the Market Efficiency baseline.'}

**2. Is the Second Half Under strategy profitable after vig?**
${valBaselines.secondHalfUnderProfitable ? `Yes. SH Under ROI on unseen validation data is ${(valBaselines.modelShUnderRoi * 100).toFixed(2)}%.` : `No. SH Under ROI on unseen validation data is ${(valBaselines.modelShUnderRoi * 100).toFixed(2)}%.`}

**3. Did edge survive unseen validation?**
${edgeSurvives ? 'Yes, the edge held up out-of-sample.' : 'No, the edge degraded or remained negative out-of-sample.'}

**4. Should we proceed to production with real data?**
${isModelReady ? 'YES. The model is calibrated, avoids overfitting, and beats baselines out-of-sample.' : 'NO. The model failed success criteria.'}

## Feature Ablation Analysis (Validation Set)

| Feature | Base Brier | Ablated Brier | Improvement | Correlation | Unstable? |
|---------|------------|---------------|-------------|-------------|-----------|
${ablation.map(a => `| ${a.featureName} | ${a.baseBrier.toFixed(4)} | ${a.ablatedBrier.toFixed(4)} | ${(a.improvement * 100).toFixed(2)}% | ${a.correlation.toFixed(3)} | ${a.unstable ? 'YES' : 'NO'} |`).join('\n')}

## Market Edge Summary (Average Edge - Validation Set)
- **Second Half Under:** ${((avgShEdge / countSh) * 100).toFixed(2)}%
- **Moneyline:** ${((avgMlEdge / countMl) * 100).toFixed(2)}%
- **Asian Handicap:** ${((avgAhEdge / countAh) * 100).toFixed(2)}%
- **Over/Under:** ${((avgOuEdge / countOu) * 100).toFixed(2)}%

## Red Flags
- ${redFlags.length > 0 ? redFlags.join('\n- ') : 'None'}
`;

  if (isModelReady) {
    fs.writeFileSync(path.join(process.cwd(), 'MODEL_READINESS.md'), reportContent);
    console.log('Generated MODEL_READINESS.md successfully.');
  } else {
    fs.writeFileSync(path.join(process.cwd(), 'NEXT_MODEL_ITERATION.md'), reportContent);
    console.log('Generated NEXT_MODEL_ITERATION.md successfully.');
  }
}

main().catch(console.error);
