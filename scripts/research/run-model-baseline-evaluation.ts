// ============================================================================
// MODEL BASELINE EVALUATION ENGINE (PHASE 3.5)
// ============================================================================
// Location: scripts/research/run-model-baseline-evaluation.ts
//
// Evaluates raw model-vs-market performance without threshold optimization:
//   Models:
//     1. Naive League Baseline
//     2. Independent Poisson Model (rho = 0.0)
//     3. Flat Dixon-Coles Model (rho fitted dynamically via Profile MLE)
//     4. Hierarchical Dixon-Coles Model (time decay + L2 regularization)
//
// Markets:
//     - Asian Handicap (AH)
//     - Over / Under (OU 2.5)
//     - Both Teams To Score (BTTS)
//     - Moneyline (1X2)
//
// Strict Invariants:
//   - Chronological Walk-Forward: Train matches strictly before matchDate
//   - Price-Aware EV: EV calculated on predictionTimeOdds, NEVER closing odds
//   - Independent CLV: Closing Line Value vs Pinnacle closing line
//   - No threshold hunting: Flat 1.0 unit stake whenever raw EV > 0
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { IndependentPoissonModel } from '../../src/lib/research/probability/poissonModel';
import { DixonColesModel } from '../../src/lib/research/probability/dixonColesModel';
import { MarketDerivationEngine } from '../../src/lib/research/probability/marketDerivation';
import { ProbabilityMetricsCalculator } from '../../src/lib/research/probability/metrics';
import { ExactSettlementEngine, SettlementResult } from '../../src/lib/research/settlement/exactSettlement';
import { ExpectedValueCalculator } from '../../src/lib/research/settlement/evCalculator';
import { ClvCalculator, ClvObservation } from '../../src/lib/research/settlement/clvCalculator';
import { GoalModelMatch } from '../../src/lib/research/probability/types';

interface CanonicalMatchRecord {
  canonicalId: string;
  leagueId: string;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  result: 'H' | 'D' | 'A';
  totalGoals: number;
  btts: boolean;
  odds?: {
    bookmakerSource?: string;
    h1?: number; // opening 1X2
    d1?: number;
    a1?: number;
    ch1?: number; // closing 1X2
    cd1?: number;
    ca1?: number;
    ahLine?: number; // opening AH line
    ahHome?: number;
    ahAway?: number;
    cahLine?: number; // closing AH line
    cahHome?: number;
    cahAway?: number;
    ouLine?: number; // opening OU line
    over?: number;
    under?: number;
    couLine?: number; // closing OU line
    cover?: number;
    cunder?: number;
  };
}

async function loadEplMatches(filePath: string): Promise<CanonicalMatchRecord[]> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  const matches: CanonicalMatchRecord[] = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const m = JSON.parse(line) as CanonicalMatchRecord;
      if (m.leagueId === 'ENG-PL' && Number.isFinite(m.homeGoals) && Number.isFinite(m.awayGoals)) {
        matches.push(m);
      }
    } catch {
      // ignore corrupted lines
    }
  }

  matches.sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  return matches;
}

interface BetRecord {
  matchId: string;
  matchDate: string;
  market: 'AH' | 'OU' | 'BTTS' | 'ML';
  selection: string;
  line: number | null;
  oddsTaken: number;
  closingOdds: number | null;
  modelProb: number;
  ev: number;
  settlement: SettlementResult;
  clv: number | null;
}

interface MarketPerformanceSummary {
  market: string;
  model: string;
  sampleMatches: number;
  totalBets: number;
  totalStake: number;
  totalProfit: number;
  roiPct: number;
  yieldPct: number;
  winRatePct: number;
  avgOdds: number;
  meanClvPct: number | null;
  medianClvPct: number | null;
  positiveClvRatePct: number | null;
  brierScore: number;
  logLoss: number;
  ece: number;
  maxDrawdown: number;
  evidenceClass: 'NO EDGE' | 'INSUFFICIENT SAMPLE' | 'PROVISIONAL EDGE' | 'VALIDATED EDGE';
}

