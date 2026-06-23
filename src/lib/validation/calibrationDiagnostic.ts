import { MatchSimulationResult } from '../simulation/mockMatchGenerator';
import { PredictionOutput, MatchInput } from '@/services/probability.engine';
import * as fs from 'fs';
import * as path from 'path';

interface BinData {
  range: string;
  count: number;
  predMean: number;
  actualRate: number;
  error: number;
}

interface MarketDiag {
  market: string;
  bins: BinData[];
  ece: number;
}

export function generateCalibrationDiagnostic(results: { pred: PredictionOutput; outcome: MatchSimulationResult; input: MatchInput }[]): string {
  
  const generateBins = (pairs: { prob: number; actual: number }[]): { bins: BinData[], ece: number } => {
    const bins: BinData[] = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10}-${(i + 1) * 10}%`,
      count: 0,
      predMean: 0,
      actualRate: 0,
      error: 0
    }));

    for (const p of pairs) {
      const bIdx = Math.min(9, Math.floor(p.prob * 10));
      bins[bIdx].count++;
      bins[bIdx].predMean += p.prob;
      bins[bIdx].actualRate += p.actual;
    }

    let eceSum = 0;
    const N = pairs.length;

    for (const b of bins) {
      if (b.count > 0) {
        b.predMean /= b.count;
        b.actualRate /= b.count;
        b.error = Math.abs(b.predMean - b.actualRate);
        eceSum += (b.count / N) * b.error;
      }
    }
    return { bins, ece: eceSum };
  };

  const shPairs = results.map(r => ({ prob: r.pred.sh_ou_under_prob, actual: r.outcome.shTotalGoals < (r.input.sh_ou_line || 1.0) ? 1 : 0 }));
  const ahPairs = results.map(r => ({ prob: r.pred.ah_home_prob, actual: r.outcome.homeGoals + r.input.ah_line > r.outcome.awayGoals ? 1 : 0 }));
  const ouPairs = results.map(r => ({ prob: r.pred.ou_over_prob, actual: r.outcome.totalGoals > r.input.ou_line ? 1 : 0 }));
  const mlPairs = results.map(r => ({ prob: r.pred.ml_home_prob, actual: r.outcome.homeWin ? 1 : 0 }));

  const markets: MarketDiag[] = [
    { market: 'Second Half Under', ...generateBins(shPairs) },
    { market: 'Asian Handicap Home', ...generateBins(ahPairs) },
    { market: 'Over/Under Full Time Over', ...generateBins(ouPairs) },
    { market: 'Moneyline Home Win', ...generateBins(mlPairs) }
  ];

  let md = `# Calibration Diagnostic Report\n\n`;

  for (const m of markets) {
    md += `## Market: ${m.market}\n`;
    md += `**Expected Calibration Error (ECE):** ${(m.ece * 100).toFixed(2)}%\n\n`;
    md += `| Bin | Predicted | Actual | Count | Error | Chart (Pred=*, Actual=#) |\n`;
    md += `|---|---|---|---|---|---|\n`;
    for (const b of m.bins) {
      const predChars = Math.round(b.predMean * 20);
      const actChars = Math.round(b.actualRate * 20);
      let chart = '';
      for(let i=0; i<20; i++) {
        if (i < predChars && i < actChars) chart += 'X';
        else if (i < predChars) chart += '*';
        else if (i < actChars) chart += '#';
        else chart += '-';
      }
      md += `| ${b.range} | ${(b.predMean * 100).toFixed(1)}% | ${(b.actualRate * 100).toFixed(1)}% | ${b.count} | ${(b.error * 100).toFixed(1)}% | \`${chart}\` |\n`;
    }
    md += `\n`;
  }

  // Confidence distribution specifically for SH Under
  const shBins = markets[0].bins;
  const totalSH = shPairs.length;
  md += `## Confidence Distribution (Second Half Under)\n`;
  md += `- **Underconfident (< 40% or > 60%):** ${shBins.filter((_, i) => i < 4 || i >= 6).reduce((sum, b) => sum + b.count, 0)} predictions\n`;
  md += `- **Overconfident (70-90% range):** ${shBins.filter((_, i) => i >= 7 && i <= 8).reduce((sum, b) => sum + b.count, 0)} predictions\n`;
  md += `- **Muddled (40-60% range):** ${shBins.filter((_, i) => i >= 4 && i <= 5).reduce((sum, b) => sum + b.count, 0)} predictions\n\n`;

  // Recommendations logic based on SH Under ECE
  md += `## Recommendations\n`;
  const shEce = markets[0].ece;
  
  if (shEce > 0.15) {
    md += `- **Status:** SEVERE CALIBRATION DRIFT. The model's probabilities do not align with actual football outcomes.\n`;
    md += `- **Action Required:** We likely need **Platt Scaling (Logistic Regression)** to map feature outputs correctly, or our feature weights are adding pure noise.\n`;
  } else if (shEce > 0.05) {
    md += `- **Status:** MODERATE MISCALIBRATION.\n`;
    md += `- **Action Required:** A simple **Temperature Scaling** parameter may help soften the sigmoid output.\n`;
  } else {
    md += `- **Status:** WELL CALIBRATED.\n`;
    md += `- **Action Required:** Maintain current probability scaling.\n`;
  }

  return md;
}
