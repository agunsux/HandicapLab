// ============================================================================
// SALMO RESCUE PIPELINE — SETTLEMENT ENGINE
// Namespace: src/lib/pipeline/rescue/settlementEngine.ts
// Invariants enforced:
// 1. Direct integration with src/lib/settlement-core/settlement.ts
// 2. Mathematically correct split-line settlement for AH & OU quarter lines.
// 3. Terminal states: WON, HALF_WON, PUSH, HALF_LOSS, LOSS, VOID, CANCELLED.
// 4. Calculates exact P&L units per 1-unit stake.
// ============================================================================

import {
  settleAsianHandicap,
  settleOverUnder,
  settleBtts,
} from '@/lib/settlement-core/settlement';
import { RescuePredictionRecord } from './types';

export interface FinalMatchScore {
  fixtureId: number;
  homeGoals: number;
  awayGoals: number;
  status: 'FT' | 'AET' | 'PEN' | 'PST' | 'CANC' | 'ABD';
}

export class RescueSettlementEngine {
  public static settlePrediction(
    prediction: RescuePredictionRecord,
    score: FinalMatchScore
  ): RescuePredictionRecord {
    const isCancelled = ['PST', 'CANC', 'ABD'].includes(score.status);
    const settledAt = new Date().toISOString();

    if (isCancelled) {
      return {
        ...prediction,
        settlement: {
          status: 'VOID',
          final_home_score: score.homeGoals,
          final_away_score: score.awayGoals,
          settled_at: settledAt,
          pnl_units: 0.0,
        },
      };
    }

    const odds = prediction.market_odds ?? prediction.fair_odds ?? 2.0;
    const line = prediction.line ?? 0;

    let res: { outcome: string; profitUnits: number };

    if (prediction.market === 'AH') {
      const isHome = prediction.selection.toUpperCase().startsWith('HOME');
      const selection = isHome ? 'home' : 'away';
      res = settleAsianHandicap(
        score.homeGoals,
        score.awayGoals,
        line,
        selection,
        odds,
        false
      );
    } else if (prediction.market === 'OU') {
      const isOver = prediction.selection.toUpperCase().startsWith('OVER');
      const selection = isOver ? 'over' : 'under';
      res = settleOverUnder(
        score.homeGoals,
        score.awayGoals,
        line,
        selection,
        odds,
        false
      );
    } else {
      // BTTS
      const isYes = prediction.selection.toUpperCase().includes('YES');
      const selection = isYes ? 'yes' : 'no';
      res = settleBtts(
        score.homeGoals,
        score.awayGoals,
        selection,
        odds,
        false
      );
    }

    let status: 'WON' | 'HALF_WON' | 'PUSH' | 'HALF_LOSS' | 'LOSS' | 'VOID';
    switch (res.outcome) {
      case 'WIN':
        status = 'WON';
        break;
      case 'HALF_WIN':
        status = 'HALF_WON';
        break;
      case 'PUSH':
        status = 'PUSH';
        break;
      case 'HALF_LOSS':
        status = 'HALF_LOSS';
        break;
      case 'LOSS':
        status = 'LOSS';
        break;
      default:
        status = 'VOID';
    }

    return {
      ...prediction,
      settlement: {
        status,
        final_home_score: score.homeGoals,
        final_away_score: score.awayGoals,
        settled_at: settledAt,
        pnl_units: res.profitUnits,
      },
    };
  }

  public static batchSettle(
    predictions: RescuePredictionRecord[],
    scores: FinalMatchScore[]
  ): { settled: RescuePredictionRecord[]; count: number } {
    const scoreMap = new Map<number, FinalMatchScore>(scores.map((s) => [s.fixtureId, s]));
    let settledCount = 0;

    const settled = predictions.map((pred) => {
      if (pred.settlement && pred.settlement.status !== 'PENDING') {
        return pred;
      }

      const matchScore = scoreMap.get(pred.fixture_id);
      if (matchScore) {
        settledCount++;
        return this.settlePrediction(pred, matchScore);
      }

      return pred;
    });

    return { settled, count: settledCount };
  }
}
