import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  buildAhObservations,
  buildBestAvailableObservations,
} from '../../src/lib/research/ah-yield/ahObservations';
import {
  classifySourceLayout,
  createProvenanceResolver,
  snapshotFor,
} from '../../src/lib/research/ah-yield/ahProvenance';
import type {
  CanonicalMatchRecord,
  MarketOddsRecord,
} from '../../src/lib/research/ah-yield/ahTypes';

const stubResolver = {
  resolve: () => 'pinnacle' as const,
  listLayouts: () => [],
};

/** Label-faithful resolver stub for tests that need distinct books. */
const labelResolver = {
  resolve: (_sourceFile: string, _observation: string, bookmakerLabel: string) =>
    bookmakerLabel === 'bet365' ? ('bet365' as const) : bookmakerLabel === 'betbrain' ? ('betbrain_avg' as const) : ('pinnacle' as const),
  listLayouts: () => [],
};

function makeMatch(overrides: Partial<CanonicalMatchRecord> = {}): CanonicalMatchRecord {
  return {
    canonicalId: 'ENG-PL|2024-2025|2024-08-01|home-fc|away-fc',
    leagueId: 'ENG-PL',
    cluster: 'A',
    season: '2024-2025',
    matchDate: '2024-08-01',
    homeTeam: 'Home FC',
    awayTeam: 'Away FC',
    homeGoals: 1,
    awayGoals: 0,
    result: 'H',
    resultVerified: true,
    totalGoals: 1,
    ...overrides,
  };
}

function makeOddsRow(overrides: Partial<MarketOddsRecord> = {}): MarketOddsRecord {
  return {
    oddsId: `odds-${Math.random().toString(36).slice(2)}`,
    canonicalId: 'ENG-PL|2024-2025|2024-08-01|home-fc|away-fc',
    leagueId: 'ENG-PL',
    cluster: 'A',
    season: '2024-2025',
    matchDate: '2024-08-01',
    market: 'AH',
    observation: 'opening',
    bookmakerSource: 'pinnacle',
    line: -0.5,
    homeOdds: 1.95,
    drawOdds: null,
    awayOdds: 1.95,
    overOdds: null,
    underOdds: null,
    sourceFile: '',
    sourceRow: 2,
    datasetVersion: 'europe-dataset-v1',
    ingestionVersion: 'europe-odds-v1',
    ...overrides,
  };
}

describe('Provenance resolution from real source headers', () => {
  let dir: string;
  let bbFile: string;
  let modernFile: string;
  let b365OnlyFile: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ah-yield-'));
    bbFile = path.join(dir, 'bb.csv');
    modernFile = path.join(dir, 'modern.csv');
    b365OnlyFile = path.join(dir, 'b365.csv');
    fs.writeFileSync(bbFile, 'Div,Date,HomeTeam,AwayTeam,BbAH,BbAHh,BbMxAHH,BbAvAHH,BbMxAHA,BbAvAHA\nE0,01/08/2024,A,B,1,-0.5,2.0,1.9,2.0,1.9\n');
    fs.writeFileSync(
      modernFile,
      'Div,Date,HomeTeam,AwayTeam,AHh,B365AHH,B365AHA,PAHH,PAHA,MaxAHH,MaxAHA,AHCh,B365CAHH,B365CAHA,PCAHH,PCAHA\n' +
        'E0,01/08/2024,A,B,-0.5,1.95,1.95,1.96,1.94,2.0,2.0,-0.75,1.98,1.92,1.99,1.91\n'
    );
    fs.writeFileSync(b365OnlyFile, 'Div,Date,HomeTeam,AwayTeam,AHh,B365AHH,B365AHA\nE0,01/08/2024,A,B,-0.5,1.95,1.95\n');
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('BetBrain-only layouts resolve the pinnacle-labeled rows to betbrain_avg, closing to unknown', () => {
    const resolver = createProvenanceResolver();
    expect(resolver.resolve(bbFile, 'opening', 'pinnacle')).toBe('betbrain_avg');
    expect(resolver.resolve(bbFile, 'opening', 'betbrain')).toBe('betbrain_avg');
    expect(resolver.resolve(bbFile, 'closing', 'pinnacle')).toBe('unknown');
    const layout = classifySourceLayout(bbFile);
    expect(layout.openBranch).toBe('betbrain_avg');
    expect(layout.closeBranch).toBe('none');
    expect(layout.hasBetbrain).toBe(true);
  });

  it('modern layouts resolve genuine pinnacle/bet365 rows and reject betbrain', () => {
    const resolver = createProvenanceResolver();
    expect(resolver.resolve(modernFile, 'opening', 'pinnacle')).toBe('pinnacle');
    expect(resolver.resolve(modernFile, 'closing', 'pinnacle')).toBe('pinnacle');
    expect(resolver.resolve(modernFile, 'opening', 'bet365')).toBe('bet365');
    expect(resolver.resolve(modernFile, 'closing', 'bet365')).toBe('bet365');
    expect(resolver.resolve(modernFile, 'opening', 'betbrain')).toBe('unknown');
  });

  it('bet365-only layouts resolve the pinnacle label to bet365 (honest re-attribution)', () => {
    const resolver = createProvenanceResolver();
    expect(resolver.resolve(b365OnlyFile, 'opening', 'pinnacle')).toBe('bet365');
    expect(resolver.resolve(b365OnlyFile, 'opening', 'bet365')).toBe('bet365');
  });

  it('unreadable files resolve to unknown (never guessed)', () => {
    const resolver = createProvenanceResolver();
    expect(resolver.resolve(path.join(dir, 'missing.csv'), 'opening', 'pinnacle')).toBe('unknown');
    const layout = classifySourceLayout(path.join(dir, 'missing.csv'));
    expect(layout.openBranch).toBe('none');
    expect(layout.hasB365Open).toBe(false);
  });

  it('BetBrain quotes are labeled single_quote, never opening/closing', () => {
    expect(snapshotFor('betbrain_avg', 'opening')).toBe('single_quote');
    expect(snapshotFor('pinnacle', 'opening')).toBe('opening');
    expect(snapshotFor('pinnacle', 'closing')).toBe('closing');
  });
});

