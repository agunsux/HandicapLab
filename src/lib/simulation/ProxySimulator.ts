import { SimulationMetrics, CounterfactualConfig } from './types';
import { ReplayPayload } from './ReplayEngine';
import { CounterfactualEngine } from './CounterfactualEngine';

export class ProxySimulator {
  /**
   * Mode B (Research Proxy) Execution
   * Extremely fast, operates by mutating the DecisionObject directly
   * rather than re-running the entire Module 1-5 pipeline.
   */
  static runBatch(batch: ReplayPayload[], config: CounterfactualConfig): SimulationMetrics {
    let yieldSum = 0;
    let correctSkips = 0;
    let missedOpportunities = 0;
    let decisionsMade = 0;
    let wins = 0;

    for (const payload of batch) {
      // Apply proxy counterfactuals
      const simulatedDecision = CounterfactualEngine.applyProxy(payload.historicalDecision, config);

      const isBet = simulatedDecision.decision === 'BET';
      const won = payload.historicalOutcome === 'BET_WON';

      if (isBet) {
        decisionsMade++;
        yieldSum += payload.evDelivered;
        if (won) wins++;
      } else {
        // Evaluate skips
        if (!won && payload.historicalOutcome !== 'VOID') {
          correctSkips++; // We skipped a losing bet (good)
        } else if (won) {
          missedOpportunities++; // We skipped a winning bet (bad)
        }
      }
    }

    const coverage = batch.length > 0 ? decisionsMade / batch.length : 0;
    const hitRate = decisionsMade > 0 ? wins / decisionsMade : 0;
    
    // In Proxy mode, some deep metrics are approximated or left at baseline
    return {
      yield: decisionsMade > 0 ? yieldSum / decisionsMade : 0, // ROI %
      hitRate,
      coverage,
      decisionQuality: 85, // Mocked for proxy
      correctSkips,
      missedOpportunities,
      expectedUtility: yieldSum,
      calibration: 0.9, // Mocked for proxy
      confidenceDrift: 0.01 // Mocked for proxy
    };
  }
}
