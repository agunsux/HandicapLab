import { describe, it, expect } from 'vitest';
import * as path from 'path';
import {
  FixtureMappingEngine,
  normalizeTeamName,
  loadTeamAliases,
  detectDuplicateProviderEvents,
  type CanonicalFixtureRef,
  type ProviderFixtureRef,
} from '@/lib/identity/fixtureMapping';

const aliases = loadTeamAliases(path.resolve('data/identity/team_aliases.json'));

function canon(overrides: Partial<CanonicalFixtureRef> = {}): CanonicalFixtureRef {
  return {
    canonicalMatchId: 'ENG-PL|2025-2026|2026-01-01|crystal-palace|fulham',
    leagueKey: 'ENG-PL',
    homeTeam: 'Crystal Palace',
    awayTeam: 'Fulham',
    kickoffDate: '2026-01-01',
    kickoffMs: null,
    ...overrides,
  };
}

function provider(overrides: Partial<ProviderFixtureRef> = {}): ProviderFixtureRef {
  return {
    provider: 'oddspapi',
    providerEventId: 'id1000001761300885',
    leagueKey: 'ENG-PL',
    homeTeam: 'Crystal Palace',
    awayTeam: 'Fulham FC',
    kickoffMs: Date.parse('2026-01-01T17:30:00Z'),
    ...overrides,
  };
}

