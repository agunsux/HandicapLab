// Sprint A1 + A2 — Season Registry & Dataset Registry tests

import { describe, it, expect } from 'vitest';
import { SeasonRegistry } from '../../src/lib/evidence-platform/seasonRegistry';
import { DatasetRegistry } from '../../src/lib/evidence-platform/datasetRegistry';

describe('A1 — SeasonRegistry', () => {
  it('resolves leagues by canonical id, short name, and alias', () => {
    const r = new SeasonRegistry();
    expect(r.resolveLeague('comp:epl')?.canonicalId).toBe('comp:epl');
    expect(r.resolveLeague('EPL')?.canonicalId).toBe('comp:epl');
    expect(r.resolveLeague('premier league')?.canonicalId).toBe('comp:epl');
    expect(r.resolveLeague('la liga')?.canonicalId).toBe('comp:laliga');
    expect(r.resolveLeague('nonexistent')).toBeNull();
  });

  it('resolves canonical id from alias', () => {
    const r = new SeasonRegistry();
    expect(r.resolveCanonicalId('serie a')).toBe('comp:seriea');
    expect(r.resolveCanonicalId('unknown')).toBeNull();
  });

  it('filters supported leagues by active state', () => {
    const r = new SeasonRegistry();
    const active = r.getSupportedLeagues(true);
    expect(active.every((l) => l.active)).toBe(true);
    expect(r.getSupportedLeagues().length).toBeGreaterThan(active.length);
  });

  it('reports league support', () => {
    const r = new SeasonRegistry();
    expect(r.isLeagueSupported('bundesliga')).toBe(true);
    expect(r.isLeagueSupported('mls')).toBe(false);
  });

  it('seeds default seasons per active league', () => {
    const r = new SeasonRegistry();
    const seasons = r.getSeasonsForLeague('comp:epl');
    expect(seasons.length).toBeGreaterThan(0);
    expect(seasons[0].leagueId).toBe('comp:epl');
    // sorted ascending by startYear
    for (let i = 1; i < seasons.length; i++) {
      expect(seasons[i].startYear).toBeGreaterThanOrEqual(seasons[i - 1].startYear);
    }
  });

  it('exposes promotion/relegation awareness', () => {
    const r = new SeasonRegistry();
    expect(r.getLeague('comp:epl')?.promotionRelegation).toBe(true);
    expect(r.getLeague('comp:ucl')?.promotionRelegation).toBe(false);
  });

  it('querySeasons filters by league, active, provider and year window', () => {
    const r = new SeasonRegistry();
    const byLeague = r.querySeasons({ leagueId: 'comp:epl' });
    expect(byLeague.every((s) => s.leagueId === 'comp:epl')).toBe(true);

    const activeOnly = r.querySeasons({ activeOnly: true });
    expect(activeOnly.every((s) => s.active)).toBe(true);

    const withProvider = r.querySeasons({ provider: 'api-football', maxEndYear: 2020 });
    expect(withProvider.every((s) => s.endYear <= 2020)).toBe(true);

    const window = r.querySeasons({ minStartYear: 2020 });
    expect(window.every((s) => s.startYear >= 2020)).toBe(true);
  });

  it('reports provider availability per season', () => {
    const r = new SeasonRegistry();
    const seasons = r.getSeasonsForLeague('comp:epl');
    const seasonId = seasons[seasons.length - 1].id;
    const avail = r.getProviderAvailability(seasonId);
    expect(avail.length).toBeGreaterThan(0);
    expect(r.isProviderAvailable(seasonId, 'football-data')).toBe(true);
    expect(r.isProviderAvailable(seasonId, 'nonexistent-provider')).toBe(false);
  });

  it('returns active seasons and statistics', () => {
    const r = new SeasonRegistry();
    expect(r.getActiveSeasons().every((s) => s.active)).toBe(true);
    const stats = r.getStatistics();
    expect(stats.leagues).toBeGreaterThan(0);
    expect(stats.seasons).toBeGreaterThan(0);
    expect(stats.activeSeasons).toBeGreaterThan(0);
  });

  it('supports dependency-injected leagues and seasons', () => {
    const r = new SeasonRegistry(
      [{ canonicalId: 'comp:test', name: 'Test League', shortName: 'TL', country: 'Nowhere', tier: 1, timezone: 'UTC', aliases: ['tl'], active: true, promotionRelegation: false }],
      [{ id: 'season:test:2024', leagueId: 'comp:test', name: '2024', startYear: 2024, endYear: 2025, startDate: '2024-01-01T00:00:00Z', endDate: '2024-12-31T00:00:00Z', active: true, providers: [{ provider: 'p', available: true }], promotedTeams: [], relegatedTeams: [] }]
    );
    expect(r.resolveLeague('tl')?.canonicalId).toBe('comp:test');
    expect(r.isSeasonSupported('season:test:2024')).toBe(true);
    expect(r.getStatistics().seasons).toBe(1);
  });
});