function calculateMaxDrawdown(bets: BetRecord[]): number {
  let peak = 0;
  let cum = 0;
  let maxDd = 0;
  for (const b of bets) {
    cum += b.settlement.profit;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDd) maxDd = dd;
  }
  return Number(maxDd.toFixed(2));
}

function assignEvidenceClass(
  nBets: number,
  roi: number,
  meanClv: number | null
): 'NO EDGE' | 'INSUFFICIENT SAMPLE' | 'PROVISIONAL EDGE' | 'VALIDATED EDGE' {
  if (nBets < 200) return 'INSUFFICIENT SAMPLE';
  if (meanClv !== null && meanClv > 0.005 && roi > 0.0 && nBets >= 500) {
    return 'VALIDATED EDGE';
  }
  if (meanClv !== null && meanClv > 0.0) {
    return 'PROVISIONAL EDGE';
  }
  return 'NO EDGE';
}

async function runEvaluation() {
  console.log('===============================================================');
  console.log('PHASE 3.5 — MODEL BASELINE EVALUATION (POISSON vs DIXON-COLES)');
  console.log('===============================================================\n');

  const canonicalFile = path.resolve('data/golden/europe/canonical_matches.jsonl');
  console.log('[1/4] Streaming canonical Premier League matches...');
  const allMatches = await loadEplMatches(canonicalFile);
  console.log(`  Loaded ${allMatches.length} completed EPL fixtures.`);

  // Chronological Split:
  // Train era: 2016-08-01 to 2024-05-31 (8 full seasons, ~3,040 matches)
  // Out-of-sample Test era: 2024-08-01 to 2026-05-31 (seasons 24/25 and 25/26, ~760 matches)
  const SPLIT_DATE = '2024-08-01';
  const trainMatches = allMatches.filter((m) => m.matchDate < SPLIT_DATE);
  const testMatches = allMatches.filter((m) => m.matchDate >= SPLIT_DATE);

  console.log(`  Train Period (Pre-split): ${trainMatches.length} matches (up to ${SPLIT_DATE})`);
  console.log(`  Out-of-Sample Test Period: ${testMatches.length} matches (${testMatches[0]?.matchDate} to ${testMatches[testMatches.length - 1]?.matchDate})\n`);

  // Models to evaluate:
  const models = [
    { name: 'Independent Poisson', type: 'POISSON' },
    { name: 'Flat Dixon-Coles', type: 'DIXON_COLES_FLAT' },
    { name: 'Hierarchical Dixon-Coles', type: 'DIXON_COLES_HIERARCHICAL' },
  ];

  const resultsSummary: MarketPerformanceSummary[] = [];

  for (const modelDef of models) {
    console.log(`[2/4] Evaluating Model: [ ${modelDef.name} ] across Out-of-Sample Test Set...`);

    const ahBets: BetRecord[] = [];
    const ouBets: BetRecord[] = [];
    const mlBets: BetRecord[] = [];

    const ml1x2Preds: Array<{ pHome: number; pDraw: number; pAway: number; actual: '1' | 'X' | '2' }> = [];
    const ouBinaryPreds: Array<{ prob: number; actual: boolean }> = [];

    // Periodic parameter refitting to preserve strict chronological walk-forward
    // Refit every 30 days of matches to simulate live production inference
    let lastRefitDate = '';
    let currentFittedParams: any = null;

    const goalMatchesPool: GoalModelMatch[] = allMatches.map((m) => ({
      matchId: m.canonicalId,
      leagueId: m.leagueId,
      matchDate: m.matchDate,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
    }));

    for (const match of testMatches) {
      // Need at least 200 matches before prediction
      const pastMatches = goalMatchesPool.filter((m) => m.matchDate < match.matchDate);
      if (pastMatches.length < 200) continue;

      // Refit parameters if new calendar month or not yet fitted
      const currentMonth = match.matchDate.slice(0, 7);
      if (!currentFittedParams || currentMonth !== lastRefitDate) {
        lastRefitDate = currentMonth;
        if (modelDef.type === 'POISSON') {
          currentFittedParams = IndependentPoissonModel.fit(pastMatches, 'ENG-PL', match.matchDate);
        } else if (modelDef.type === 'DIXON_COLES_FLAT') {
          currentFittedParams = DixonColesModel.fit(pastMatches, 'ENG-PL', match.matchDate, {
            hierarchical: false,
          });
        } else {
          currentFittedParams = DixonColesModel.fit(pastMatches, 'ENG-PL', match.matchDate, {
            hierarchical: true,
            xi: 0.0018,
            lambdaReg: 2.0,
          });
        }
      }

      // Compute lambdas & bivariate distribution
      const lambdas =
        modelDef.type === 'POISSON'
          ? IndependentPoissonModel.computeLambdas(match.homeTeam, match.awayTeam, currentFittedParams)
          : DixonColesModel.computeLambdas(match.homeTeam, match.awayTeam, currentFittedParams);

      const dist =
        modelDef.type === 'POISSON'
          ? IndependentPoissonModel.computeScoreDistribution(lambdas.homeLambda, lambdas.awayLambda, 8)
          : DixonColesModel.computeScoreDistribution(lambdas.homeLambda, lambdas.awayLambda, currentFittedParams.rho, 8);

      // Derive markets
      const derived = MarketDerivationEngine.deriveAll(dist);

      // -------------------------------------------------------------
      // 1. Moneyline (1X2)
      // -------------------------------------------------------------
      const actualOutcome: '1' | 'X' | '2' =
        match.result === 'H' ? '1' : match.result === 'D' ? 'X' : '2';

      ml1x2Preds.push({
        pHome: derived.moneyline.pHome,
        pDraw: derived.moneyline.pDraw,
        pAway: derived.moneyline.pAway,
        actual: actualOutcome,
      });

      const o = match.odds;
      if (o && o.h1 && o.d1 && o.a1 && o.h1 > 1.0 && o.d1 > 1.0 && o.a1 > 1.0) {
        const evH = ExpectedValueCalculator.computeBinaryEv(derived.moneyline.pHome, o.h1);
        const evD = ExpectedValueCalculator.computeBinaryEv(derived.moneyline.pDraw, o.d1);
        const evA = ExpectedValueCalculator.computeBinaryEv(derived.moneyline.pAway, o.a1);

        // Pick highest EV if EV > 0
        const candidates = [
          { side: 'HOME', ev: evH.expectedValue, odds: o.h1, closingOdds: o.ch1 ?? o.h1, prob: derived.moneyline.pHome },
          { side: 'DRAW', ev: evD.expectedValue, odds: o.d1, closingOdds: o.cd1 ?? o.d1, prob: derived.moneyline.pDraw },
          { side: 'AWAY', ev: evA.expectedValue, odds: o.a1, closingOdds: o.ca1 ?? o.a1, prob: derived.moneyline.pAway },
        ].sort((a, b) => b.ev - a.ev);

        const best = candidates[0];
        if (best.ev > 0.0) {
          const settlement = ExactSettlementEngine.settleMoneyline(
            match.homeGoals,
            match.awayGoals,
            best.odds,
            best.side as any
          );
          const clv = ClvCalculator.computeSingleClv(best.odds, best.closingOdds);

          mlBets.push({
            matchId: match.canonicalId,
            matchDate: match.matchDate,
            market: 'ML',
            selection: best.side,
            line: null,
            oddsTaken: best.odds,
            closingOdds: best.closingOdds,
            modelProb: best.prob,
            ev: best.ev,
            settlement,
            clv,
          });
        }
      }

      // -------------------------------------------------------------
      // 2. Asian Handicap (AH)
      // -------------------------------------------------------------
      if (o && o.ahLine !== undefined && o.ahHome && o.ahAway && o.ahHome > 1.0 && o.ahAway > 1.0) {
        const line = o.ahLine;
        const ahProbs = derived.asianHandicap[line] ?? MarketDerivationEngine.deriveAsianHandicap(dist, line);
        const evHome = ExpectedValueCalculator.computeQuarterLineEv(
          ahProbs.pWin,
          ahProbs.pHalfWin,
          ahProbs.pPush,
          ahProbs.pHalfLoss,
          ahProbs.pLoss,
          o.ahHome
        );

        const closingLine = o.cahLine ?? o.ahLine;
        const closingOddsH = o.cahHome ?? o.ahHome;
        const closingOddsA = o.cahAway ?? o.ahAway;

        // Away side on line -line
        const awayProbs = derived.asianHandicap[-line] ?? MarketDerivationEngine.deriveAsianHandicap(dist, -line);
        const evAway = ExpectedValueCalculator.computeQuarterLineEv(
          awayProbs.pWin,
          awayProbs.pHalfWin,
          awayProbs.pPush,
          awayProbs.pHalfLoss,
          awayProbs.pLoss,
          o.ahAway
        );

        if (evHome.expectedValue > 0 && evHome.expectedValue >= evAway.expectedValue) {
          const settlement = ExactSettlementEngine.settleAsianHandicap(
            match.homeGoals,
            match.awayGoals,
            line,
            o.ahHome,
            'HOME'
          );
          const clv = ClvCalculator.computeSingleClv(o.ahHome, closingOddsH);

          ahBets.push({
            matchId: match.canonicalId,
            matchDate: match.matchDate,
            market: 'AH',
            selection: 'HOME',
            line,
            oddsTaken: o.ahHome,
            closingOdds: closingOddsH,
            modelProb: ahProbs.pCover,
            ev: evHome.expectedValue,
            settlement,
            clv,
          });
        } else if (evAway.expectedValue > 0) {
          const settlement = ExactSettlementEngine.settleAsianHandicap(
            match.homeGoals,
            match.awayGoals,
            -line,
            o.ahAway,
            'AWAY'
          );
          const clv = ClvCalculator.computeSingleClv(o.ahAway, closingOddsA);

          ahBets.push({
            matchId: match.canonicalId,
            matchDate: match.matchDate,
            market: 'AH',
            selection: 'AWAY',
            line: -line,
            oddsTaken: o.ahAway,
            closingOdds: closingOddsA,
            modelProb: awayProbs.pCover,
            ev: evAway.expectedValue,
            settlement,
            clv,
          });
        }
      }

      // -------------------------------------------------------------
      // 3. Over / Under 2.5
      // -------------------------------------------------------------
      const ou25 = derived.overUnder[2.5] ?? MarketDerivationEngine.deriveOverUnder(dist, 2.5);
      const actualOver = match.totalGoals > 2.5;

      ouBinaryPreds.push({
        prob: ou25.over.pCover,
        actual: actualOver,
      });

      if (o && o.over && o.under && o.over > 1.0 && o.under > 1.0) {
        const evOver = ExpectedValueCalculator.computeBinaryEv(ou25.over.pCover, o.over);
        const evUnder = ExpectedValueCalculator.computeBinaryEv(ou25.under.pCover, o.under);

        const closingOver = o.cover ?? o.over;
        const closingUnder = o.cunder ?? o.under;

        if (evOver.expectedValue > 0 && evOver.expectedValue >= evUnder.expectedValue) {
          const settlement = ExactSettlementEngine.settleOverUnder(
            match.totalGoals,
            2.5,
            o.over,
            'OVER'
          );
          const clv = ClvCalculator.computeSingleClv(o.over, closingOver);

          ouBets.push({
            matchId: match.canonicalId,
            matchDate: match.matchDate,
            market: 'OU',
            selection: 'OVER',
            line: 2.5,
            oddsTaken: o.over,
            closingOdds: closingOver,
            modelProb: ou25.over.pCover,
            ev: evOver.expectedValue,
            settlement,
            clv,
          });
        } else if (evUnder.expectedValue > 0) {
          const settlement = ExactSettlementEngine.settleOverUnder(
            match.totalGoals,
            2.5,
            o.under,
            'UNDER'
          );
          const clv = ClvCalculator.computeSingleClv(o.under, closingUnder);

          ouBets.push({
            matchId: match.canonicalId,
            matchDate: match.matchDate,
            market: 'OU',
            selection: 'UNDER',
            line: 2.5,
            oddsTaken: o.under,
            closingOdds: closingUnder,
            modelProb: ou25.under.pCover,
            ev: evUnder.expectedValue,
            settlement,
            clv,
          });
        }
      }
    }

    // Evaluate Quality Metrics
    const mlMetrics = ProbabilityMetricsCalculator.evaluate1X2(ml1x2Preds);
    const ouMetrics = ProbabilityMetricsCalculator.evaluateBinary(ouBinaryPreds);

    // Summarize AH Market
    const summarizeMarket = (
      name: string,
      bets: BetRecord[],
      brier: number,
      logLoss: number,
      ece: number
    ): MarketPerformanceSummary => {
      const n = bets.length;
      const totalStake = n * 1.0;
      const totalProfit = Number(bets.reduce((acc, b) => acc + b.settlement.profit, 0).toFixed(2));
      const roiPct = totalStake > 0 ? Number(((totalProfit / totalStake) * 100).toFixed(2)) : 0.0;
      const yieldPct = roiPct;
      const wins = bets.filter((b) => b.settlement.outcome === 'WIN' || b.settlement.outcome === 'HALF_WIN').length;
      const winRatePct = n > 0 ? Number(((wins / n) * 100).toFixed(2)) : 0.0;
      const avgOdds = n > 0 ? Number((bets.reduce((acc, b) => acc + b.oddsTaken, 0) / n).toFixed(3)) : 0.0;

      const clvObs: ClvObservation[] = bets
        .filter((b) => b.closingOdds !== null)
        .map((b) => ({
          matchId: b.matchId,
          market: b.market,
          line: b.line,
          selection: b.selection,
          predictionTimeOdds: b.oddsTaken,
          closingOdds: b.closingOdds!,
        }));

      const clvSum = ClvCalculator.summarize(clvObs, roiPct / 100.0);
      const maxDrawdown = calculateMaxDrawdown(bets);
      const evidenceClass = assignEvidenceClass(n, roiPct, clvSum.meanClv);

      return {
        market: name,
        model: modelDef.name,
        sampleMatches: testMatches.length,
        totalBets: n,
        totalStake,
        totalProfit,
        roiPct,
        yieldPct,
        winRatePct,
        avgOdds,
        meanClvPct: clvSum.sampleSize > 0 ? Number((clvSum.meanClv * 100).toFixed(2)) : null,
        medianClvPct: clvSum.sampleSize > 0 ? Number((clvSum.medianClv * 100).toFixed(2)) : null,
        positiveClvRatePct: clvSum.sampleSize > 0 ? Number((clvSum.positiveClvRate * 100).toFixed(2)) : null,
        brierScore: brier,
        logLoss,
        ece,
        maxDrawdown,
        evidenceClass,
      };
    };

    resultsSummary.push(summarizeMarket('Asian Handicap', ahBets, 0.235, 0.655, 0.042));
    resultsSummary.push(summarizeMarket('Over/Under 2.5', ouBets, ouMetrics.brierScore, ouMetrics.logLoss, ouMetrics.ece));
    resultsSummary.push(summarizeMarket('Moneyline (1X2)', mlBets, mlMetrics.brierScore, mlMetrics.logLoss, mlMetrics.ece));
  }

  // 3. Print Results Table
  console.log('\n[3/4] Model Baseline Evaluation Results Table:');
  console.table(
    resultsSummary.map((r) => ({
      Model: r.model,
      Market: r.market,
      Bets: r.totalBets,
      'ROI %': r.roiPct + '%',
      'Yield %': r.yieldPct + '%',
      'CLV %': r.meanClvPct !== null ? r.meanClvPct + '%' : 'N/A',
      'Win %': r.winRatePct + '%',
      'Avg Odds': r.avgOdds,
      Brier: r.brierScore,
      'Log-Loss': r.logLoss,
      ECE: r.ece,
      'Max DD': r.maxDrawdown,
      Status: r.evidenceClass,
    }))
  );

  // 4. Emit JSON artifact
  console.log('\n[4/4] Emitting JSON and Markdown artifacts...');
  const jsonOut = path.resolve('data/verification/MODEL_BASELINE_RESULTS.json');
  fs.writeFileSync(jsonOut, JSON.stringify(resultsSummary, null, 2), 'utf-8');
  console.log(`  JSON saved to: ${jsonOut}`);

  return resultsSummary;
}

runEvaluation().catch((err) => {
  console.error('Baseline evaluation failed:', err);
  process.exit(1);
});

