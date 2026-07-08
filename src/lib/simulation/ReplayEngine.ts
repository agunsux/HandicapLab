import { DecisionObject } from '../decision/DecisionObject';

export interface ReplayPayload {
  decisionId: string;
  historicalDecision: DecisionObject;
  historicalOutcome: 'BET_WON' | 'BET_LOST' | 'VOID' | 'PENDING';
  evDelivered: number;
}

export class ReplayEngine {
  /**
   * Mocks fetching historical data for a simulation batch.
   * In production, this queries the historical ledger / DB.
   */
  static fetchBatch(datasetQuery: string, limit: number = 100): ReplayPayload[] {
    // For scaffolding, we return a synthetic dataset based on the query
    const batch: ReplayPayload[] = [];
    
    for (let i = 0; i < limit; i++) {
      batch.push({
        decisionId: `hist-dec-${i}`,
        historicalOutcome: i % 3 === 0 ? 'BET_LOST' : 'BET_WON',
        evDelivered: i % 3 === 0 ? -1.0 : 0.8, // 1 unit lost vs 0.8 units won
        historicalDecision: {
          decision_version: 'v1',
          decision: 'BET',
          expected_value: 0.05 + (Math.random() * 0.1),
          confidence: 0.75 + (Math.random() * 0.2), // 0.75 to 0.95
          risk_level: 'LOW',
          blocking_flags: [],
          reasoning: ['Historical replay'],
          uncertainty_vector: {
            epistemic: 0.1,
            aleatoric: 0.2
          }
        }
      });
    }

    return batch;
  }
}
