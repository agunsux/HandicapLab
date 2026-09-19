import { describe, it, expect, beforeAll } from 'vitest';
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

describe('Epic 2 — Production Realtime & Daily Picks Reconciliation', () => {
  let canonicalResult: any;
  let picksResult: any;

  beforeAll(async () => {
    // 1. Fetch Canonical Fixtures (7-day horizon)
    canonicalResult = await CanonicalFixtureRegistry.getUpcomingFixtures({
      horizon: 'NEXT_7_DAYS',
      limit: 50,
      forceRefresh: false,
    });

    // 2. Fetch Daily Picks
    picksResult = await DailyPicksEngine.getDailyPicks({ forceRefresh: false });
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
    const serviceRes = await UpcomingFixturesService.getUpcomingFixtures({ daysAhead: 7 });
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
