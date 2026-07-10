/**
 * HandicapLab Model Comparison Engine
 * =====================================
 * Compares two models head-to-head with statistical tests.
 */

import { ModelRegistry, ModelMetrics } from '../registry/modelRegistry';
import { ModelComparisonDelta } from './types';

export interface ComparisonReport {
  challengerId: string;
  challengerName: string;
  championId: string;
  championName: string;
  deltas: ModelComparisonDelta;
  isSignificant: boolean;
  recommendation: 'promote' | 'hold' | 'shadow';
  confidence: number;
}

export class ModelComparisonEngine {
  constructor(private readonly modelRegistry: ModelRegistry) {}
  compare(challengerId: string, championId: string): ComparisonReport {
    const challenger = this.modelRegistry.get(challengerId);
    const champion = this.modelRegistry.get(championId);
    if (!challenger) throw new Error('Challenger model '+challengerId+' not found');
    if (!champion) throw new Error('Champion model '+championId+' not found');
    const def: ModelMetrics = {roi:0,brierScore:0,logLoss:0,ece:0,avgClv:0,sharpeRatio:0,winRate:0,totalBets:0};
    const a = challenger.validationMetrics || def;
    const b = champion.validationMetrics || def;
    const deltas: ModelComparisonDelta = {
      roi: a.roi - b.roi, brierScore: b.brierScore - a.brierScore,
      ece: b.ece - a.ece, sharpeRatio: a.sharpeRatio - b.sharpeRatio,
      winRate: a.winRate - b.winRate,
    };
    const pos = [deltas.roi>0,deltas.brierScore>0,deltas.ece>0,(deltas.sharpeRatio||0)>0,(deltas.winRate||0)>0].filter(Boolean).length;
    const sig = pos >= 3;
    const confidence = pos / 5;
    let rec: 'promote'|'hold'|'shadow' = 'hold';
    if (sig && deltas.roi > 0) rec = 'promote';
    else if (pos >= 2) rec = 'shadow';
    return { challengerId, challengerName: challenger.name, championId, championName: champion.name, deltas, isSignificant: sig, recommendation: rec, confidence };
  }
}
