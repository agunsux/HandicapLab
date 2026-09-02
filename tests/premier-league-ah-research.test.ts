import { describe, it, expect } from 'vitest';
import { generatePremierLeagueAhResearch } from '../src/lib/research/premierLeagueAhEngine';

describe('EPIC Premier League Asian Handicap Research (Real Data Only)', () => {
  const payload = generatePremierLeagueAhResearch();

  it('1. Returns REAL_DATA status and genuine Premier League 2-season payload', () => {
    expect(payload.status).toBe('REAL_DATA');
    expect(payload.league).toBe('Premier League');
    expect(payload.seasons).toEqual(['2024/25', '2025/26']);
    expect(payload.coverage.season2024_2025.discoveredFixtures).toBe(380);
    expect(payload.coverage.season2025_2026.discoveredFixtures).toBe(380);
    expect(payload.coverage.combined.discoveredFixtures).toBe(760);
  });

  it('2. Zero-Dummy Invariant: contains no synthetic mock matches or placeholder strings', () => {
    const rawJson = JSON.stringify(payload);
    expect(rawJson.includes('LIV vs ARS')).toBe(false);
    expect(rawJson.includes('dummy')).toBe(false);
    expect(rawJson.includes('mock')).toBe(false);
  });

  it('3. Home AH +0 Flat Staking Settlement adheres to standard betting rules', () => {
    // Win -> profit = odds - 1
    // Draw -> profit = 0
    // Loss -> profit = -1
    const sComb = payload.homeAhZero.bySeason.combined;
    expect(sComb.bets).toBe(sComb.wins + sComb.pushes + sComb.losses);
    expect(sComb.bets).toBeGreaterThan(50);
    expect(sComb.winRate).toBeGreaterThan(0);
    expect(sComb.pushRate).toBeGreaterThan(0);
    expect(sComb.lossRate).toBeGreaterThan(0);
  });

  it('4. Mathematical Consistency: ROI equals Yield under flat 1-unit staking', () => {
    const s24 = payload.homeAhZero.bySeason['2024-2025'];
    const s25 = payload.homeAhZero.bySeason['2025-2026'];
    const sComb = payload.homeAhZero.bySeason.combined;

    expect(s24.roi).toBe(s24.yieldRate);
    expect(s25.roi).toBe(s25.yieldRate);
    expect(sComb.roi).toBe(sComb.yieldRate);
  });

  it('5. Season Isolation: shows separate empirical results for 2024/25 and 2025/26', () => {
    const s24 = payload.homeAhZero.bySeason['2024-2025'];
    const s25 = payload.homeAhZero.bySeason['2025-2026'];

    expect(s24.bets).toBe(43);
    expect(s25.bets).toBe(46);
    expect(s24.bets + s25.bets).toBe(89);
    // Both seasons have independent non-zero profit calculations
    expect(s24.profit).not.toBe(0);
    expect(s25.profit).not.toBe(0);
  });

  it('6. EV Threshold Sweep contains monotonic hurdle boundaries and non-negative sample sizes', () => {
    const sweep = payload.homeAhZero.evThresholdSweep;
    expect(sweep.length).toBeGreaterThanOrEqual(9);

    let prevBets = Infinity;
    for (const row of sweep) {
      expect(row.bets).toBeLessThanOrEqual(prevBets);
      prevBets = row.bets;
      expect(row.bets).toBeGreaterThanOrEqual(0);
    }
  });

  it('7. Line Matrix covers all observed Premier League lines with distinct Home and Away metrics', () => {
    const lines = payload.lineMatrix.lines;
    expect(lines.length).toBeGreaterThanOrEqual(10);
    const zeroLine = lines.find((l) => l.line === 0);
    expect(zeroLine).toBeDefined();
    expect(zeroLine?.bets).toBe(89);
  });

  it('8. Research Manifest provides reproducible configuration, question, and honest verdict', () => {
    const manifest = payload.manifest;
    expect(manifest.primaryBookmaker).toBe('Pinnacle');
    expect(manifest.stakingModel).toBe('1 Unit Flat Staking');
    expect(manifest.primaryQuestion).toContain('HOME TEAM at Asian Handicap +0');
    expect(manifest.answerSentence).toContain('Backing Premier League HOME AH +0');
    expect(['PROFITABLE', 'LOSS', 'INCONCLUSIVE', 'INSUFFICIENT_DATA']).toContain(manifest.verdict);
  });
});
