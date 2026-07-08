import { DecisionObject } from '../decision/DecisionObject';

export interface BacktestRecord {
  decision: DecisionObject;
  actualOutcomeIsPositive: boolean; // Did the event happen (e.g. bet won)?
}

export interface DecisionAccuracyMetrics {
  correctBet: number;
  correctSkip: number;
  falseBet: number;
  missedOpportunity: number;
  totalDecisions: number;
  accuracy: number; // (correctBet + correctSkip) / totalDecisions
}

export class DecisionBacktester {
  /**
   * Evaluates the decision quality of a batch of records.
   * 
   * Correct Bet: System said BET, and the bet won.
   * False Bet: System said BET, and the bet lost.
   * Correct Skip: System said NO_BET or INCONCLUSIVE, and the bet would have lost.
   * Missed Opportunity: System said NO_BET or INCONCLUSIVE, but the bet would have won.
   */
  static evaluate(records: BacktestRecord[]): DecisionAccuracyMetrics {
    let correctBet = 0;
    let correctSkip = 0;
    let falseBet = 0;
    let missedOpportunity = 0;

    for (const record of records) {
      const isBet = record.decision.decision === 'BET';
      const won = record.actualOutcomeIsPositive;

      if (isBet && won) {
        correctBet++;
      } else if (isBet && !won) {
        falseBet++;
      } else if (!isBet && won) {
        missedOpportunity++;
      } else if (!isBet && !won) {
        correctSkip++;
      }
    }

    const totalDecisions = records.length;
    const accuracy = totalDecisions > 0 ? (correctBet + correctSkip) / totalDecisions : 0;

    return {
      correctBet,
      correctSkip,
      falseBet,
      missedOpportunity,
      totalDecisions,
      accuracy
    };
  }
}