describe('FixtureMappingEngine — deterministic canonical mapping', () => {
  it('maps via explicit provider-ID crosswalk', () => {
    const engine = new FixtureMappingEngine([canon()], aliases);
    const decision = engine.map(provider(), {
      'oddspapi:id1000001761300885': 'ENG-PL|2025-2026|2026-01-01|crystal-palace|fulham',
    });

    expect(decision.status).toBe('MAPPED');
    expect(decision.method).toBe('PROVIDER_ID');
    expect(decision.confidence).toBe(1.0);
    expect(decision.canonicalMatchId).toBe('ENG-PL|2025-2026|2026-01-01|crystal-palace|fulham');
  });

  it('maps via explicit team alias (Manchester City → Man City)', () => {
    const engine = new FixtureMappingEngine(
      [canon({ canonicalMatchId: 'ENG-PL|2025-2026|2026-01-04|man-city|chelsea', homeTeam: 'Man City', awayTeam: 'Chelsea', kickoffDate: '2026-01-04' })],
      aliases
    );
    const decision = engine.map(
      provider({
        homeTeam: 'Manchester City',
        awayTeam: 'Chelsea FC',
        kickoffMs: Date.parse('2026-01-04T16:30:00Z'),
      })
    );

    expect(decision.status).toBe('MAPPED');
    expect(decision.method).toBe('TEAM_ALIAS_DATE');
    expect(decision.confidence).toBe(0.95);
  });

  it('maps via normalized names when no alias is required', () => {
    const engine = new FixtureMappingEngine(
      [canon({ canonicalMatchId: 'ENG-PL|2025-2026|2026-01-03|aston-villa|nott-m-forest', homeTeam: 'Aston Villa', awayTeam: "Nott'm Forest", kickoffDate: '2026-01-03' })],
      {} // no aliases at all
    );
    const decision = engine.map(
      provider({
        homeTeam: 'ASTON-VILLA', // case/punctuation-only difference
        awayTeam: "nott'm forest",
        kickoffMs: Date.parse('2026-01-03T12:30:00Z'),
      })
    );

    expect(decision.status).toBe('MAPPED');
    expect(decision.method).toBe('TEAM_NORMALIZED_DATE');
    expect(decision.confidence).toBe(0.9);
  });

  it('maps an abbreviated provider name through the explicit alias table', () => {
    const engine = new FixtureMappingEngine(
      [canon({ canonicalMatchId: 'ENG-PL|2025-2026|2026-01-03|aston-villa|nott-m-forest', homeTeam: 'Aston Villa', awayTeam: "Nott'm Forest", kickoffDate: '2026-01-03' })],
      aliases
    );
    const decision = engine.map(
      provider({
        homeTeam: 'Aston Villa',
        awayTeam: 'Nottingham Forest',
        kickoffMs: Date.parse('2026-01-03T12:30:00Z'),
      })
    );

    expect(decision.status).toBe('MAPPED');
    expect(decision.method).toBe('TEAM_ALIAS_DATE');
  });

  it('rejects a missing provider event id', () => {
    const engine = new FixtureMappingEngine([canon()], aliases);
    const decision = engine.map(provider({ providerEventId: '' }));
    expect(decision.status).toBe('UNMAPPED');
    expect(decision.reason).toBe('MISSING_PROVIDER_EVENT_ID');
  });

  it('rejects an unresolved team name', () => {
    const engine = new FixtureMappingEngine([canon()], aliases);
    const decision = engine.map(provider({ homeTeam: 'Some Unlisted FC' }));
    expect(decision.status).toBe('UNMAPPED');
    expect(decision.reason).toBe('UNRESOLVED_HOME_TEAM');
  });

  it('rejects wrong home/away orientation as CONFLICT', () => {
    const engine = new FixtureMappingEngine([canon()], aliases);
    const decision = engine.map(provider({ homeTeam: 'Fulham FC', awayTeam: 'Crystal Palace' }));
    expect(decision.status).toBe('CONFLICT');
    expect(decision.reason).toBe('HOME_AWAY_ORIENTATION_CONFLICT');
  });

  it('rejects ambiguous duplicate canonical fixtures', () => {
    const engine = new FixtureMappingEngine(
      [canon(), canon({ canonicalMatchId: 'ENG-PL|2025-2026|2026-01-01|crystal-palace|fulham:dup' })],
      aliases
    );
    const decision = engine.map(provider());
    expect(decision.status).toBe('AMBIGUOUS');
    expect(decision.reason).toContain('MULTIPLE_CANONICAL_CANDIDATES');
  });

  it('rejects an explicit map whose target is missing', () => {
    const engine = new FixtureMappingEngine([canon()], aliases);
    const decision = engine.map(provider(), { 'oddspapi:id1000001761300885': 'does-not-exist' });
    expect(decision.status).toBe('CONFLICT');
    expect(decision.reason).toBe('EXPLICIT_MAP_TARGET_MISSING');
  });

  it('respects the kickoff tolerance when canonical timestamps exist', () => {
    const providerMs = Date.parse('2026-01-01T17:30:00Z');
    const within = new FixtureMappingEngine(
      [canon({ kickoffMs: providerMs + 45 * 60 * 1000 })],
      aliases
    ).map(provider());
    expect(within.status).toBe('MAPPED');

    const beyond = new FixtureMappingEngine(
      [canon({ kickoffMs: providerMs + 3 * 60 * 60 * 1000 })],
      aliases
    ).map(provider());
    expect(beyond.status).toBe('UNMAPPED');
    expect(beyond.reason).toBe('NO_CANONICAL_FIXTURE_ON_DATE');
  });

  it('returns UNMAPPED when no canonical fixture exists on that date', () => {
    const engine = new FixtureMappingEngine([canon()], aliases);
    const decision = engine.map(provider({ kickoffMs: Date.parse('2026-01-09T17:30:00Z') }));
    expect(decision.status).toBe('UNMAPPED');
    expect(decision.reason).toBe('NO_CANONICAL_FIXTURE_ON_DATE');
  });

  it('detects duplicate provider events mapping to different canonical ids', () => {
    const engine = new FixtureMappingEngine([canon()], aliases);
    const first = engine.map(provider());
    const second = engine.map(provider(), {
      'oddspapi:id1000001761300885': 'ENG-PL|2025-2026|2026-01-01|crystal-palace|fulham',
    });
    const duplicate = engine.map(
      provider({ providerEventId: 'id1000001761300885' }),
      {}
    );
    // Force a differing canonical id on the duplicate.
    const conflicting = { ...duplicate, canonicalMatchId: 'OTHER-ID', status: 'MAPPED' as const };

    const conflicts = detectDuplicateProviderEvents([first, second, conflicting]);
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts[0].status).toBe('CONFLICT');
    expect(conflicts[0].reason).toContain('DUPLICATE_PROVIDER_EVENT');
  });

  it('normalizes presentation differences only', () => {
    expect(normalizeTeamName('Brighton & Hove Albion')).toBe('brighton and hove albion');
    expect(normalizeTeamName("Nott'm Forest")).toBe('nott m forest');
    expect(normalizeTeamName('FC Bayern München')).toBe('fc bayern munchen');
    // Meaningful tokens are preserved (no aggressive stripping).
    expect(normalizeTeamName('Manchester City')).not.toBe(normalizeTeamName('Manchester United'));
  });
});
