import { generateMockMatch, MatchSimulationResult } from './mockMatchGenerator';
import { generatePrediction, PredictionOutput, MatchInput } from '@/services/probability.engine';
import { generateDistributionReport, ReportMetrics } from '../validation/distributionReport';
import { validatePredictionGuards, evaluateReportGuards } from '../validation/guards';
import { calculateMarketEdge, EdgeReport } from '../validation/edgeReport';
import { evaluateBaselines, BaselinesOutput } from '../validation/baseline';
import { performFeatureAblation, AblationResult } from '../model/featureAnalysis';

function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function runSimulation(batchSize: number = 10000, seed?: number): {
  trainMetrics: ReportMetrics;
  valMetrics: ReportMetrics;
  trainBaselines: BaselinesOutput;
  valBaselines: BaselinesOutput;
  edges: EdgeReport[];
  guardStatuses: string[];
  ablation: AblationResult[];
} {
  const prng = seed !== undefined ? mulberry32(seed) : Math.random;
  
  const originalRandom = Math.random;
  Math.random = prng;

  const results: { pred: PredictionOutput; outcome: MatchSimulationResult; input: MatchInput }[] = [];
  
  let guardFailures = 0;

  for (let i = 0; i < batchSize; i++) {
    const homeStr = 0.5 + Math.random() * 2.0;
    const awayStr = 0.5 + Math.random() * 2.0;
    const { input, outcome } = generateMockMatch(homeStr, awayStr);

    const pred = generatePrediction(input);

    const errors = validatePredictionGuards(pred);
    if (errors.length > 0) {
      guardFailures++;
      if (guardFailures <= 5) {
        console.warn(`[Guard Failure Match ${i}]:`, errors.join(', '));
      }
    }

    results.push({ pred, outcome, input });
  }

  Math.random = originalRandom;

  if (guardFailures > 0) {
    console.warn(`Total prediction guard failures: ${guardFailures} out of ${batchSize}`);
  }

  // Train / Test split
  const trainSize = Math.floor(batchSize * 0.7);
  const trainResults = results.slice(0, trainSize);
  const valResults = results.slice(trainSize);

  const trainMetrics = generateDistributionReport(trainResults);
  const valMetrics = generateDistributionReport(valResults);
  const trainBaselines = evaluateBaselines(trainResults);
  const valBaselines = evaluateBaselines(valResults);
  const guardStatuses = evaluateReportGuards(valMetrics);

  const edges: EdgeReport[] = valResults.map(r => {
    const mlEdge = calculateMarketEdge('Moneyline', 'Home Win', r.pred.ml_home_prob, 1 / r.input.odds_home, 1);
    const ahEdge = calculateMarketEdge('Asian Handicap', 'Home', r.pred.ah_home_prob, 0.5, 1);
    const ouEdge = calculateMarketEdge('Over/Under', 'Over', r.pred.ou_over_prob, 0.5, 1);
    const shLine = r.input.sh_ou_line || 1.0;
    const shImplied = 1 / (r.input.sh_ou_odds_under || 1.91);
    const shEdge = calculateMarketEdge('Second Half Under', `Under ${shLine}`, r.pred.sh_ou_under_prob, shImplied, 1);
    return [mlEdge, ahEdge, ouEdge, shEdge];
  }).flat();

  // Ablation on validation set
  const ablationDataset = valResults.map(r => ({
    features: r.pred.features || [],
    outcome: r.outcome.shTotalGoals < (r.input.sh_ou_line || 1.0) ? 1 : 0
  }));
  const ablation = performFeatureAblation(ablationDataset);

  return { trainMetrics, valMetrics, trainBaselines, valBaselines, edges, guardStatuses, ablation };
}