describe('A2 — DatasetRegistry', () => {
  const input = {
    provider: 'football-data',
    leagueId: 'comp:epl',
    seasonId: 'season:epl:2024-2025',
    sourcePath: '/data/epl.csv',
    checksum: 'abc',
    fingerprint: 'fp1',
    fileSize: 1000,
    rowCount: 380,
    integrityScore: 95,
  };

  it('assigns permanent ds_ ids and freezes records', () => {
    const r = new DatasetRegistry();
    const entry = r.register(input);
    expect(entry.id).toMatch(/^ds_\d{6}$/);
    expect(Object.isFrozen(entry)).toBe(true);
    expect(entry.status).toBe('imported');
    expect(entry.version).toBe('1.0.0');
    expect(entry.importedAt).toBeTruthy();
  });

  it('retrieves by id and reports existence', () => {
    const r = new DatasetRegistry();
    const entry = r.register(input);
    expect(r.get(entry.id)).toEqual(entry);
    expect(r.has(entry.id)).toBe(true);
    expect(r.get('ds_999999')).toBeUndefined();
  });

  it('finds by fingerprint and checksum', () => {
    const r = new DatasetRegistry();
    const entry = r.register(input);
    expect(r.findByFingerprint('fp1')?.id).toBe(entry.id);
    expect(r.findByChecksum('abc')?.id).toBe(entry.id);
    expect(r.findByFingerprint('missing')).toBeUndefined();
  });

  it('queries by provider, league, season, status, integrity', () => {
    const r = new DatasetRegistry();
    r.register(input);
    r.register({ ...input, provider: 'api-football', fingerprint: 'fp2', integrityScore: 50 });
    expect(r.query({ provider: 'football-data' }).length).toBe(1);
    expect(r.query({ leagueId: 'comp:epl' }).length).toBe(2);
    expect(r.query({ minIntegrityScore: 90 }).length).toBe(1);
    expect(r.query({ status: 'imported' }).length).toBe(2);
    expect(r.query({ status: 'archived' }).length).toBe(0);
  });

  it('transitions status via markStatus (frozen result)', () => {
    const r = new DatasetRegistry();
    const entry = r.register(input);
    const updated = r.markStatus(entry.id, 'validated');
    expect(updated.status).toBe('validated');
    expect(Object.isFrozen(updated)).toBe(true);
    expect(() => r.markStatus('ds_999999', 'archived')).toThrow();
  });

  it('computes statistics', () => {
    const r = new DatasetRegistry();
    r.register(input);
    r.register({ ...input, fingerprint: 'fp2', integrityScore: 55 });
    const stats = r.getStatistics();
    expect(stats.total).toBe(2);
    expect(stats.byStatus.imported).toBe(2);
    expect(stats.avgIntegrityScore).toBeCloseTo(75, 5);
  });
});
