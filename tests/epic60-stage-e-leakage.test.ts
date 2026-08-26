// Test Suite for EPIC 60 Stage E — Date-Granularity Anti-Leakage Invariants
import { describe, it, expect } from 'vitest';
import { LeakageGuard, LeakageError } from '../src/lib/guards/leakage';

describe('EPIC 60 Stage E — Date-Granularity Anti-Leakage Invariants', () => {
  it('should accept historical records strictly prior to target match date', () => {
    expect(() => {
      LeakageGuard.assertHistoricalDateCutoff('2023-08-11', '2023-08-12', 'match-101');
      LeakageGuard.assertHistoricalDateCutoff('2022-12-31', '2023-01-01', 'match-102');
    }).not.toThrow();
  });

  it('should reject historical records on same date or future date as look-ahead leakage', () => {
    // Same date (intraday cannot be proven in date-granular dataset)
    expect(() => {
      LeakageGuard.assertHistoricalDateCutoff('2023-08-12', '2023-08-12', 'match-103');
    }).toThrow(LeakageError);

    // Future date
    expect(() => {
      LeakageGuard.assertHistoricalDateCutoff('2023-08-13', '2023-08-12', 'match-104');
    }).toThrow(LeakageError);
  });
});
