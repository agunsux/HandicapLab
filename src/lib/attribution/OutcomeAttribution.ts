import { AttributionObject, OutcomeContribution } from './types';
import { DriverRegistry } from './DriverRegistry';

export class OutcomeAttribution {
  /**
   * Scaffolded Phase 2 logic.
   * Called post-settlement when the actual match outcome is known.
   * Updates AttributionObject to v2 and updates Driver Intelligence stats.
   */
  static evaluateOutcome(
    draftAttribution: AttributionObject, 
    actualOutcome: 'BET_WON' | 'BET_LOST' | 'VOID',
    evDelivered: number
  ): AttributionObject {
    
    const outcomeContributions: OutcomeContribution[] = [];

    if (actualOutcome !== 'VOID') {
      const isWin = actualOutcome === 'BET_WON';

      // Evaluate every driver that pushed POSITIVE
      for (const driver of draftAttribution.dominantDrivers) {
        const alignment = isWin ? 'CORRECT' : 'INCORRECT';
        
        outcomeContributions.push({
          driverName: driver.name,
          predictedDirection: 'POSITIVE',
          actualOutcomeAlignment: alignment,
          valueDelivered: isWin ? evDelivered * driver.magnitude : -1 * evDelivered * driver.magnitude
        });
      }

      // Evaluate every suppressor
      for (const suppressor of draftAttribution.dominantSuppressors) {
        // A suppressor was against the bet. If bet lost, suppressor was right.
        const alignment = !isWin ? 'CORRECT' : 'INCORRECT';
        
        outcomeContributions.push({
          driverName: suppressor.name,
          predictedDirection: 'NEGATIVE',
          actualOutcomeAlignment: alignment,
          valueDelivered: !isWin ? evDelivered * suppressor.magnitude : -1 * evDelivered * suppressor.magnitude
        });
      }
    }

    // In a full implementation, this is where we call DriverRegistry.update(outcomeContributions)
    // to recalculate historicalAccuracy and reliabilityScore.

    return {
      ...draftAttribution,
      phase: 'POST_SETTLEMENT',
      outcomeContribution: outcomeContributions,
      decisionDNA: {
        ...draftAttribution.decisionDNA,
        outcome: actualOutcome
      }
    };
  }
}
