// Market Microstructure Analytics Unit Tests
// Location: tests/microstructure-analyzer.test.ts

import { describe, it, expect } from 'vitest';
import { MicrostructureAnalyzer } from '../src/lib/engine/microstructure-analyzer';

describe('MicrostructureAnalyzer', () => {
  it('should compute spread proxy accurately', () => {
    const odds = { home: 1.95, away: 1.95 };
    const spread = MicrostructureAnalyzer.calculateSpread(odds);
    expect(spread).toBeCloseTo(0.025641, 4);
  });

  it('should detect stale soft prices compared to sharp', () => {
    expect(MicrostructureAnalyzer.isStalePrice(2.10, 1.90, 0.05)).toBe(true);
    expect(MicrostructureAnalyzer.isStalePrice(1.92, 1.90, 0.05)).toBe(false);
  });

  it('should compute sharp leader lead time latency', () => {
    const sharpMoves = [
      { price: 1.90, timestamp: new Date('2026-07-06T12:00:00Z') }
    ];
    const softMoves = [
      { price: 1.90, timestamp: new Date('2026-07-06T12:00:15Z') }
    ];

    const leadTime = MicrostructureAnalyzer.calculateSharpLeadTime(sharpMoves, softMoves);
    expect(leadTime).toBe(15.0); // 15 seconds
  });
});
