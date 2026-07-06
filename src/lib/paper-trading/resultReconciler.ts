// HandicapLab Result Reconciler & Settlement Engine
// Location: src/lib/paper-trading/resultReconciler.ts

import { JobRecord } from './eventSystem';
import { PredictionLedgerRepository } from '../data/predictionLedgerRepository';

export class ResultReconciler {
  /**
   * Settles predictions automatically based on match outcomes.
   * Triggered by 'match.finished' event.
   */
  public static async handleMatchFinished(job: JobRecord): Promise<void> {
    const correlationId = job.correlation_id;
    const { matchId, homeGoals, awayGoals, closingOdds } = job.payload;

    if (matchId === undefined || homeGoals === undefined || awayGoals === undefined) {
      throw new Error(`[ResultReconciler] Missing required match outcome fields in payload.`);
    }

    console.log(
      `[ResultReconciler] [correlation_id=${correlationId}] Processing settlement for match: ${matchId} | Score: ${homeGoals}-${awayGoals}`
    );

    const predictions = await PredictionLedgerRepository.getPredictionsByMatchId(matchId);
    if (!predictions || predictions.length === 0) {
      console.log(`[ResultReconciler] No predictions found in ledger for match ${matchId}.`);
      return;
    }

    for (const pred of predictions) {
      // 1. Skip if already settled
      if (pred.prediction_settlements_v3 && pred.prediction_settlements_v3.length > 0) {
        console.log(`[ResultReconciler] Prediction hash ${pred.prediction_hash} is already settled. Skipping.`);
        continue;
      }

      // 2. Determine Outcome Status: 'won' | 'lost' | 'void' | 'half_won' | 'half_lost'
      let status: 'won' | 'lost' | 'void' | 'half_won' | 'half_lost' = 'lost';
      
      const selection = pred.selection;
      const marketType = pred.market_type;
      const line = pred.line !== undefined ? pred.line : null;

      if (marketType === 'ML') {
        if (selection === 'home' && homeGoals > awayGoals) status = 'won';
        else if (selection === 'away' && awayGoals > homeGoals) status = 'won';
        else if (selection === 'draw' && homeGoals === awayGoals) status = 'won';
      } else if (marketType === 'OU') {
        const lineVal = line ?? 2.5;
        const totalGoals = homeGoals + awayGoals;
        if (selection === 'over') {
          if (totalGoals > lineVal) status = 'won';
          else if (totalGoals < lineVal) status = 'lost';
          else status = 'void';
        } else if (selection === 'under') {
          if (totalGoals < lineVal) status = 'won';
          else if (totalGoals > lineVal) status = 'lost';
          else status = 'void';
        }
      } else if (marketType === 'AH') {
        const lineVal = line ?? -0.5;
        const diff = homeGoals - awayGoals + lineVal;
        if (selection === 'home') {
          if (diff > 0) status = 'won';
          else if (diff < 0) status = 'lost';
          else status = 'void';
        } else if (selection === 'away') {
          if (diff < 0) status = 'won';
          else if (diff > 0) status = 'lost';
          else status = 'void';
        }
      }

      // 3. Compute Simulated Profit / Loss
      // Stake is scaled in units (usually raw kelly fraction)
      const stake = pred.risk_adjusted_stake || 2.5; // stake in percentage/units (e.g. 2.5% of simulated bankroll)
      let profitLoss = -stake;
      if (status === 'won') {
        profitLoss = stake * (pred.market_odds - 1.0);
      } else if (status === 'void') {
        profitLoss = 0;
      }

      // 4. Compute Calibration Contributions (Brier & LogLoss)
      const probability = pred.calibrated_probability;
      const outcomeValue = status === 'won' ? 1.0 : (status === 'void' ? 0.5 : 0.0);
      const brierContribution = Math.pow(probability - outcomeValue, 2);
      
      const loglossContribution = outcomeValue === 1.0
        ? -Math.log(Math.max(0.001, probability))
        : (outcomeValue === 0.0 ? -Math.log(Math.max(0.001, 1 - probability)) : 0.0);

      // 5. Compute Closing Line Value (CLV)
      const finalClosingOdds = closingOdds || pred.market_odds;
      const actualClv = (pred.market_odds / finalClosingOdds) - 1.0;

      // 6. Write to Prediction Ledger (Single Source of Truth)
      const success = await PredictionLedgerRepository.settlePrediction({
        prediction_hash: pred.prediction_hash,
        status,
        profit_loss: Number(profitLoss.toFixed(4)),
        closing_odds: finalClosingOdds,
        actual_clv: Number(actualClv.toFixed(4)),
        brier_contribution: Number(brierContribution.toFixed(4)),
        logloss_contribution: Number(loglossContribution.toFixed(4))
      });

      if (success) {
        console.log(
          `[ResultReconciler] [correlation_id=${correlationId}] Settled prediction hash ${pred.prediction_hash} as: ${status} | Profit: ${profitLoss.toFixed(4)}`
        );
      } else {
        console.error(
          `[ResultReconciler] [correlation_id=${correlationId}] Failed to settle prediction hash ${pred.prediction_hash}`
        );
      }
    }
  }
}