describe('Observation builder — canonical join, validity, duplicates', () => {
  it('joins strictly by canonical_match_id, never by team names', () => {
    const match = makeMatch();
    const wrongId = makeOddsRow({ canonicalId: 'ENG-PL|2024-2025|2024-08-01|home-fc|other' });
    const rightId = makeOddsRow({ canonicalId: match.canonicalId });
    const result = buildAhObservations([match], [wrongId, rightId], { resolver: stubResolver });
    expect(result.unmatchedOddsRows).toBe(1);
    expect(result.rejected.some((r) => r.reason === 'UNMATCHED_CANONICAL_ID')).toBe(true);
    expect(new Set(result.observations.map((o) => o.canonicalMatchId))).toEqual(new Set([match.canonicalId]));
    expect(result.observations).toHaveLength(2); // home + away from the valid row
  });

  it('collapses duplicate quotes of the same observation (legacy mislabel case)', () => {
    const match = makeMatch();
    const a = makeOddsRow({ oddsId: 'a-row', bookmakerSource: 'betbrain' });
    const b = makeOddsRow({ oddsId: 'b-row', bookmakerSource: 'pinnacle' });
    const result = buildAhObservations([match], [a, b], { resolver: stubResolver });
    expect(result.duplicates).toBe(1);
    expect(result.observations).toHaveLength(2);
    // Deterministic winner: smallest odds_id survives.
    expect(result.observations[0].oddsId).toBe('a-row');
  });

  it('prefers the more complete quote when duplicates carry different validity', () => {
    const match = makeMatch();
    const incomplete = makeOddsRow({ oddsId: 'a-row', homeOdds: null, awayOdds: 1.95 });
    const complete = makeOddsRow({ oddsId: 'z-row', homeOdds: 1.9, awayOdds: 2.0 });
    const result = buildAhObservations([match], [incomplete, complete], { resolver: stubResolver });
    expect(result.observations).toHaveLength(2);
    expect(result.observations.every((o) => o.oddsId === 'z-row')).toBe(true);
  });

  it('rejects invalid odds, invalid lines, and invalid results with reasons', () => {
    const match = makeMatch();
    const rows = [
      makeOddsRow({ homeOdds: 1.0, awayOdds: 1.95 }),
      makeOddsRow({ homeOdds: -2, awayOdds: 1.95 }),
      makeOddsRow({ line: 0.1 }),
      makeOddsRow({ line: null }),
    ];
    const result = buildAhObservations([match], rows, { resolver: stubResolver });
    const reasons = result.rejected.map((r) => r.reason.split(':')[0]);
    expect(reasons).toContain('INVALID_HOME_ODDS');
    expect(reasons.filter((r) => r === 'INVALID_LINE').length).toBe(2);

    const badResult = buildAhObservations([makeMatch({ resultVerified: false })], [makeOddsRow()], { resolver: stubResolver });
    expect(badResult.rejected[0].reason).toBe('RESULT_NOT_VERIFIED');

    const badScore = buildAhObservations([makeMatch({ homeGoals: Number.NaN })], [makeOddsRow()], { resolver: stubResolver });
    expect(badScore.rejected[0].reason).toBe('INVALID_SCORE');
  });

  it('settles home and away sides independently with correct sign and P&L identity', () => {
    const match = makeMatch({ homeGoals: 1, awayGoals: 0 });
    const row = makeOddsRow({ line: -1, homeOdds: 1.8, awayOdds: 2.1 });
    const result = buildAhObservations([match], [row], { resolver: stubResolver });
    const home = result.observations.find((o) => o.side === 'home')!;
    const away = result.observations.find((o) => o.side === 'away')!;
    expect(home.selectionLine).toBe(-1);
    expect(away.selectionLine).toBe(1);
    expect(home.settlement).toBe('PUSH');
    expect(away.settlement).toBe('PUSH');
    expect(home.pnl).toBe(0);
    expect(away.pnl).toBe(0);
    for (const o of [home, away]) {
      const expected = o.settlementFraction > 0 ? o.settlementFraction * (o.odds - 1) : o.settlementFraction;
      expect(o.pnl).toBeCloseTo(expected, 6);
      expect(o.returnAmount).toBeCloseTo(1 + expected, 6);
    }
  });

  it('favorite/underdog comes from handicap and market context, not team strength', () => {
    const match = makeMatch();
    const rows = [
      makeOddsRow({ line: -0.75, homeOdds: 1.9, awayOdds: 1.9 }),
      makeOddsRow({ line: 0, homeOdds: 1.8, awayOdds: 2.05 }),
      makeOddsRow({ line: 0.25, homeOdds: 2.5, awayOdds: 1.55 }),
    ];
    const result = buildAhObservations([match], rows, { resolver: stubResolver });
    const homeFav = result.observations.find((o) => o.marketLineHome === -0.75 && o.side === 'home')!;
    const awayUnder = result.observations.find((o) => o.marketLineHome === -0.75 && o.side === 'away')!;
    expect(homeFav.favoriteStatus).toBe('favorite');
    expect(awayUnder.favoriteStatus).toBe('underdog');
    const levelHome = result.observations.find((o) => o.marketLineHome === 0 && o.side === 'home')!;
    const levelAway = result.observations.find((o) => o.marketLineHome === 0 && o.side === 'away')!;
    expect(levelHome.favoriteStatus).toBe('favorite');
    expect(levelAway.favoriteStatus).toBe('underdog');
    const weakHome = result.observations.find((o) => o.marketLineHome === 0.25 && o.side === 'home')!;
    expect(weakHome.favoriteStatus).toBe('underdog');
  });

  it('non-AH markets are ignored entirely', () => {
    const match = makeMatch();
    const result = buildAhObservations(
      [match],
      [makeOddsRow({ market: 'ML' }), makeOddsRow({ market: 'OU' })],
      { resolver: stubResolver }
    );
    expect(result.observations).toHaveLength(0);
    expect(result.rejected).toHaveLength(0);
  });
});

