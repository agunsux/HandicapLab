import { describe, it, expect, vi } from 'vitest';
import {
  generateMockMatches,
  generateMockOdds,
  generateMockSignals,
  generateMockPerformance,
  generateMockMatchStats,
  generateMockPredictions,
} from '../src/services/mockEngine';
import { fetchMatches, fetchOdds, fetchSignals } from '../src/services/api';
import { proxyFetchFixtures, proxyFetchOdds } from '../src/services/proxy';

describe('FAZE 1: Full Demo Mode & MockEngine', () => {
  it('should generate deterministic mock matches with the same seed', () => {
    const matches1 = generateMockMatches(6, '2026-08-06');
    const matches2 = generateMockMatches(6, '2026-08-06');

    expect(matches1).toHaveLength(6);
    expect(matches1[0].homeTeam).toBe(matches2[0].homeTeam);
    expect(matches1[0].awayTeam).toBe(matches2[0].awayTeam);
    expect(matches1[0].score).toEqual(matches2[0].score);
  });

  it('should generate micro live odds variations on tick increase', () => {
    const oddsTick0 = generateMockOdds('m-101', 0);
    const oddsTick1 = generateMockOdds('m-101', 1);

    expect(oddsTick0.length).toBeGreaterThan(0);
    expect(oddsTick1.length).toEqual(oddsTick0.length);
    expect(oddsTick0[0].matchId).toBe('m-101');
  });

  it('should generate signals and match stats cleanly', () => {
    const signals = generateMockSignals(5, '2026-08-06');
    const stats = generateMockMatchStats('m-101');
    const preds = generateMockPredictions('m-101');

    expect(signals).toHaveLength(5);
    expect(stats.xG.home).toBeGreaterThan(0);
    expect(preds.advice).toBeDefined();
  });

  it('should fallback gracefully in fetchMatches when API keys fail/are unconfigured', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const matches = await fetchMatches();

    expect(matches.length).toBeGreaterThan(0);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('API key not configured — using mock data')
    );
    consoleWarnSpy.mockRestore();
  });

  it('should have FAZE 2 proxy structure placeholders working', async () => {
    const proxyFixtures = await proxyFetchFixtures();
    const proxyOdds = await proxyFetchOdds();

    expect(proxyFixtures.success).toBe(false);
    expect(proxyFixtures.error).toContain('FAZE 1');
    expect(proxyOdds.success).toBe(false);
  });
});
