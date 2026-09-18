import { describe, it, expect } from 'vitest';
import {
  FixtureMappingEngine,
  normalizeTeamName,
  type CanonicalFixtureRef,
  type ProviderFixtureRef,
} from '../../src/lib/identity/fixtureMapping';

describe('Phase 1: Canonical Match Reconciliation Tests', () => {
  const canonicalMatches: CanonicalFixtureRef[] = [
    {
      canonicalMatchId: 'ENG-PL|2025-2026|2026-02-01|aston-villa|brentford',
      leagueKey: 'ENG-PL',
      homeTeam: 'Aston Villa',
      awayTeam: 'Brentford FC',
      kickoffDate: '2026-02-01',
      kickoffMs: Date.parse('2026-02-01T14:00:00.000Z'),
      season: '2025-2026',
    },
    {
      canonicalMatchId: 'ENG-PL|2025-2026|2026-03-01|brighton|nott-m-forest',
      leagueKey: 'ENG-PL',
      homeTeam: 'Brighton & Hove Albion',
      awayTeam: 'Nottingham Forest',
      kickoffDate: '2026-03-01',
      kickoffMs: Date.parse('2026-03-01T14:00:00.000Z'),
      season: '2025-2026',
    },
  ];

  const aliases = {
    'ENG-PL': {
      'brentford': 'Brentford FC',
      'brighton': 'Brighton & Hove Albion',
    },
  };

  const engine = new FixtureMappingEngine(canonicalMatches, aliases);

  it('1. Reconciles exact team names and calendar date successfully', () => {
    const providerRef: ProviderFixtureRef = {
      provider: 'oddspapi',
      providerEventId: 'id1000001761300977',
      leagueKey: 'ENG-PL',
      homeTeam: 'Aston Villa',
      awayTeam: 'Brentford', // resolved through alias
      kickoffMs: Date.parse('2026-02-01T14:00:00.000Z'),
    };

    const decision = engine.map(providerRef);
    expect(decision.status).toBe('MAPPED');
    expect(decision.canonicalMatchId).toBe('ENG-PL|2025-2026|2026-02-01|aston-villa|brentford');
    expect(decision.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it('2. Normalizes team strings with diacritics and casing', () => {
    expect(normalizeTeamName('  Brighton & Hove Albion  ')).toBe('brighton and hove albion');
    expect(normalizeTeamName('Atlético Madrid')).toBe('atletico madrid');
    expect(normalizeTeamName('1. FC Köln')).toBe('1 fc koln');
  });

  it('3. Reconciles via explicit map override if provided', () => {
    const providerRef: ProviderFixtureRef = {
      provider: 'oddspapi',
      providerEventId: 'custom-event-123',
      leagueKey: 'ENG-PL',
      homeTeam: 'Unknown Home',
      awayTeam: 'Unknown Away',
      kickoffMs: Date.parse('2026-02-01T14:00:00.000Z'),
    };

    const explicitMap: Record<string, string> = {
      'oddspapi:custom-event-123': 'ENG-PL|2025-2026|2026-02-01|aston-villa|brentford',
    };

    const decision = engine.map(providerRef, explicitMap);
    expect(decision.status).toBe('MAPPED');
    expect(decision.method).toBe('PROVIDER_ID');
    expect(decision.confidence).toBe(1.0);
    expect(decision.canonicalMatchId).toBe('ENG-PL|2025-2026|2026-02-01|aston-villa|brentford');
  });

  it('4. Returns UNMAPPED for completely unmatched fixtures without guessing', () => {
    const providerRef: ProviderFixtureRef = {
      provider: 'oddspapi',
      providerEventId: 'id99999999',
      leagueKey: 'ENG-PL',
      homeTeam: 'Real Madrid', // does not play in ENG-PL
      awayTeam: 'Barcelona',
      kickoffMs: Date.parse('2026-02-01T14:00:00.000Z'),
    };

    const decision = engine.map(providerRef);
    expect(decision.status).toBe('UNMAPPED');
    expect(decision.canonicalMatchId).toBeNull();
  });
});
