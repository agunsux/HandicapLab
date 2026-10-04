// ============================================================================
// SALMO RESCUE SYNC CONTRACT TEST
// ============================================================================
// Verifies HandicapLab -> SALMO canonical synchronization for Poisson V1 Rescue:
// 1. modelVersion: 'poisson_v1_rescue' correctly loads rescue prediction ledger.
// 2. dataState: 'NO_QUALIFIED_PICKS' when no signals qualify.
// 3. Exactly 0 forced picks (Predictions != picks).
// 4. Full auditable predictions array exposed for UI / ledger research.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { SalmoProductionSyncService } from '@/lib/salmo/salmoProductionSyncService';

describe('SALMO Production Sync Contract — Poisson V1 Rescue', () => {
  it('loads canonical rescue prediction ledger and adheres to 0-pick invariant', () => {
    const payload = SalmoProductionSyncService.generateSyncPayload({
      modelVersion: 'poisson_v1_rescue',
      nowMs: new Date('2026-10-04T07:00:00Z').getTime(),
    });

    expect(payload.success).toBe(true);
    expect(payload.dataState).toBe('NO_QUALIFIED_PICKS');
    expect(payload.syncChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.counts.totalArchived).toBeGreaterThanOrEqual(414);
    expect(payload.counts.dailyPicks).toBe(0);
    expect(payload.dailyPicks).toHaveLength(0);
    expect(payload.predictions?.length).toBeGreaterThanOrEqual(414);
    expect(payload.performance.modelVersion).toBe('poisson_v1_rescue');
    expect(payload.freshness.status).toBe('FRESH');
    expect(payload.freshness.upcomingFixturesCount).toBeGreaterThan(0);
  });

  it('filters rescue sync payload by market correctly', () => {
    const ahPayload = SalmoProductionSyncService.generateSyncPayload({
      modelVersion: 'poisson_v1_rescue',
      market: 'AH',
      nowMs: new Date('2026-10-04T07:00:00Z').getTime(),
    });

    expect(ahPayload.success).toBe(true);
    expect(ahPayload.counts.totalArchived).toBeGreaterThan(0);
    expect(ahPayload.predictions?.every((p) => p.market === 'AH')).toBe(true);
  });
});
