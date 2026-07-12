/**
 * 21.6 — Live Evaluation Engine
 * Compares prediction vs market vs closing odds vs actual result.
 */

import type { LiveEvaluationResult } from './types';
import { generateEvaluationId } from './id';

export class LiveEvaluator {
  evaluate(input: {
    fixtureId: string; market: string;
    predictedProbability: number; marketProbability: number;
    closingOddsProbability: number; actualResult: number;
  }): LiveEvaluationResult {
    const correct = (input.predictedProbability > 0.5 && input.actualResult === 1) || (input.predictedProbability <= 0.5 && input.actualResult === 0);
    const roi = input.actualResult === 1 ? (1 / input.marketProbability - 1) : input.actualResult === 0.5 ? 0 : -1;
    const yield_ = roi;
    const clv = input.marketProbability > 0 ? (input.marketProbability - input.closingOddsProbability) / input.marketProbability : 0;
    const brierScore = Math.pow(input.predictedProbability - input.actualResult, 2);
    const logLoss = input.actualResult === 1 ? -Math.log(Math.max(0.001, input.predictedProbability)) : input.actualResult === 0 ? -Math.log(Math.max(0.001, 1 - input.predictedProbability)) : 0;
    const calibrationError = Math.abs(input.predictedProbability - input.actualResult);
    const expectedValueRealized = roi - (1 / input.marketProbability - 1);
    const kellyEfficiency = roi / (Math.abs(roi) + 0.001);
    const edgeRealization = input.predictedProbability - input.marketProbability;
    const decisionCorrect = correct;

    return Object.freeze({
      fixtureId: input.fixtureId,
      market: input.market,
      predictedProbability: input.predictedProbability,
      marketProbability: input.marketProbability,
      closingOddsProbability: input.closingOddsProbability,
      actualResult: input.actualResult,
      correct,
      roi: Math.round(roi * 10000) / 10000,
      yield_: Math.round(yield_ * 10000) / 10000,
      clv: Math.round(clv * 10000) / 10000,
      brierScore: Math.round(brierScore * 10000) / 10000,
      logLoss: Math.round(logLoss * 10000) / 10000,
      calibrationError: Math.round(calibrationError * 10000) / 10000,
      expectedValueRealized: Math.round(expectedValueRealized * 10000) / 10000,
      kellyEfficiency: Math.round(kellyEfficiency * 10000) / 10000,
      edgeRealization: Math.round(edgeRealization * 10000) / 10000,
      decisionCorrect,
    });
  }
}

export const defaultLiveEvaluator = new LiveEvaluator();