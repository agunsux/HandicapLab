// HandicapLab Market Intelligence - Data Quality Validator
// Location: src/lib/market/dataValidator.ts

import { OddsMovementEvent, OddsSnapshot } from './providerInterface';

export interface ValidationIssue {
  type: 'ERROR' | 'WARNING';
  message: string;
  field?: string;
}

export class MarketDataValidator {
  /**
   * Validates list of timeline events for quality anomalies.
   */
  public static validateHistory(events: OddsMovementEvent[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    let lastTimestamp = 0;

    events.forEach((evt, idx) => {
      // 1. Missing fields
      if (!evt.bookmaker) {
        issues.push({ type: 'ERROR', message: `Event at index ${idx} is missing bookmaker` });
      }
      if (!evt.market) {
        issues.push({ type: 'ERROR', message: `Event at index ${idx} is missing market` });
      }

      // 2. Negative/Impossible odds
      if (evt.newOdds <= 1.0 || evt.oldOdds <= 1.0) {
        issues.push({ 
          type: 'ERROR', 
          message: `Event ${evt.id} has invalid/negative odds: newOdds=${evt.newOdds}, oldOdds=${evt.oldOdds}` 
        });
      }

      // 3. Out of order timestamps
      const currentTimestamp = new Date(evt.timestamp).getTime();
      if (idx > 0 && currentTimestamp < lastTimestamp) {
        issues.push({
          type: 'WARNING',
          message: `Out of order timestamp detected at event ${evt.id}: ${evt.timestamp} before previous event`
        });
      }
      lastTimestamp = currentTimestamp;

      // 4. Duplicate/redundant odds updates
      if (evt.oldOdds === evt.newOdds && evt.eventType === 'OddsUpdated') {
        issues.push({
          type: 'WARNING',
          message: `Redundant odds update event detected: ${evt.id} (newOdds matches oldOdds)`
        });
      }
    });

    return issues;
  }

  /**
   * Validates simple snapshot pairs.
   */
  public static validateSnapshot(opening: OddsSnapshot, closing: OddsSnapshot): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    if (opening.home <= 1.0 || closing.home <= 1.0) {
      issues.push({ type: 'ERROR', message: 'Impossible odds (<= 1.0) detected in snapshot.' });
    }

    return issues;
  }
}
