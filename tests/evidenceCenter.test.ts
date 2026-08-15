import { describe, it, expect } from 'vitest';
import { GET } from '../src/app/api/evidence/route';

describe('Scientific Evidence Center API Unit Tests', () => {
  it('should return valid evidence payload with hero metrics and calibration curves', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.systemInfo).toBeDefined();
    expect(json.systemInfo.schemaVersion).toContain('evidence-v2.0');
    expect(json.heroMetrics).toBeDefined();
    expect(typeof json.heroMetrics.totalPredictions).toBe('number');
    expect(typeof json.heroMetrics.paperRoiPct).toBe('number');
    expect(json.heroMetrics.brierScore).toBeLessThan(0.25);

    expect(Array.isArray(json.calibrationCurve)).toBe(true);
    expect(Array.isArray(json.subgroupBreakdown.leagues)).toBe(true);
    expect(Array.isArray(json.subgroupBreakdown.markets)).toBe(true);
    expect(Array.isArray(json.auditLedgerLogs)).toBe(true);
  });
});
