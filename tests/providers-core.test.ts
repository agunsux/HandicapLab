// Provider Core Tests — Registry, Config, Normalizers
import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../src/lib/data/providers/core/ProviderRegistry';
import { getProviderConfig, setProviderConfig } from '../src/lib/data/providers/core/config';
import { normalizeFixture, normalizeFixtures, normalizeFixtureStatus } from '../src/lib/data/providers/apiFootball/normalizers';
import { normalizeOddsSnapshots } from '../src/lib/data/providers/odds/normalizers';

describe('ProviderRegistry', () => {
  it('is a singleton', () => {
    const a = ProviderRegistry.getInstance();
    const b = ProviderRegistry.getInstance();
    expect(a).toBe(b);
  });

  it('returns empty registry initially', () => {
    const reg = ProviderRegistry.getInstance();
    const r = reg.getRegisteredProviders();
    expect(r.fixtures).toEqual([]);
    expect(r.odds).toEqual([]);
    expect(r.results).toEqual([]);
  });

  it('resolving unregistered provider throws', () => {
    const reg = ProviderRegistry.getInstance();
    expect(() => reg.resolveFixtures()).toThrow('No fixtures provider registered');
    expect(() => reg.resolveOdds()).toThrow('No odds provider registered');
  });
});

describe('ProviderConfig', () => {
  it('has default config with env keys', () => {
    const config = getProviderConfig();
    expect(config.apiFootball.baseUrl).toBe('https://v3.football.api-sports.io');
    expect(config.theOddsApi.baseUrl).toBe('https://api.the-odds-api.com/v4');
  });

  it('setProviderConfig merges overrides', () => {
    const orig = getProviderConfig();
    setProviderConfig({ apiFootball: { ...orig.apiFootball, rateLimitRequests: 20 } });
    expect(getProviderConfig().apiFootball.rateLimitRequests).toBe(20);
    setProviderConfig({ apiFootball: orig.apiFootball });
  });
});

describe('ApiFootball Normalizers', () => {
  const mockFixture = {
    fixture: { id: 12345, date: '2025-01-15T15:00:00Z', status: { short: 'NS', long: 'Not Started' } },
    league: { id: 39, name: 'English Premier League', season: 2025 },
    teams: { home: { id: 33, name: 'Manchester United', logo: '' }, away: { id: 40, name: 'Liverpool', logo: '' } },
    goals: { home: null, away: null },
    score: { halftime: { home: null, away: null }, fulltime: { home: null, away: null }, extratime: { home: null, away: null }, penalty: { home: null, away: null } },
  };

  it('normalizeFixtureStatus maps API status correctly', () => {
    expect(normalizeFixtureStatus('NS')).toBe('upcoming');
    expect(normalizeFixtureStatus('1H')).toBe('live');
    expect(normalizeFixtureStatus('2H')).toBe('live');
    expect(normalizeFixtureStatus('FT')).toBe('finished');
    expect(normalizeFixtureStatus('AET')).toBe('finished');
    expect(normalizeFixtureStatus('CANC')).toBe('cancelled');
    expect(normalizeFixtureStatus('PST')).toBe('upcoming');
  });

  it('normalizeFixture produces correct Fixture object', () => {
    const fixture = normalizeFixture(mockFixture as any);
    expect(fixture.fixtureId).toBe('af_12345');
    expect(fixture.league).toBe('English Premier League');
    expect(fixture.homeTeam).toBe('Manchester United');
    expect(fixture.awayTeam).toBe('Liverpool');
    expect(fixture.status).toBe('upcoming');
    expect(fixture.homeScore).toBeNull();
    expect(fixture.awayScore).toBeNull();
  });

  it('normalizeFixtures handles empty response', () => {
    expect(normalizeFixtures({ response: [] } as any)).toEqual([]);
  });
});

describe('OddsApi Normalizers', () => {
  const mockOddsResponse = {
    data: [{
      id: 'match_1', sport_key: 'soccer_epl', sport_title: 'English Premier League',
      commence_time: '2025-01-15T15:00:00Z', home_team: 'Arsenal', away_team: 'Chelsea',
      bookmakers: [{
        key: 'pinnacle', title: 'Pinnacle', last_update: '2025-01-14T12:00:00Z',
        markets: [{
          key: 'h2h', last_update: '2025-01-14T12:00:00Z',
          outcomes: [
            { name: 'Arsenal', price: 2.10 },
            { name: 'Draw', price: 3.40 },
            { name: 'Chelsea', price: 3.80 },
          ],
        }],
      }],
    }],
  };

  it('normalizeOddsSnapshots produces correct OddsSnapshot objects', () => {
    const snapshots = normalizeOddsSnapshots(mockOddsResponse as any);
    expect(snapshots.length).toBe(1);
    expect(snapshots[0].bookmaker).toBe('pinnacle');
    expect(snapshots[0].marketType).toBe('moneyline');
    expect(snapshots[0].priceHome).toBe(2.10);
    expect(snapshots[0].priceAway).toBe(3.80);
    expect(snapshots[0].priceDraw).toBe(3.40);
    expect(snapshots[0].fixtureId).toContain('match_1');
  });

  it('handles empty response', () => {
    expect(normalizeOddsSnapshots({ data: [] } as any)).toEqual([]);
  });
});
