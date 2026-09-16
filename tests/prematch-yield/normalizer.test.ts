import { describe, it, expect } from 'vitest';
import { normalizeMatchOdds, generateFixtureKey } from '../../src/lib/research/prematch-yield/normalizer';
import { RawFootyStatsMatch } from '../../src/lib/research/prematch-yield/types';

describe('Prematch Yield Proxy Normalizer', () => {
  const sampleMatch: RawFootyStatsMatch = {
    id: 9991,
    homeID: 10,
    awayID: 20,
    season: '2024/2025',
    status: 'complete',
    home_name: 'Manchester United',
    away_name: 'Liverpool',
    homeGoalCount: 2,
    awayGoalCount: 1,
    totalGoalCount: 3,
    date_unix: 1724000000, // 2024-08-18T16:53:20.000Z -> 2024-08-18
    odds_ft_1: 2.30,
    odds_ft_x: 3.40,
    odds_ft_2: 3.10,
    odds_btts_yes: 1.70,
    odds_btts_no: 2.10,
    odds_ft_over25: 1.85,
    odds_ft_under25: 2.05,
    odds_ft_over05: 1.05,
    odds_ft_under05: 12.0,
    odds_team_a_cs_yes: 3.50,
    odds_team_a_cs_no: 1.30,
    // Unquoted/zero values
    odds_team_b_cs_yes: 0,
    odds_team_b_cs_no: 0,
    odds_ft_over45: 0,
    odds_ft_under45: 0,
  };

  it('generates consistent canonical fixtureKey with lowercase slugs', () => {
    const key = generateFixtureKey('2024-2025', '2024-08-18', 'Manchester United', 'Liverpool');
    expect(key).toBe('EPL|2024-2025|2024-08-18|manchester-united|liverpool');
  });

  it('normalizes odds into rows with strict proxy provenance and null timestamp/bookmaker', () => {
    const rows = normalizeMatchOdds(sampleMatch, '2024-2025', 'data/raw/footystats/epl/2024-2025.json', 0);

    expect(rows.length).toBeGreaterThan(0);

    for (const row of rows) {
      expect(row.provenance).toBe('footystats_proxy');
      expect(row.oddsTimestamp).toBeNull();
      expect(row.bookmaker).toBeNull();
      expect(row.sourceFile).toBe('data/raw/footystats/epl/2024-2025.json');
      expect(row.sourceRow).toBe(0);
      expect(row.odds).toBeGreaterThan(1.0);
    }
  });

  it('extracts 1X2, BTTS, and OU markets correctly', () => {
    const rows = normalizeMatchOdds(sampleMatch, '2024-2025', 'data/raw/footystats/epl/2024-2025.json', 0);

    const home1x2 = rows.find(r => r.market === '1X2' && r.side === 'home');
    expect(home1x2).toBeDefined();
    expect(home1x2?.odds).toBe(2.30);
    expect(home1x2?.line).toBeNull();

    const bttsYes = rows.find(r => r.market === 'BTTS' && r.side === 'yes');
    expect(bttsYes).toBeDefined();
    expect(bttsYes?.odds).toBe(1.70);

    const ou25Over = rows.find(r => r.market === 'OU' && r.line === 2.5 && r.side === 'over');
    expect(ou25Over).toBeDefined();
    expect(ou25Over?.odds).toBe(1.85);

    const ou25Under = rows.find(r => r.market === 'OU' && r.line === 2.5 && r.side === 'under');
    expect(ou25Under).toBeDefined();
    expect(ou25Under?.odds).toBe(2.05);
  });

  it('omits rows where odds were 0 or missing', () => {
    const rows = normalizeMatchOdds(sampleMatch, '2024-2025', 'data/raw/footystats/epl/2024-2025.json', 0);

    const csBYes = rows.find(r => r.market === 'CS_B' && r.side === 'yes');
    expect(csBYes).toBeUndefined();

    const ou45Over = rows.find(r => r.market === 'OU' && r.line === 4.5 && r.side === 'over');
    expect(ou45Over).toBeUndefined();
  });
});

