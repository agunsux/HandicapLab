import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runAhYieldValidation } from '../../src/lib/research/ah-yield/ahEngine';
import {
  buildAhResearchViewModel,
  loadAhResearchViewModel,
} from '../../src/lib/research/ah-yield/ahViewModel';

let dir: string;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ah-view-'));
  const csv = path.join(dir, 'modern.csv');
  fs.writeFileSync(
    csv,
    'Div,Date,HomeTeam,AwayTeam,AHh,B365AHH,B365AHA,PAHH,PAHA,AHCh,B365CAHH,B365CAHA,PCAHH,PCAHA\n' +
      'E0,01/08/2024,A,B,-0.5,1.95,1.95,1.96,1.94,-0.5,1.97,1.93,1.98,1.92\n' +
      'E0,08/08/2024,B,C,-0.25,1.9,2.0,1.91,1.99,-0.25,1.92,1.98,1.93,1.97\n'
  );
  const canonical = [
    {
      canonicalId: 'ENG-PL|2024-2025|2024-08-01|a|b',
      leagueId: 'ENG-PL',
      cluster: 'A',
      season: '2024-2025',
      matchDate: '2024-08-01',
      homeTeam: 'A',
      awayTeam: 'B',
      homeGoals: 1,
      awayGoals: 0,
      result: 'H',
      resultVerified: true,
      totalGoals: 1,
    },
    {
      canonicalId: 'ENG-PL|2024-2025|2024-08-08|b|c',
      leagueId: 'ENG-PL',
      cluster: 'A',
      season: '2024-2025',
      matchDate: '2024-08-08',
      homeTeam: 'B',
      awayTeam: 'C',
      homeGoals: 0,
      awayGoals: 0,
      result: 'D',
      resultVerified: true,
      totalGoals: 0,
    },
  ];
  const odds = [
    {
      odds_id: 'row-1-open',
      canonical_id: 'ENG-PL|2024-2025|2024-08-01|a|b',
      league_id: 'ENG-PL',
      cluster: 'A',
      season: '2024-2025',
      match_date: '2024-08-01',
      market: 'AH',
      observation: 'opening',
      bookmaker_source: 'pinnacle',
      line: -0.5,
      home_odds: 1.96,
      draw_odds: null,
      away_odds: 1.94,
      over_odds: null,
      under_odds: null,
      source_file: csv,
      source_row: 2,
      dataset_version: 'test',
      ingestion_version: 'test',
    },
    {
      odds_id: 'row-2-open',
      canonical_id: 'ENG-PL|2024-2025|2024-08-08|b|c',
      league_id: 'ENG-PL',
      cluster: 'A',
      season: '2024-2025',
      match_date: '2024-08-08',
      market: 'AH',
      observation: 'opening',
      bookmaker_source: 'pinnacle',
      line: -0.25,
      home_odds: 1.91,
      draw_odds: null,
      away_odds: 1.99,
      over_odds: null,
      under_odds: null,
      source_file: csv,
      source_row: 3,
      dataset_version: 'test',
      ingestion_version: 'test',
    },
  ];
  fs.writeFileSync(path.join(dir, 'canonical_matches.jsonl'), canonical.map((c) => JSON.stringify(c)).join('\n') + '\n');
  fs.writeFileSync(path.join(dir, 'market_odds.jsonl'), odds.map((o) => JSON.stringify(o)).join('\n') + '\n');
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('AH research view model', () => {
  it('maps a real engine run into the compact dashboard payload', () => {
    const report = runAhYieldValidation({
      dataPaths: {
        canonicalMatches: path.join(dir, 'canonical_matches.jsonl'),
        marketOdds: path.join(dir, 'market_odds.jsonl'),
      },
      bootstrapIterations: 10,
    });
    const view = buildAhResearchViewModel(report);
    expect(view.engineVersion).toBe(report.engineVersion);
    expect(view.quality.canonicalMatches).toBe(2);
    expect(view.quality.validObservations).toBe(4);
    expect(view.cohorts).toHaveLength(1);
    expect(view.cohorts[0].cohortKey).toBe('pinnacle|opening');
    expect(view.cohorts[0].valueRows.length).toBeGreaterThan(0);
    // 2024-2025 only → walk-forward must be explicitly skipped, never fabricated.
    expect(view.walkForward[0].skipped).toContain('INSUFFICIENT_SEASONS');
    expect(view.limitations.length).toBeGreaterThan(0);
  });

  it('returns null for a missing artifact instead of fabricating data', () => {
    expect(loadAhResearchViewModel(path.join(dir, 'does-not-exist.json'))).toBeNull();
  });
});
