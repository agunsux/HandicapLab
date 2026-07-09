import { runSimulation } from '../lib/simulation/batchRunner';
import { learnStateWeights, StateWeightResult } from '../lib/calibration/stateWeightLearner';
import { fitPlattScaling, applyPlattScaling } from '../lib/calibration/plattScaling';
import { runHTDecomposition } from '../lib/validation/htDecomposition';
import { calculateBrierScore } from '../lib/validation/calibration';
import { generatePrediction, MatchInput } from '../services/probability.engine';
import { sigmoid } from '../lib/math/metrics';

import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('=========================================');
  console.log('       Retraining Model on Real Data     ');
  console.log('=========================================\n');

  const sampleFile = path.join(process.cwd(), 'cache', 'api-football', 'quick_sample.json');
  if (!fs.existsSync(sampleFile)) {
    console.error(`Quick sample file not found: ${sampleFile}. Run fetchQuickSample first.`);
    return;
  }

  const rawMatches = JSON.parse(fs.readFileSync(sampleFile, 'utf-8'));
  console.log(`Loaded ${rawMatches.length} matches from quick sample.`);

  // 1. Train / Test Split (70/30)
  const trainSize = Math.floor(rawMatches.length * 0.7);
  const trainData = rawMatches.slice(0, trainSize);
  const valData = rawMatches.slice(trainSize);

  console.log(`Split: ${trainData.length} training matches, ${valData.length} validation matches.`);

  // 2. Train State weights on Real Data (minSamples=5 for quick sample)
  // Convert TransformedMatch structures to format expected by learner:
  // trainData structure: Array<{ input: MatchInput, outcome: MatchSimulationResult }>
  const trainInputs = trainData.map((d: any) => ({
    input: d.input,
    outcome: {
      shTotalGoals: d.outcome.shTotalGoals,
      homeGoals: d.outcome.ftHomeGoals,
      awayGoals: d.outcome.ftAwayGoals,
      homeWin: d.outcome.ftHomeGoals > d.outcome.ftAwayGoals,
      awayWin: d.outcome.ftAwayGoals > d.outcome.ftHomeGoals
    }
  }));

  const valInputs = valData.map((d: any) => ({
    input: d.input,
    outcome: {
      shTotalGoals: d.outcome.shTotalGoals,
      homeGoals: d.outcome.ftHomeGoals,
      awayGoals: d.outcome.ftAwayGoals,
      homeWin: d.outcome.ftHomeGoals > d.outcome.ftAwayGoals,
      awayWin: d.outcome.ftAwayGoals > d.outcome.ftHomeGoals
    }
  }));

  const realStateWeights = learnStateWeights(trainInputs as any, 5);

  // 3. Fit Platt Calibration on Real Data
  const trainPredictions = trainInputs.map((d: any) => {
    const pred = generatePrediction(d.input, realStateWeights);
    return {
      logit: pred.marketLogits.SH_UNDER,
      actual: d.outcome.shTotalGoals < (d.input.sh_ou_line || 1.5) ? 1 : 0
    };
  });

  const realPlattParams = fitPlattScaling(
    trainPredictions.map((x: { logit: number; actual: number }) => x.logit),
    trainPredictions.map((x: { logit: number; actual: number }) => x.actual)
  );

  // 4. Run Validation for Real-Data Model
  const valPredictions = valData.map((d: any) => {
    const predCopy = generatePrediction(d.input, realStateWeights);
    // Apply calibration
    predCopy.sh_ou_under_prob = applyPlattScaling(predCopy.marketLogits.SH_UNDER, realPlattParams);
    predCopy.sh_ou_over_prob = 1 - predCopy.sh_ou_under_prob;
    return {
      input: d.input,
      pred: predCopy,
      outcome: {
        shTotalGoals: d.outcome.shTotalGoals,
        homeGoals: d.outcome.ftHomeGoals,
        awayGoals: d.outcome.ftAwayGoals,
        homeWin: d.outcome.ftHomeGoals > d.outcome.ftAwayGoals,
        awayWin: d.outcome.ftAwayGoals > d.outcome.ftHomeGoals
      }
    };
  });

  const realECEs = runHTDecomposition(valPredictions as any);

  // Calculate real Brier score
  const realBrierPairs = valPredictions.map((p: any) => ({
    prob: p.pred.sh_ou_under_prob,
    outcome: p.outcome.shTotalGoals < (p.input.sh_ou_line || 1.5) ? 1 : 0
  }));
  const realBrier = calculateBrierScore(realBrierPairs);

  // 5. Load Simulated Model from Simulation Run (Seed 42)
  console.log('Generating simulated model for comparison (Seed 42)...');
  const simRun = runSimulation(10000, 42);
  const simStateWeights = simRun.stateWeights;
  const simPlattParams = simRun.marketCalibrations.find(m => m.market === 'SH_UNDER')?.params || { A: 1.0, B: 0.0 };

  // 6. Evaluate Simulated Model on Real Validation Set
  const valPredictionsSim = valData.map((d: any) => {
    const predCopy = generatePrediction(d.input, simStateWeights);
    // Apply simulated calibration
    predCopy.sh_ou_under_prob = applyPlattScaling(predCopy.marketLogits.SH_UNDER, simPlattParams);
    predCopy.sh_ou_over_prob = 1 - predCopy.sh_ou_under_prob;
    return {
      input: d.input,
      pred: predCopy,
      outcome: {
        shTotalGoals: d.outcome.shTotalGoals,
        homeGoals: d.outcome.ftHomeGoals,
        awayGoals: d.outcome.ftAwayGoals,
        homeWin: d.outcome.ftHomeGoals > d.outcome.ftAwayGoals,
        awayWin: d.outcome.ftAwayGoals > d.outcome.ftHomeGoals
      }
    };
  });

  const simBrierPairs = valPredictionsSim.map((p: any) => ({
    prob: p.pred.sh_ou_under_prob,
    outcome: p.outcome.shTotalGoals < (p.input.sh_ou_line || 1.5) ? 1 : 0
  }));
  const simBrier = calculateBrierScore(simBrierPairs);

  // 7. Calculate ROI after vig
  const calculateRoi = (preds: typeof valPredictions) => {
    let profit = 0;
    let risk = 0;
    for (const p of preds) {
      const line = p.input.sh_ou_line || 1.5;
      const odds = p.input.sh_ou_odds_under || 1.91; // assume standard 1.91 vig
      const prob = p.pred.sh_ou_under_prob;
      const actualUnder = p.outcome.shTotalGoals < line ? 1 : 0;

      const ev = (prob * odds) - 1;
      if (ev > 0) {
        risk++;
        profit += actualUnder ? (odds - 1) : -1;
      }
    }
    return risk > 0 ? profit / risk : 0;
  };

  const realRoi = calculateRoi(valPredictions as any);
  const simRoi = calculateRoi(valPredictionsSim as any);

  // 8. Generate REAL_DATA_VALIDATION.md report
  let reportMd = `# Real Data Validation Report (Phase 1 Quick Sample)

## Model Performance Summary

| Metric | Simulated Model (Seed 42) | Real Data Model |
|--------|---------------------------|-----------------|
| **Validation Brier Score** | ${simBrier.toFixed(5)} | ${realBrier.toFixed(5)} |
| **Validation ROI (SH Under)** | ${(simRoi * 100).toFixed(2)}% | ${(realRoi * 100).toFixed(2)}% |
| **Platt Slope (A)** | ${simPlattParams.A.toFixed(4)} | ${realPlattParams.A.toFixed(4)} |
| **Platt Bias (B)** | ${simPlattParams.B.toFixed(4)} | ${realPlattParams.B.toFixed(4)} |

---

## Conditional Calibration (ECE by HT State)

| HT State | Samples | Real Model ECE | Edge Exists? |
|----------|---------|----------------|--------------|
`;

  for (const r of realECEs) {
    reportMd += `| ${r.htScoreState} | ${r.sampleSize} | ${(r.ece * 100).toFixed(2)}% | **${r.edgeExists ? 'YES' : 'NO'}** |\n`;
  }

  reportMd += `
---

## State Weight Comparison

| HT State | Weight Type | Simulated Model (Seed 42) | Real Data Model |
|----------|-------------|---------------------------|-----------------|
`;

  const states = ['0-0', '1-0', '0-1', '1-1', '2+'];
  for (const s of states) {
    const simRes = simStateWeights[s];
    const realRes = realStateWeights[s];
    
    const simW = simRes?.weights;
    const realW = realRes?.weights;

    const renderWeight = (w: any, type: string) => {
      if (!w) return 'N/A (Fallback)';
      if (type === 'bias') return w.bias.toFixed(4);
      if (type === 'tempo') return w.tempo_weight.toFixed(4);
      if (type === 'pressure') return w.pressure_weight.toFixed(4);
      return w.defShape_weight.toFixed(4);
    };

    reportMd += `| **${s}** | Bias | ${renderWeight(simW, 'bias')} | ${renderWeight(realW, 'bias')} |\n`;
    reportMd += `| **${s}** | Tempo W | ${renderWeight(simW, 'tempo')} | ${renderWeight(realW, 'tempo')} |\n`;
    reportMd += `| **${s}** | Pressure W | ${renderWeight(simW, 'pressure')} | ${renderWeight(realW, 'pressure')} |\n`;
    reportMd += `| **${s}** | DefShape W | ${renderWeight(simW, 'defShape')} | ${renderWeight(realW, 'defShape')} |\n`;
    reportMd += `| | | | |\n`; // visual spacing separator
  }

  fs.writeFileSync(path.join(process.cwd(), 'REAL_DATA_VALIDATION.md'), reportMd);
  console.log('Generated REAL_DATA_VALIDATION.md successfully.');

  // Save the models temporarily for comparison script
  const modelsData = {
    simWeights: simStateWeights,
    realWeights: realStateWeights
  };
  fs.writeFileSync(path.join(process.cwd(), 'cache', 'api-football', 'weights_comparison.json'), JSON.stringify(modelsData, null, 2), 'utf-8');
}

main().catch(console.error);