describe('Best-available cohort (derived, never mixed)', () => {
  function twoBookObservations() {
    const match = makeMatch({ canonicalId: 'M1' });
    const rows = [
      makeOddsRow({ oddsId: 'pin', canonicalId: 'M1', bookmakerSource: 'pinnacle', homeOdds: 1.9, awayOdds: 2.0 }),
      makeOddsRow({ oddsId: 'b365', canonicalId: 'M1', bookmakerSource: 'bet365', homeOdds: 1.95, awayOdds: 1.95 }),
      makeOddsRow({
        oddsId: 'pin-close',
        canonicalId: 'M1',
        bookmakerSource: 'pinnacle',
        observation: 'closing',
        homeOdds: 1.92,
        awayOdds: 1.98,
      }),
    ];
    return buildAhObservations([match], rows, { resolver: labelResolver }).observations;
  }

  it('picks the highest price per side and requires both books', () => {
    const obs = twoBookObservations();
    const best = buildBestAvailableObservations(obs);
    const homeOpen = best.find((o) => o.side === 'home' && o.snapshot === 'opening')!;
    const awayOpen = best.find((o) => o.side === 'away' && o.snapshot === 'opening')!;
    expect(homeOpen.odds).toBe(1.95); // bet365
    expect(homeOpen.provenance).toBe('best_available');
    expect(homeOpen.oppositeOdds).toBe(2.0); // best away (pinnacle)
    expect(awayOpen.odds).toBe(2.0);
    // closing has only Pinnacle → not eligible for a best-price cohort.
    expect(best.some((o) => o.snapshot === 'closing')).toBe(false);
  });

  it('settles the best price from scratch (P&L identity holds)', () => {
    const obs = twoBookObservations();
    const best = buildBestAvailableObservations(obs);
    for (const o of best) {
      const expected = o.settlementFraction > 0 ? o.settlementFraction * (o.odds - 1) : o.settlementFraction;
      expect(o.pnl).toBeCloseTo(expected, 6);
      expect(o.returnAmount).toBeCloseTo(1 + expected, 6);
      expect(o.observationId.endsWith('-best')).toBe(true);
    }
  });

  it('a single-book group never produces a best-available observation', () => {
    const match = makeMatch({ canonicalId: 'M2' });
    const onlyPinnacle = buildAhObservations(
      [match],
      [makeOddsRow({ oddsId: 'p', canonicalId: 'M2', bookmakerSource: 'pinnacle' })],
      { resolver: labelResolver }
    ).observations;
    expect(buildBestAvailableObservations(onlyPinnacle)).toHaveLength(0);
  });
});
