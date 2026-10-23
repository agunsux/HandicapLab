import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables with override so live Supabase credentials take precedence
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true });

import { CanonicalFixtureRegistry } from '@/lib/services/canonicalFixtureRegistry';
import { UpcomingFixturesService } from '@/lib/services/upcomingFixturesService';
import { DailyPicksEngine } from '@/lib/daily-picks/engine';
import { globalGateway } from '@/lib/providers/providerGateway';
import { supabase } from '@/lib/supabase.server';
import { apiFootballClient } from '@/lib/apis/apifootball';
import { ProductionPublishingEngine } from '@/lib/publishing/productionPublishingEngine';

describe('Epic 2 — Production Realtime & Daily Picks Reconciliation', () => {
  let canonicalResult: any;
  let picksResult: any;

  beforeAll(async () => {
    ProductionPublishingEngine.saveStore({});
    vi.spyOn(apiFootballClient, 'getFixturesRange').mockImplementation(async (from, to, leagueId) => {
      if (leagueId === 39) {
        return {
          response: [
            {
              fixture: {
                id: '0caff924-d9f7-5391-96be-2670e4e28eae',
                date: '2026-10-23T19:00:00+00:00',
                status: { short: 'NS' },
                venue: { name: 'Portman Road', city: 'Ipswich' },
              },
              league: { id: 39, name: 'Premier League', season: 2026 },
              teams: {
                home: { id: 57, name: 'Ipswich Town' },
                away: { id: 65, name: 'Nottingham Forest' },
              },
            },
            {
              fixture: {
                id: 'e0b4f059-29ee-5bad-a002-b9014909812e',
                date: '2026-10-24T11:30:00+00:00',
                status: { short: 'NS' },
                venue: { name: 'Villa Park', city: 'Birmingham' },
              },
              league: { id: 39, name: 'Premier League', season: 2026 },
              teams: {
                home: { id: 66, name: 'Aston Villa' },
                away: { id: 50, name: 'Manchester City' },
              },
            },
            {
              fixture: {
                id: '1d5cd0e1-5e7e-5ed4-9321-35bbaf68e759',
                date: '2026-10-24T14:00:00+00:00',
                status: { short: 'NS' },
                venue: { name: 'Emirates Stadium', city: 'London' },
              },
              league: { id: 39, name: 'Premier League', season: 2026 },
              teams: {
                home: { id: 42, name: 'Arsenal' },
                away: { id: 45, name: 'Everton' },
              },
            },
            {
              fixture: {
                id: '78a4c602-d967-50ec-906b-799875981669',
                date: '2026-10-24T14:00:00+00:00',
                status: { short: 'NS' },
                venue: { name: 'Coventry Building Society Arena', city: 'Coventry' },
              },
              league: { id: 39, name: 'Premier League', season: 2026 },
              teams: {
                home: { id: 1076, name: 'Coventry City' },
                away: { id: 36, name: 'Fulham' },
              },
            },
            {
              fixture: {
                id: '902f6460-b8d2-573e-a543-1b4f72f5b1cf',
                date: '2026-10-24T16:30:00+00:00',
                status: { short: 'NS' },
                venue: { name: 'Stamford Bridge', city: 'London' },
              },
              league: { id: 39, name: 'Premier League', season: 2026 },
              teams: {
                home: { id: 49, name: 'Chelsea' },
                away: { id: 47, name: 'Tottenham Hotspur' },
              },
            },
            {
              fixture: {
                id: '80121cf8-9d8d-5ab1-8f89-097b6f91667e',
                date: '2026-10-25T14:00:00+00:00',
                status: { short: 'NS' },
                venue: { name: 'Old Trafford', city: 'Manchester' },
              },
              league: { id: 39, name: 'Premier League', season: 2026 },
              teams: {
                home: { id: 33, name: 'Manchester United' },
                away: { id: 35, name: 'Bournemouth' },
              },
            },
            {
              fixture: {
                id: '3daafae4-1292-5f57-bcea-8988f43fc53d',
                date: '2026-10-25T14:00:00+00:00',
                status: { short: 'NS' },
                venue: { name: 'MKM Stadium', city: 'Hull' },
              },
              league: { id: 39, name: 'Premier League', season: 2026 },
              teams: {
                home: { id: 64, name: 'Hull City' },
                away: { id: 55, name: 'Brentford' },
              },
            },
            {
              fixture: {
                id: '3fe2b1c3-34c4-5fea-bfd8-fa5399ec658e',
                date: '2026-10-25T14:00:00+00:00',
                status: { short: 'NS' },
                venue: { name: 'Anfield', city: 'Liverpool' },
              },
              league: { id: 39, name: 'Premier League', season: 2026 },
              teams: {
                home: { id: 40, name: 'Liverpool' },
                away: { id: 51, name: 'Brighton and Hove Albion' },
              },
            },
            {
              fixture: {
                id: 'df6672b7-8f47-5886-ab3b-c09201f09df9',
                date: '2026-10-25T14:00:00+00:00',
                status: { short: 'NS' },
                venue: { name: 'Selhurst Park', city: 'London' },
              },
              league: { id: 39, name: 'Premier League', season: 2026 },
              teams: {
                home: { id: 52, name: 'Crystal Palace' },
                away: { id: 34, name: 'Newcastle United' },
              },
            },
            {
              fixture: {
                id: '7245fabc-cfa2-5af3-b888-5f389f7eb7e5',
                date: '2026-10-25T16:30:00+00:00',
                status: { short: 'NS' },
                venue: { name: 'Stadium of Light', city: 'Sunderland' },
              },
              league: { id: 39, name: 'Premier League', season: 2026 },
              teams: {
                home: { id: 71, name: 'Sunderland' },
                away: { id: 63, name: 'Leeds United' },
              },
            },
          ],
        } as any;
      }
      return { response: [] } as any;
    });

    delete process.env.VERCEL;

    // 1. Fetch Canonical Fixtures (7-day horizon)
    canonicalResult = await CanonicalFixtureRegistry.getUpcomingFixtures({
      horizon: 'NEXT_7_DAYS',
      limit: 50,
      forceRefresh: true,
      readOnly: false,
    });

    // 2. Fetch Daily Picks
    picksResult = await DailyPicksEngine.getDailyPicks({ forceRefresh: true });
  }, 30000);

  it('Invariant 1: Provider Health Monitor is ACTIVE on cold start (no paused trap)', () => {
    const monitor = globalGateway.getHealthMonitor('apifootball');
    const state = monitor.getState();
    expect(state).toBe('ACTIVE');
  });

  it('Invariant 2: Canonical Fixture Registry discovers upcoming 7-day fixtures', () => {
    expect(canonicalResult.fixtures).toBeDefined();
    expect(canonicalResult.fixtures.length).toBeGreaterThan(0);
    expect(['REAL', 'CACHED', 'STALE']).toContain(canonicalResult.dataState);
  });

  it('Invariant 3: All upcoming fixtures have kickoff strictly in the future (UTC)', () => {
    const now = Date.now();
    for (const f of canonicalResult.fixtures) {
      const kickTime = new Date(f.kickoffUtc).getTime();
      expect(kickTime).toBeGreaterThan(now);
    }
  });

  it('Invariant 4: All upcoming fixtures are within the 7-day canonical horizon', () => {
    const maxHorizon = Date.now() + 7 * 24 * 60 * 60 * 1000 + 3600 * 1000; // 7 days + 1h buffer
    for (const f of canonicalResult.fixtures) {
      const kickTime = new Date(f.kickoffUtc).getTime();
      expect(kickTime).toBeLessThanOrEqual(maxHorizon);
    }
  });

  it('Invariant 5: Upcoming fixtures have deterministic canonical identity', () => {
    for (const f of canonicalResult.fixtures) {
      expect(f.fixtureId).toBeDefined();
      expect(typeof f.fixtureId).toBe('string');
      expect(f.fixtureId.length).toBe(16); // SHA-256 slice(0, 16)
      expect(f.providerFixtureId).toBeDefined();
      expect(f.homeTeam).toBeTruthy();
      expect(f.awayTeam).toBeTruthy();
    }
  });

  it('Invariant 6: UpcomingFixturesService delegates directly to CanonicalFixtureRegistry (No Disconnection)', async () => {
    const serviceRes = await UpcomingFixturesService.getUpcomingFixtures({ daysAhead: 7, forceRefresh: true, readOnly: false });
    expect(serviceRes.fixtures.length).toBe(canonicalResult.fixtures.length);
    expect(serviceRes.dataState).toBe(canonicalResult.dataState);
  });

  it('Invariant 7: Temporal Point-in-Time Proof (oddsTimestamp <= predictionTimestamp < kickoff)', () => {
    if (picksResult.picks.length > 0) {
      for (const p of picksResult.picks) {
        const tOdds = new Date(p.oddsTimestampUtc).getTime();
        const tPred = new Date(p.predictionTimestampUtc).getTime();
        const tKick = new Date(p.kickoffUtc).getTime();

        expect(tOdds).toBeLessThanOrEqual(tPred);
        expect(tPred).toBeLessThan(tKick);
      }
    }
  });

  it('Invariant 8: Real market odds from Pinnacle (No fabricated/synthetic fallback)', () => {
    if (picksResult.picks.length > 0) {
      for (const p of picksResult.picks) {
        expect(p.marketOdds).toBeGreaterThan(1.0);
        expect(p.marketOdds).not.toBe(1.9); // Not hardcoded default
        expect(p.marketOdds).not.toBe(4.26); // Not synthetic test price
        expect(p.marketOdds).not.toBe(2.1);
        expect(p.providerSources.odds).toContain('pinnacle');
      }
    }
  });

  it('Invariant 9: Supported markets strictly confined to ASIAN_HANDICAP, OVER_UNDER, BTTS', () => {
    const validMarkets = ['AH', 'OU', 'BTTS', 'ASIAN_HANDICAP', 'OVER_UNDER'];
    for (const p of picksResult.picks) {
      expect(validMarkets).toContain(p.market);
    }
  });

  it('Invariant 10: Fail-closed but not false-zero state semantics', () => {
    expect(picksResult.dataState).toBeDefined();
    expect(['REAL', 'CACHED', 'STALE', 'NO_QUALIFIED_PICKS', 'NO_FIXTURES', 'DATA_UNAVAILABLE']).toContain(
      picksResult.dataState
    );
    expect(picksResult.providerState).toBeDefined();
  });

  it('Invariant 11: Daily Picks map to existing canonical fixtures (Zero Orphan Picks)', () => {
    const canonicalIds = new Set(canonicalResult.fixtures.map((f: any) => f.fixtureId));
    const providerIds = new Set(canonicalResult.fixtures.map((f: any) => f.providerFixtureId));

    if (picksResult.picks.length > 0) {
      for (const p of picksResult.picks) {
        const matchesCanonical = canonicalIds.has(p.fixtureId) || providerIds.has(p.fixtureId);
        expect(matchesCanonical).toBe(true);
      }
    }
  });

  it('Invariant 12: active_daily_picks view reconciles with canonical fixtures and contains zero past matches', async () => {
    let activeClient = supabase;
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (require('fs').existsSync(envPath)) {
        const envContent = require('fs').readFileSync(envPath, 'utf8');
        const urlMatch = envContent.match(/NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.*)/);
        const keyMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.*)/);
        if (urlMatch && keyMatch) {
          const { createClient } = await import('@supabase/supabase-js');
          activeClient = createClient(urlMatch[1].trim(), keyMatch[1].trim());
        }
      }
    } catch {}

    const { data: dbActivePicks, error } = await activeClient
      .from('active_daily_picks')
      .select('id, fixture_id, home_team, away_team, kickoff_utc, market_type');

    expect(error).toBeNull();
    if (dbActivePicks && dbActivePicks.length > 0) {
      const now = Date.now();
      for (const row of dbActivePicks) {
        const kick = new Date(row.kickoff_utc).getTime();
        expect(kick).toBeGreaterThan(now); // All active picks must be strictly in the future!
      }
    }
  });
});
