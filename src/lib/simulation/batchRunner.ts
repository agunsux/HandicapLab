import { generateMockMatch, MatchSimulationResult } from './mockMatchGenerator';
import { generatePrediction, PredictionOutput, MatchInput } from '@/services/probability.engine';
import { generateDistributionReport, ReportMetrics } from '../validation/distributionReport';
import { validatePredictionGuards, evaluateReportGuards } from '../validation/guards';
import { calculateMarketEdge, EdgeReport } from '../validation/edgeReport';

function mulberry32(a: number) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

export function runSimulation(batchSize: number = 10000, seed?: number): {
  metrics: ReportMetrics;
  edges: EdgeReport[];
  guardStatuses: string[];
} {
  const prng = seed !== undefined ? mulberry32(seed) : Math.random;
  
  const originalRandom = Math.random;
  Math.random = prng;

  const results: { pred: PredictionOutput; outcome: MatchSimulationResult; input: MatchInput }[] = [];
  const edges: EdgeReport[] = [];
  
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

    const mlEdge = calculateMarketEdge('Moneyline', 'Home Win', pred.ml_home_prob, 1 / input.odds_home, 1);
    const ahEdge = calculateMarketEdge('Asian Handicap', 'Home', pred.ah_home_prob, 0.5, 1);
    const ouEdge = calculateMarketEdge('Over/Under', 'Over', pred.ou_over_prob, 0.5, 1);

    edges.push(mlEdge, ahEdge, ouEdge);
    results.push({ pred, outcome, input });
  }

  Math.random = originalRandom;

  if (guardFailures > 0) {
    console.warn(`Total prediction guard failures: ${guardFailures} out of ${batchSize}`);
  }

  const metrics = generateDistributionReport(results);
  const guardStatuses = evaluateReportGuards(metrics);

  return { metrics, edges, guardStatuses };
}
