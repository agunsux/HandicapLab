import { describe, it, expect } from 'vitest';
import {
  breakdownAhMetrics,
  buildAhValueRows,
  filterAhObservations,
} from '../../src/lib/research/ah-yield/ahAggregation';
import { makeObs } from './helpers';

describe('Aggregation — grouping, filtering, traceability', () => {
  it('groups by line/side/snapshot/provenance and separates directions', () => {
    const obs = [
      makeObs({ marketLineHome: -0.5, side: 'home', homeScore: 1, awayScore: 0 }),
      makeObs({ marketLineHome: -0.5, side: 'home', homeScore: 0, awayScore: 0 }),
      makeObs({ marketLineHome: -0.5, side: 'away', homeScore: 0, awayScore: 0 }),
      makeObs({ marketLineHome: -0.75, side: 'home', homeScore: 1, awayScore: 0 }),
    ];
    const rows = buildAhValueRows(obs, { iterations: 10 });
    const homeHalf = rows.find((r) => r.line === -0.5 && r.side === 'home')!;
    const awayHalf = rows.find((r) => r.line === -0.5 && r.side === 'away')!;
    expect(homeHalf.evaluatedBets).toBe(2);
    expect(awayHalf.evaluatedBets).toBe(1);
    expect(rows).toHaveLength(3);
  });

  it('filters by snapshot, provenance, league, side, line, date range', () => {
    const obs = [
      makeObs({ snapshot: 'closing', provenance: 'pinnacle', leagueId: 'ENG-PL', matchDate: '2024-01-05', side: 'home' }),
      makeObs({ snapshot: 'opening', provenance: 'pinnacle', leagueId: 'ENG-PL', matchDate: '2024-01-06', side: 'away' }),
      makeObs({ snapshot: 'single_quote', provenance: 'betbrain_avg', leagueId: 'ESP-LALIGA', matchDate: '2024-01-07', side: 'away' }),
    ];
    expect(filterAhObservations(obs, { snapshot: 'closing' })).toHaveLength(1);
    expect(filterAhObservations(obs, { provenance: 'betbrain_avg' })).toHaveLength(1);
    expect(filterAhObservations(obs, { leagueId: 'ENG-PL' })).toHaveLength(2);
    expect(filterAhObservations(obs, { dateFrom: '2024-01-06' })).toHaveLength(2);
    expect(filterAhObservations(obs, { dateTo: '2024-01-06' })).toHaveLength(2);
    expect(filterAhObservations(obs, { side: 'away' })).toHaveLength(2);
  });

  it('every value-row aggregate is traceable back to its observations', () => {
    const group = [
      makeObs({ marketLineHome: -0.5, side: 'home', homeScore: 1, awayScore: 0, odds: 1.9 }),
      makeObs({ marketLineHome: -0.5, side: 'home', homeScore: 0, awayScore: 1, odds: 2.1 }),
      makeObs({ marketLineHome: -0.5, side: 'home', homeScore: 1, awayScore: 1, odds: 2.0 }), // full loss
    ];
    const rows = buildAhValueRows(group, { iterations: 10 });
    const row = rows[0];
    const stake = group.reduce((s, o) => s + o.stake, 0);
    const pnl = group.reduce((s, o) => s + o.pnl, 0);
    expect(row.evaluatedBets).toBe(group.length);
    expect(row.totalStake).toBeCloseTo(stake, 6);
    expect(row.totalPnl).toBeCloseTo(pnl, 6);
    expect(row.yieldPct).toBeCloseTo((pnl / stake) * 100, 4);
    expect(row.leagueCount).toBe(1);
    expect(row.matchCount).toBe(new Set(group.map((o) => o.canonicalMatchId)).size);
  });

  it('sample-size protection marks tiny groups and never marks them eligible', () => {
    const tiny = Array.from({ length: 11 }, () => makeObs({ marketLineHome: -2.5, side: 'home' }));
    const rows = buildAhValueRows(tiny, { iterations: 10 });
    expect(rows[0].sampleSizeStatus).toBe('INSUFFICIENT_SAMPLE');
    expect(rows[0].eligibleForBest).toBe(false);
    expect(rows[0].valueState).toBe('INSUFFICIENT_DATA');
  });

  it('value state separates a strong positive sample from a negative one', () => {
    const winners = Array.from({ length: 120 }, (_, i) =>
      makeObs({ marketLineHome: -0.5, side: 'home', homeScore: i % 4 === 0 ? 0 : 1, awayScore: i % 4 === 0 ? 1 : 0, odds: 2.1 })
    );
    const losers = Array.from({ length: 120 }, (_, i) =>
      makeObs({ marketLineHome: -0.5, side: 'home', homeScore: i % 4 === 0 ? 1 : 0, awayScore: i % 4 === 0 ? 0 : 1, odds: 1.8 })
    );
    const positive = buildAhValueRows(winners, { iterations: 100 })[0];
    const negative = buildAhValueRows(losers, { iterations: 100 })[0];
    expect(positive.evaluatedBets).toBe(120);
    expect(positive.valueState).toBe('POSITIVE_VALUE');
    expect(negative.valueState).toBe('NEGATIVE_VALUE');
  });

  it('breakdowns by dimension produce per-group traceable metrics', () => {
    const obs = [
      makeObs({ leagueId: 'ENG-PL', season: '2023-2024' }),
      makeObs({ leagueId: 'ENG-PL', season: '2024-2025' }),
      makeObs({ leagueId: 'ESP-LALIGA', season: '2024-2025' }),
    ];
    const byLeague = breakdownAhMetrics(obs, 'league', { iterations: 10 });
    const bySeason = breakdownAhMetrics(obs, 'season', { iterations: 10 });
    expect(byLeague.find((r) => r.key === 'ENG-PL')?.evaluatedBets).toBe(2);
    expect(byLeague.find((r) => r.key === 'ESP-LALIGA')?.evaluatedBets).toBe(1);
    expect(bySeason.find((r) => r.key === '2024-2025')?.evaluatedBets).toBe(2);
    expect(byLeague.reduce((s, r) => s + r.evaluatedBets, 0)).toBe(obs.length);
  });
});
