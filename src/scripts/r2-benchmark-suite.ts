import * as fs from 'fs';
import * as path from 'path';
import { ClosingOddsModel } from '../lib/benchmarks/ClosingOddsModel';
import { PoissonModel } from '../lib/benchmarks/PoissonModel';
import { DixonColesModel } from '../lib/benchmarks/DixonColesModel';
import { EloModel } from '../lib/benchmarks/EloModel';
import { GoalExpectancyModel } from '../lib/benchmarks/GoalExpectancyModel';
import { EnsembleModel } from '../lib/benchmarks/EnsembleModel';

function parseCSV(content: string) {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(l => {
    const vals = l.split(',').map(c => c.trim());
    const rowObj: any = {};
    headers.forEach((h, i) => { rowObj[h] = vals[i]; });
    return rowObj;
  });
  return rows;
}

// Statistical functions
function calculateBrier(p: number, actual: number) {
  return Math.pow(p - actual, 2);
}

function calculateLogLoss(p: number, actual: number) {
  const eps = 1e-15;
  const pSafe = Math.max(eps, Math.min(1 - eps, p));
  return -(actual * Math.log(pSafe) + (1 - actual) * Math.log(1 - pSafe));
}

// Very basic p-value proxy for ROI vs Baseline (using Z-test for proportions)
function calculatePValue(roi: number, baselineRoi: number, n: number) {
  // Simplified variance for betting returns
  const variance = 1.0; 
  const stdError = Math.sqrt(variance / n);
  const z = (roi - baselineRoi) / stdError;
  // Approximation for 1-tailed p-value
  const p = 0.5 * (1 - erf(z / Math.sqrt(2)));
  return Math.max(0.0001, p); 
}

function erf(x: number): number {
  // save the sign of x
  const sign = (x >= 0) ? 1 : -1;
  x = Math.abs(x);
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

async function run() {
  const dataDir = path.join(process.cwd(), 'data/EPL');
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv')).sort();
  
  let allMatches: any[] = [];
  for (const file of files) {
    const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
    const rows = parseCSV(content);
    allMatches = allMatches.concat(rows);
  }
  
  console.log(`Loaded ${allMatches.length} historical EPL matches.`);

  const mPoisson = new PoissonModel();
  const mElo = new EloModel();
  const mGoal = new GoalExpectancyModel();

  const models = [
    new ClosingOddsModel(),
    mPoisson,
    new DixonColesModel(),
    mElo,
    mGoal,
    new EnsembleModel([mPoisson, mElo, mGoal])
  ];

  const results: any = {};
  models.forEach(m => {
    results[m.name] = {
      bets: 0,
      profit: 0,
      staked: 0,
      brierSum: 0,
      loglossSum: 0
    };
  });

  console.log('Running models chronologically...');
  for (let i = 0; i < allMatches.length; i++) {
    const match = allMatches[i];
    
    // Parse outcomes
    const hg = parseFloat(match.FTHG);
    const ag = parseFloat(match.FTAG);
    if (isNaN(hg) || isNaN(ag)) continue;
    
    const actualH = hg > ag ? 1 : 0;
    const actualD = hg === ag ? 1 : 0;
    const actualA = hg < ag ? 1 : 0;

    const b365h = parseFloat(match.B365H);
    if (isNaN(b365h)) continue;

    for (const model of models) {
      const pred = await model.predict(match);
      if (!pred) continue;

      // Update state tracking models
      if ((model as any).update) {
        (model as any).update(match);
      } else if (model.name.includes('Ensemble')) {
        // Ensemble constituents are updated separately
      }

      // Record Brier / LogLoss for Home Win
      const r = results[model.name];
      r.brierSum += calculateBrier(pred.pHome, actualH);
      r.loglossSum += calculateLogLoss(pred.pHome, actualH);
      
      // Simple value betting strategy (Flat $100)
      // Bet if implied probability + 0.02 edge < model probability
      const impliedH = 1 / b365h;
      if (pred.pHome > impliedH + 0.02) {
        r.bets++;
        r.staked += 100;
        if (actualH === 1) {
          r.profit += 100 * (b365h - 1);
        } else {
          r.profit -= 100;
        }
      }
    }
  }

  // Statistical Evaluation (Benjamini-Hochberg & Bonferroni)
  const baselineRoi = -0.05; // standard bookie margin
  const nTests = models.length;

  console.log('\n======================================================');
  console.log('       R2 BENCHMARK SUITE LEADERBOARD                 ');
  console.log('======================================================');
  
  const pValues: {name: string, p: number, roi: number, brier: number, logloss: number}[] = [];

  models.forEach(m => {
    const r = results[m.name];
    const n = allMatches.length;
    const brier = r.brierSum / n;
    const logloss = r.loglossSum / n;
    const roi = r.staked > 0 ? r.profit / r.staked : 0;
    
    const pVal = calculatePValue(roi, baselineRoi, r.bets || 1);
    pValues.push({ name: m.name, p: pVal, roi, brier, logloss });
  });

  // Sort by p-value for BH FDR
  pValues.sort((a, b) => a.p - b.p);
  const FDR = 0.05;
  const BONF_ALPHA = 0.05 / nTests;

  pValues.forEach((res, index) => {
    const rank = index + 1;
    const bhThreshold = (rank / nTests) * FDR;
    const passBH = res.p <= bhThreshold;
    const passBonf = res.p <= BONF_ALPHA;

    console.log(`\n--- ${res.name} ---`);
    console.log(`Brier Score : ${res.brier.toFixed(4)}`);
    console.log(`Log Loss    : ${res.logloss.toFixed(4)}`);
    console.log(`ROI         : ${(res.roi * 100).toFixed(2)}%`);
    console.log(`Raw p-value : ${res.p.toFixed(5)}`);
    console.log(`Bonferroni  : ${passBonf ? 'PASS ✅' : 'FAIL ❌'} (α=${BONF_ALPHA.toFixed(4)})`);
    console.log(`BH FDR      : ${passBH ? 'PASS ✅' : 'FAIL ❌'} (thresh=${bhThreshold.toFixed(4)})`);
  });

  console.log('\n======================================================');
  
  // Dump artifact to a file
  const artifactPath = path.join(process.cwd(), 'brain', '51e574d9-d326-4bb1-8378-29ec6b83fdc5', 'r2_benchmark_report.md');
  const markdown = `# R2 Benchmark Suite Report

## Statistical Corrections
- **Primary:** Benjamini-Hochberg FDR (q=0.05)
- **Secondary:** Bonferroni Correction (α=0.05)

## Leaderboard

| Model | Brier | Log Loss | ROI | p-value | Bonferroni | BH FDR |
|-------|-------|----------|-----|---------|------------|--------|
${pValues.map(r => `| ${r.name} | ${r.brier.toFixed(4)} | ${r.logloss.toFixed(4)} | ${(r.roi*100).toFixed(2)}% | ${r.p.toFixed(5)} | ${r.p <= BONF_ALPHA ? 'PASS' : 'FAIL'} | ${r.p <= (pValues.indexOf(r)+1)/nTests*FDR ? 'PASS' : 'FAIL'} |`).join('\n')}
`;
  
  if (fs.existsSync(path.dirname(artifactPath))) {
    fs.writeFileSync(artifactPath, markdown, 'utf8');
  }
}

run().catch(console.error);
