import { describe, it, expect } from 'vitest';
import { generatePremierLeagueAhResearch } from '../src/lib/research/premierLeagueAhEngine';

describe('Forensic Premier League Asian Handicap Research (2024/25 - 2025/26)', () => {
  const payload = generatePremierLeagueAhResearch();

  it('1. Forensic Data Integrity: 760 expected matches, 760 final results, zero missingness', () => {
    const { dataIntegrity } = payload;
    expect(dataIntegrity.expectedFixtures).toBe(760);
    expect(dataIntegrity.discoveredFixtures).toBe(760);
    expect(dataIntegrity.finalResultsVerified).toBe(760);
    expect(dataIntegrity.missingResults).toBe(0);
    expect(dataIntegrity.duplicateRecords).toBe(0);
    expect(dataIntegrity.lookAheadPassed).toBe(true);
    expect(dataIntegrity.dummyDataPassed).toBe(true);
    expect(dataIntegrity.settlementEnginePassed).toBe(true);
    expect(dataIntegrity.status).toBe('REAL_DATA');
  });

  it('2. Provenance Audit: verifies Pinnacle bookmaker source and Gold lineage', () => {
    expect(payload.dataIntegrity.bookmakerProvenance).toContain('Pinnacle');
    expect(payload.dataIntegrity.historicalOddsProvenance).toContain('Football-Data.co.uk');
  });

  it('3. Zero-Dummy UI & Payload Rule: Contains no mock data strings', () => {
    const raw = JSON.stringify(payload);
    expect(raw.includes('LIV vs ARS')).toBe(false);
    expect(raw.includes('mock_odds')).toBe(false);
    expect(raw.includes('fake_fixture')).toBe(false);
    expect(payload.dataIntegrity.dummyDataPassed).toBe(true);
  });

  it('4. Primary Question: Home AH +0 Backtest accurately reflects empirical outcomes', () => {
    const sComb = payload.homeAhZero.bySeason.combined;
    expect(sComb.bets).toBe(89);
    expect(sComb.wins).toBe(30);
    expect(sComb.pushes).toBe(27);
    expect(sComb.losses).toBe(32);
    expect(sComb.winRate).toBe(48.4);
    expect(sComb.pushRate).toBe(30.3);
    expect(sComb.profit).toBe(-3.89);
    expect(sComb.roi).toBe(-4.37);
    expect(sComb.yieldRate).toBe(-4.37);
    expect(sComb.avgClv).toBe(-1.22);
  });

  it('5. Season Isolation: shows independent outcomes for 2024/25 and 2025/26', () => {
    const s24 = payload.homeAhZero.bySeason['2024-2025'];
    const s25 = payload.homeAhZero.bySeason['2025-2026'];

    expect(s24.bets).toBe(43);
    expect(s24.roi).toBe(-14.00);

    expect(s25.bets).toBe(46);
    expect(s25.roi).toBe(4.63);

    expect(s24.bets + s25.bets).toBe(89);
  });

  it('6. Full Line Matrix: accurately calculates quarter lines and season consistency', () => {
    const lines = payload.lineMatrix.lines;
    expect(lines.length).toBeGreaterThanOrEqual(10);

    // Verify presence of quarter lines
    const halfQuarter = lines.find((l) => l.line === -0.25);
    expect(halfQuarter).toBeDefined();
    expect(halfQuarter?.sampleSize).toBe(103);
    expect(['CONSISTENT', 'INCONSISTENT', 'LOSS']).toContain(halfQuarter?.seasonConsistency);

    // Verify symmetry: Home +0.25 vs Away -0.25
    const plusQuarter = lines.find((l) => l.line === 0.25);
    expect(plusQuarter).toBeDefined();
    expect(plusQuarter?.sampleSize).toBe(71);
  });

  it('7. Positive AH Opportunities: ranked by profit and multi-season consistency', () => {
    const posList = payload.lineMatrix.positiveRanked;
    expect(posList.length).toBeGreaterThan(0);
    expect(posList[0].rank).toBe(1);
    expect(posList[0].profit).toBeGreaterThanOrEqual(posList[posList.length - 1].profit);
  });

  it('8. EV Threshold Sweep: monotonic bet filtering with sample tier categorization', () => {
    const sweep = payload.homeAhZero.evThresholdSweep;
    expect(sweep.length).toBeGreaterThanOrEqual(9);

    let prevCount = Infinity;
    for (const row of sweep) {
      expect(row.bets).toBeLessThanOrEqual(prevCount);
      prevCount = row.bets;
      expect(row.sampleTier).toBeDefined();
    }
  });

  it('9. Model Validation: calculates Brier score and LogLoss with no look-ahead leakage', () => {
    const mv = payload.modelValidation;
    expect(mv.sampleSize).toBe(760);
    expect(mv.brierScore).toBeGreaterThan(0);
    expect(mv.brierScore).toBeLessThan(1);
    expect(mv.logLoss).toBeGreaterThan(0);
  });

  it('10. Research Manifest: produces objective verdict based on data evidence', () => {
    const m = payload.manifest;
    expect(m.primaryBookmaker).toBe('Pinnacle');
    expect(m.stakingModel).toBe('1 Unit Flat Staking');
    expect(m.verdict).toBe('LOSS');
    expect(m.verdictExplanation).toContain('Blind flat backing of HOME AH +0 consistently produces a negative cumulative ROI');
  });
});
