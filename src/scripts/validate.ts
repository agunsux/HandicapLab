import { runSimulation } from '../lib/simulation/batchRunner';
import { generateCalibrationDiagnostic } from '../lib/validation/calibrationDiagnostic';
import { generateDistributionReport } from '../lib/validation/distributionReport';
import { evaluateReportGuards, validateOddsSanity } from '../lib/validation/guards';
import { runHTDecomposition } from '../lib/validation/htDecomposition';
import { runHTInteractionTest } from '../lib/validation/htInteractionTest';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const batchSize = 10000;
  const seed = 42;
  
  console.log('Running validation simulation...');
  const { trainMetrics, valMetrics, trainBaselines, valBaselines, edges, guardStatuses, ablation, valResults, trainResults, marketCalibrations, stateWeights } = runSimulation(batchSize, seed);
  
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

  const shUnderCalib = marketCalibrations.find(m => m.market === 'SH_UNDER');
  const ftOuCalib = marketCalibrations.find(m => m.market === 'FT_OU');
  const ahCalib = marketCalibrations.find(m => m.market === 'AH_HOME');

  const shUnderPostEce = shUnderCalib?.postCalibrationECE || 1;
  const ftOuPostEce = ftOuCalib?.postCalibrationECE || 1;
  const ahPostEce = ahCalib?.postCalibrationECE || 1;
  
  const shUnderTemp = shUnderCalib?.params?.A || 1.0; // slope A roughly equals 1/T for variance
  const shUnderBias = shUnderCalib?.params?.B || 0.0;
  
  const helpfulFeaturesCount = ablation.filter(a => a.decision === 'KEEP').length;

  const success1 = shUnderPostEce < 0.10;
  const success2 = shUnderBias < -0.5; // Expect negative bias due to class imbalance (20% base rate)
  const success3 = valBaselines.modelShUnderRoi > 0.03;
  const success4 = ftOuPostEce < 0.08;
  const success5 = ahPostEce < 0.10;
  const success6 = helpfulFeaturesCount >= 2;

  const isModelReady = success1 && success2 && success3 && success4 && success5 && success6;

  if (!success1) redFlags.push('SH_UNDER_ECE_FAIL');
  if (!success2) redFlags.push('SH_UNDER_BIAS_FAIL');
  if (!success3) redFlags.push('SH_UNDER_ROI_FAIL');
  if (!success4) redFlags.push('FT_OU_ECE_FAIL');
  if (!success5) redFlags.push('AH_ECE_FAIL');
  if (!success6) redFlags.push('ABLATION_FAIL');

  let avgMlEdge = 0, avgAhEdge = 0, avgOuEdge = 0, avgShEdge = 0;
  let countMl = 0, countAh = 0, countOu = 0, countSh = 0;
  
  for (const e of edges) {
    if (e.market === 'Moneyline') { avgMlEdge += e.edge; countMl++; }
    if (e.market === 'Asian Handicap') { avgAhEdge += e.edge; countAh++; }
    if (e.market === 'Over/Under') { avgOuEdge += e.edge; countOu++; }
    if (e.market === 'Second Half Under') { avgShEdge += e.edge; countSh++; }
  }

  const reportContent = `# Sprint 1.7 Post-Calibration Validation Report

**Status:** ${isModelReady ? 'PROCEED TO SPRINT 2' : 'NOT READY'}

## Success Criteria Evaluation
- [${success1 ? 'x' : ' '}] **SH Under ECE < 10%** (${(shUnderPostEce * 100).toFixed(2)}%)
- [${success2 ? 'x' : ' '}] **SH Under bias < -0.5** (A=${shUnderTemp.toFixed(2)}, B=${shUnderBias.toFixed(2)})
- [${success3 ? 'x' : ' '}] **SH Under ROI > +3%** after vig (${(valBaselines.modelShUnderRoi * 100).toFixed(2)}%)
- [${success4 ? 'x' : ' '}] **FT O/U ECE < 8%** (${(ftOuPostEce * 100).toFixed(2)}%)
- [${success5 ? 'x' : ' '}] **AH ECE < 10%** (${(ahPostEce * 100).toFixed(2)}%)
- [${success6 ? 'x' : ' '}] **Ablation helps** (${helpfulFeaturesCount} features kept)

## Train vs Validation Metrics

| Metric | Training (70%) | Validation (30%) |
|--------|----------------|------------------|
| **SH Under ROI** | ${(trainBaselines.modelShUnderRoi * 100).toFixed(2)}% | ${(valBaselines.modelShUnderRoi * 100).toFixed(2)}% |
| **Brier Score (SH Under)** | ${trainMetrics.brierScore.toFixed(4)} | ${valMetrics.brierScore.toFixed(4)} |

## Red Flags
- ${redFlags.length > 0 ? redFlags.join('\n- ') : 'None'}
`;

  fs.writeFileSync(path.join(process.cwd(), 'MODEL_READINESS.md'), reportContent);
  console.log('Generated MODEL_READINESS.md successfully.');

  const ablationMd = `# SH Under Ablation Report (Post-Calibration)

| Feature | Base Brier | Ablated Brier | Marginal Contribution | Decision |
|---------|------------|---------------|-----------------------|----------|
${ablation.map(a => `| ${a.feature} | ${a.brierScoreWith.toFixed(4)} | ${a.brierScoreWithout.toFixed(4)} | ${a.marginalContribution > 0 ? '+' : ''}${a.marginalContribution.toFixed(5)} | **${a.decision}** |`).join('\n')}
`;
  fs.writeFileSync(path.join(process.cwd(), 'SH_UNDER_ABLATION_REPORT.md'), ablationMd);
  console.log('Generated SH_UNDER_ABLATION_REPORT.md successfully.');

  const diagnosticMd = generateCalibrationDiagnostic(valResults);
  fs.writeFileSync(path.join(process.cwd(), 'CALIBRATION_DIAGNOSTIC.md'), diagnosticMd);
  console.log('Generated CALIBRATION_DIAGNOSTIC.md successfully.');
  const htDecomposition = runHTDecomposition(valResults);
  const htTempoInteraction = runHTInteractionTest(trainResults, valResults, 'tempo', i => (i.domain_tempo || 0));
  const htPressureInteraction = runHTInteractionTest(trainResults, valResults, 'pressure', i => (i.domain_pressure || 0));
  const htDefShapeInteraction = runHTInteractionTest(trainResults, valResults, 'defShape', i => (i.domain_defensiveShapeHome || 0) + (i.domain_defensiveShapeAway || 0));
  const interactions = [htTempoInteraction, htPressureInteraction, htDefShapeInteraction];

  let htReportMd = `# HT Decomposition Report

## Conditional Metrics (by HT Score State)
| HT Score | Samples | Base Rate | ECE | Brier | ROI | Edge Exists? |
|----------|---------|-----------|-----|-------|-----|--------------|
`;
  
  for (const r of htDecomposition) {
    htReportMd += `| ${r.htScoreState} | ${r.sampleSize} | ${(r.baseRate * 100).toFixed(1)}% | ${(r.ece * 100).toFixed(2)}% | ${r.brierScore.toFixed(4)} | ${(r.roi * 100).toFixed(2)}% | **${r.edgeExists ? 'YES' : 'NO'}** |\n`;
  }

  htReportMd += `
## Interaction Test Results
| Interaction | Base Brier | New Brier | Brier Impr. | Base ROI | New ROI | ROI Impr. | Significant? |
|-------------|------------|-----------|-------------|----------|---------|-----------|--------------|
`;

  for (const i of interactions) {
    htReportMd += `| ${i.interactionName} | ${i.baseBrier.toFixed(4)} | ${i.newBrier.toFixed(4)} | ${(i.brierImprovement > 0 ? '+' : '')}${i.brierImprovement.toFixed(5)} | ${(i.baseRoi * 100).toFixed(2)}% | ${(i.newRoi * 100).toFixed(2)}% | ${(i.roiImprovement * 100).toFixed(2)}% | **${i.isSignificant ? 'YES' : 'NO'}** |\n`;
  }

  const significantCount = interactions.filter(i => i.isSignificant).length;
  htReportMd += `
## Recommendation
${significantCount > 0 
  ? `Signal exists in ${significantCount} conditional interaction(s). Investigate state coefficients.` 
  : `No conditional signal found. The features provide no edge even when segmented by HT score.`}
`;

  fs.writeFileSync(path.join(process.cwd(), 'HT_DECOMPOSITION_REPORT.md'), htReportMd);
  console.log('Generated HT_DECOMPOSITION_REPORT.md successfully.');

  let stateWeightMd = `# State Weight Matrix & Fallback Report

## Platt Calibration
| Market | A (Slope) | B (Bias) |
|--------|-----------|----------|
`;
  for (const m of marketCalibrations) {
    stateWeightMd += `| ${m.market} | ${m.params.A.toFixed(4)} | ${m.params.B.toFixed(4)} |\n`;
  }

  stateWeightMd += `
## State Weights (Level 2)
| State | Samples | Fallback | Bias | Tempo Weight | Pressure Weight | DefShape Weight | Cond. ECE (Val) |
|-------|---------|----------|------|--------------|-----------------|-----------------|-----------------|
`;

  let fallbackCount = 0;
  for (const [state, result] of Object.entries(stateWeights)) {
    if (result.fallback) fallbackCount++;
    const w = result.weights;
    const valStateResults = htDecomposition.find(d => d.htScoreState === state);
    const condEce = valStateResults ? `${(valStateResults.ece * 100).toFixed(2)}%` : 'N/A';
    
    if (w) {
      stateWeightMd += `| ${state} | ${result.sampleSize} | NO | ${w.bias.toFixed(4)} | ${w.tempo_weight.toFixed(4)} | ${w.pressure_weight.toFixed(4)} | ${w.defShape_weight.toFixed(4)} | ${condEce} |\n`;
    } else {
      stateWeightMd += `| ${state} | ${result.sampleSize} | **YES** | - | - | - | - | ${condEce} |\n`;
    }
  }

  const fallbackFreq = (fallbackCount / Object.keys(stateWeights).length) * 100;
  stateWeightMd += `
**Fallback Frequency:** ${fallbackFreq.toFixed(1)}%
`;

  fs.writeFileSync(path.join(process.cwd(), 'STATE_WEIGHT_MATRIX.md'), stateWeightMd);
  console.log('Generated STATE_WEIGHT_MATRIX.md successfully.');
}

main().catch(console.error);
