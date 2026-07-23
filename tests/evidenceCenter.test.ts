import { describe, it, expect } from 'vitest';
import { GET } from '../src/app/api/evidence/route';

describe('Scientific Evidence Center API Unit Tests', () => {
  it('should return valid evidence payload with hero metrics and calibration curves', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.systemInfo.classification).toBe('v1.0 Research Platform / Autonomous Paper Trading Beta');
    expect(json.heroMetrics.totalPredictions).toBe(18462);
    expect(json.heroMetrics.paperRoiPct).toBeGreaterThan(0);
    expect(json.heroMetrics.brierScore).toBeLessThan(0.185);

    expect(json.calibrationCurve).toHaveLength(10);
    expect(json.subgroupBreakdown.leagues.length).toBeGreaterThan(0);
    expect(json.subgroupBreakdown.markets.length).toBeGreaterThan(0);
    expect(json.auditLedgerLogs.length).toBeGreaterThan(0);
  });
});
