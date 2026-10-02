import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CanonicalResultSyncBridge } from '@/lib/ledger/canonicalResultSyncBridge';
import { CanonicalFixtureFreshnessGate, CanonicalFixtureRecord } from '@/lib/services/canonicalFixtureFreshnessGate';
import { apiFootballClient } from '@/lib/apis/apifootball';

describe('CanonicalResultSyncBridge', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    CanonicalFixtureFreshnessGate.clearForTesting();
  });

  it('scans and skips when no fixtures are past kickoff', async () => {
    CanonicalFixtureFreshnessGate.upsertFixture({
      canonicalMatchId: 'cm_future_1',
      providerMatchId: '999001',
      homeTeam: 'Arsenal',
      awayTeam: 'Chelsea',
      competition: 'Premier League',
      season: '2026',
      kickoffUtc: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      status: 'SCHEDULED',
      provider: 'api-football',
    });

    const report = await CanonicalResultSyncBridge.syncCompletedFixtures({ nowMs: Date.now() });
    expect(report.scannedCount).toBe(0);
    expect(report.updatedToFinished).toBe(0);
  });

  it('identifies candidate past kickoff and updates status when provider returns FT', async () => {
    const kickoffMs = Date.now() - 3 * 3600 * 1000; // 3 hours ago
    CanonicalFixtureFreshnessGate.upsertFixture({
      canonicalMatchId: 'cm_past_1',
      providerMatchId: '888001',
      homeTeam: 'Liverpool',
      awayTeam: 'Everton',
      competition: 'Premier League',
      season: '2026',
      kickoffUtc: new Date(kickoffMs).toISOString(),
      status: 'SCHEDULED',
      provider: 'api-football',
    });

    // Mock apiFootballClient.getFixtureById
    vi.spyOn(apiFootballClient, 'getFixtureById').mockResolvedValueOnce({
      fixture: {
        id: 888001,
        referee: 'Michael Oliver',
        timezone: 'UTC',
        date: new Date(kickoffMs).toISOString(),
        timestamp: Math.floor(kickoffMs / 1000),
        periods: { first: null, second: null },
        venue: { id: null, name: 'Anfield', city: 'Liverpool' },
        status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
      },
      league: { id: 39, name: 'Premier League', country: 'England', logo: '', flag: null, season: 2026, round: 'Regular Season - 1' },
      teams: {
        home: { id: 40, name: 'Liverpool', logo: '', winner: true },
        away: { id: 45, name: 'Everton', logo: '', winner: false },
      },
      goals: { home: 2, away: 0 },
      score: {
        halftime: { home: 1, away: 0 },
        fulltime: { home: 2, away: 0 },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null },
      },
    } as any);

    // Temporarily mock environment to allow mock execution
    vi.stubEnv('NODE_ENV', 'production');
    process.env.APIFOOTBALL_KEY = 'test_key';

    try {
      const report = await CanonicalResultSyncBridge.syncCompletedFixtures({ nowMs: Date.now() });
      expect(report.scannedCount).toBe(1);
      expect(report.updatedToFinished).toBe(1);

      const updated = CanonicalFixtureFreshnessGate.getFixture('cm_past_1');
      expect(updated?.status).toBe('FINISHED');
      expect(updated?.homeGoals).toBe(2);
      expect(updated?.awayGoals).toBe(0);
    } finally {
      vi.unstubAllEnvs();
      delete process.env.APIFOOTBALL_KEY;
    }
  });

  it('does not overwrite already FINISHED fixtures', async () => {
    const kickoffMs = Date.now() - 5 * 3600 * 1000;
    CanonicalFixtureFreshnessGate.upsertFixture({
      canonicalMatchId: 'cm_fin_1',
      providerMatchId: '777001',
      homeTeam: 'Real Madrid',
      awayTeam: 'Barcelona',
      competition: 'La Liga',
      season: '2026',
      kickoffUtc: new Date(kickoffMs).toISOString(),
      status: 'FINISHED',
      homeGoals: 3,
      awayGoals: 1,
      provider: 'api-football',
    });

    const report = await CanonicalResultSyncBridge.syncCompletedFixtures({ nowMs: Date.now() });
    expect(report.scannedCount).toBe(0);
    expect(report.updatedToFinished).toBe(0);
  });
});
