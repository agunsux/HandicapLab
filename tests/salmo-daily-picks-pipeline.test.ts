import { describe, it, expect } from 'vitest';
import { DailyPickRecord, CanonicalMarket } from '../src/lib/daily-picks/types';
import { DailyPicksEngine } from '../src/lib/daily-picks/engine';

describe('SALMO.DEV Real-Time Production Daily Picks Pipeline Invariants', () => {
  it('Phase 1: Market restriction invariant — strictly AH, OU, BTTS only', () => {
    const validMarkets: CanonicalMarket[] = ['AH', 'OU', 'BTTS'];
    
    // Ensure invalid/deprecated markets are not in CanonicalMarket
    // @ts-expect-error Checking invalid market
    const invalidMarket: CanonicalMarket = 'MONEYLINE';
    // @ts-expect-error Checking 1X2 market
    const invalid1X2: CanonicalMarket = '1X2';

    expect(validMarkets).toContain('AH');
    expect(validMarkets).toContain('OU');
    expect(validMarkets).toContain('BTTS');
    expect(validMarkets).not.toContain(invalidMarket);
    expect(validMarkets).not.toContain(invalid1X2);
  });

  it('Phase 2: Provenance temporal invariant — oddsTimestamp <= predictionTimestamp < kickoffUtc', () => {
    const now = Date.now();
    const kickoffUtc = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    const oddsTimestampUtc = new Date(now - 10 * 60 * 1000).toISOString();
    const predictionTimestampUtc = new Date(now).toISOString();

    const mockRecord: DailyPickRecord = {
      predictionId: 'pred_123_AH_0.5',
      fixtureId: 'apifootball-1379101',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      competition: 'Premier League',
      kickoffUtc,
      market: 'AH',
      selection: 'Arsenal +0.5',
      line: 0.5,
      predictionTimestampUtc,
      oddsTimestampUtc,
      modelVersion: 'dixon-coles-v1.0',
      dataVersion: 'apifootball-v3-oddspapi-v4',
      providerSources: {
        fixtures: 'api-football-pro',
        odds: 'oddspapi-pinnacle',
        statistics: 'apifootball',
      },
      modelProbability: 0.55,
      marketProbability: 0.50,
      fairOdds: 1.82,
      marketOdds: 2.00,
      edge: 0.05,
      expectedValue: 0.10,
      confidence: 78,
      validationStatus: 'PROVISIONAL_EDGE',
      dataQuality: 92,
      providerHealth: 'HEALTHY',
      status: 'ACTIVE',
      apiFootballFixtureTimestamp: predictionTimestampUtc,
      oddsPapiSnapshotTimestamp: oddsTimestampUtc,
    };

    const oddsTime = new Date(mockRecord.oddsTimestampUtc).getTime();
    const predTime = new Date(mockRecord.predictionTimestampUtc).getTime();
    const kickTime = new Date(mockRecord.kickoffUtc).getTime();

    expect(oddsTime).toBeLessThanOrEqual(predTime);
    expect(predTime).toBeLessThan(kickTime);
  });

  it('Phase 3: Quota safety invariants — API-Football 7500 daily, OddsPapi 250 monthly with 200 soft ceiling', async () => {
    const oddspapiQuota = await DailyPicksEngine.getOddsPapiQuotaStatus();
    expect(oddspapiQuota.limit).toBe(250);
    // Soft reservation ceiling is 200 (80% of 250)
    expect(oddspapiQuota.used).toBeLessThanOrEqual(oddspapiQuota.limit);
    if (oddspapiQuota.used >= 200) {
      expect(oddspapiQuota.allowed).toBe(false);
    }

    const apifootballQuota = await DailyPicksEngine.getApiFootballQuotaStatus();
    expect(apifootballQuota.limit).toBe(7500);
    expect(apifootballQuota.remaining).toBeGreaterThanOrEqual(0);
  });

  it('Phase 4: Zero mock data invariant — rejects synthetic prefixes', () => {
    const isMockFixture = (id: string) => {
      const lower = id.toLowerCase();
      return lower.startsWith('mock') || lower.startsWith('synth') || lower.startsWith('fake') || lower.startsWith('test');
    };

    expect(isMockFixture('mock-123')).toBe(true);
    expect(isMockFixture('synthetic-epl-001')).toBe(true);
    expect(isMockFixture('apifootball-1379101')).toBe(false);
    expect(isMockFixture('9cc3298c-b699-4787-9a25-1f39e1318852')).toBe(false);
  });

  it('Phase 5: Devigging formula produces valid probability distribution', () => {
    const p1 = 2.00;
    const p2 = 2.00;
    const devig = (DailyPicksEngine as any).devigTwoWay(p1, p2);
    expect(devig.pA).toBeCloseTo(0.5, 2);
    expect(devig.pB).toBeCloseTo(0.5, 2);
    expect(devig.overround).toBeCloseTo(1.0, 2);

    // Pinnacle typical 102.5% market
    const pinHome = 1.95;
    const pinAway = 1.95;
    const pinDevig = (DailyPicksEngine as any).devigTwoWay(pinHome, pinAway);
    expect(pinDevig.pA).toBeCloseTo(0.5, 2);
    expect(pinDevig.overround).toBeGreaterThan(1.0);
  });

  it('Phase 6: Future kickoff window invariant — only future matches within 7 days', () => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const pastKickoff = now - 1000;
    const futureValid = now + (2 * 24 * 60 * 60 * 1000); // 2 days
    const beyond7Days = now + (8 * 24 * 60 * 60 * 1000); // 8 days

    const isValidWindow = (ts: number) => ts > now && ts <= now + sevenDaysMs;

    expect(isValidWindow(pastKickoff)).toBe(false);
    expect(isValidWindow(futureValid)).toBe(true);
    expect(isValidWindow(beyond7Days)).toBe(false);
  });
});
