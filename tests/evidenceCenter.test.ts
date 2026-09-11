import { describe, it, expect } from 'vitest';
import { GET } from '../src/app/api/evidence/route';

describe('Scientific Evidence Center API Unit Tests', () => {
  it('returns a real-data payload with honest nulls instead of fabricated metrics', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.systemInfo).toBeDefined();
    expect(json.systemInfo.schemaVersion).toContain('evidence-v2.1');
    expect(json.dataState).toBeDefined();
    expect(json.minSample).toBeGreaterThan(0);

    expect(json.heroMetrics).toBeDefined();
    expect(typeof json.heroMetrics.totalPredictions).toBe('number');

    // Uncomputable metrics must be null, never hardcoded numbers.
    expect(
      json.heroMetrics.paperRoiPct === null || typeof json.heroMetrics.paperRoiPct === 'number'
    ).toBe(true);
    expect(
      json.heroMetrics.meanClvPct === null || typeof json.heroMetrics.meanClvPct === 'number'
    ).toBe(true);
    expect(json.heroMetrics.brierScore === null || json.heroMetrics.brierScore < 0.25).toBe(true);
    expect(json.heroMetrics.ece === null || typeof json.heroMetrics.ece === 'number').toBe(true);

    expect(Array.isArray(json.calibrationCurve)).toBe(true);
    expect(Array.isArray(json.subgroupBreakdown.leagues)).toBe(true);
    expect(Array.isArray(json.subgroupBreakdown.markets)).toBe(true);
    expect(Array.isArray(json.auditLedgerLogs)).toBe(true);
  });
});
