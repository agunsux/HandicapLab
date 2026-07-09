import { MatchSimulationResult } from '../simulation/mockMatchGenerator';
import { PredictionOutput, MatchInput } from '@/services/probability.engine';
import { calculateBrierScore } from './calibration';
import { calculateECE } from '../math/metrics';


export interface HTDecompositionResult {
  htScoreState: string;
  sampleSize: number;
  baseRate: number;
  ece: number;
  brierScore: number;
  roi: number;
  edgeExists: boolean;
}

export function runHTDecomposition(
  valResults: Array<{ input: MatchInput, pred: PredictionOutput, outcome: MatchSimulationResult }>
): HTDecompositionResult[] {
  const segments: Record<string, typeof valResults> = {
    '0-0': [],
    '1-0': [],
    '1-1': [],
    '2+': []
  };

  for (const r of valResults) {
    const state = r.pred.htScoreState || '2+';
    if (segments[state]) {
      segments[state].push(r);
    } else {
      segments['2+'].push(r);
    }
  }

  const results: HTDecompositionResult[] = [];

  for (const [state, data] of Object.entries(segments)) {
    if (data.length === 0) continue;

    let hits = 0;
    let profit = 0;
    let totalRisk = 0;

    const probPairs = data.map(d => {
      const line = d.input.sh_ou_line || 1.0;
      const actualUnder = d.outcome.shTotalGoals < line ? 1 : 0;
      const probUnder = d.pred.sh_ou_under_prob;
      
      hits += actualUnder;
      
      const odds = d.input.sh_ou_odds_under || 1.91;
      const expectedValue = (probUnder * odds) - 1;
      
      if (expectedValue > 0) {
        totalRisk += 1;
        if (actualUnder) {
          profit += (odds - 1);
        } else {
          profit -= 1;
        }
      }

      return { probability: probUnder, actual: actualUnder };
    });

    const ece = calculateECE(probPairs.map(p => p.probability), probPairs.map(p => p.actual ? 1 : 0));

    const brier = calculateBrierScore(probPairs.map(p => ({ prob: p.probability, outcome: p.actual })));
    const roi = totalRisk > 0 ? profit / totalRisk : 0;
    const baseRate = hits / data.length;

    results.push({
      htScoreState: state,
      sampleSize: data.length,
      baseRate,
      ece,
      brierScore: brier,
      roi,
      edgeExists: roi > 0.02 && ece < 0.10
    });
  }

  return results;
}
