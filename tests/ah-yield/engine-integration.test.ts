// AH YIELD ENGINE — integration regression against the frozen real dataset.
// These numbers are deterministic properties of europe-dataset-v1 +
// market_odds.jsonl. A dataset refresh must intentionally update this test.

import { describe, it, expect } from 'vitest';
import { loadAhRawData } from '../../src/lib/research/ah-yield/ahLoader';
import { buildAhObservations } from '../../src/lib/research/ah-yield/ahObservations';
import { createProvenanceResolver } from '../../src/lib/research/ah-yield/ahProvenance';
import { computeAhYieldMetrics } from '../../src/lib/research/ah-yield/ahYield';
import { isValidHandicapLine } from '../../src/lib/research/ah-yield/ahSettlement';

const { matches, odds } = loadAhRawData();
const resolver = createProvenanceResolver();
const build = buildAhObservations(matches, odds, { resolver });
const matchIds = new Set(matches.map((m) => m.canonicalId));

describe('AH engine — frozen real-data integration', () => {
  it('joins every AH odds row to the canonical registry without team-name matching', () => {
    expect(matches.length).toBe(8898);
    expect(odds.filter((o) => o.market === 'AH').length).toBe(23864);
    expect(build.unmatchedOddsRows).toBe(0);
    for (const o of build.observations) {
      expect(matchIds.has(o.canonicalMatchId)).toBe(true);
    }
  });

  it('resolves provenance from source headers and collapses the legacy mislabel duplicates', () => {
    expect(build.duplicates).toBe(5858);
    expect(build.provenanceCounts).toEqual({ pinnacle: 6077, bet365: 6068, betbrain_avg: 5858 });
    expect(build.snapshotCounts).toEqual({ closing: 6079, opening: 6066, single_quote: 5858 });
  });

  it('produces exactly two directional observations per valid quote with valid settlement', () => {
    expect(build.observations.length).toBe(36006);
    for (const o of build.observations) {
      expect(isValidHandicapLine(o.marketLineHome)).toBe(true);
      expect(o.odds).toBeGreaterThan(1);
      expect(o.stake).toBe(1);
      const expected = o.settlementFraction > 0 ? o.settlementFraction * (o.odds - 1) : o.settlementFraction;
      expect(o.pnl).toBeCloseTo(expected, 6);
      expect(o.returnAmount).toBeCloseTo(1 + expected, 6);
    }
  });

  it('rejects only structurally invalid rows, with explicit reasons', () => {
    const reasons = build.rejected.map((r) => r.reason.split(':')[0]);
    expect(reasons.filter((r) => r === 'INVALID_LINE').length).toBe(1);
    expect(reasons.filter((r) => r === 'INVALID_HOME_ODDS').length).toBe(2);
    expect(reasons.filter((r) => r === 'INVALID_AWAY_ODDS').length).toBe(2);
  });

  it('headline cohort (genuine Pinnacle closing) matches frozen regression numbers', () => {
    const cohort = build.observations.filter((o) => o.provenance === 'pinnacle' && o.snapshot === 'closing');
    const m = computeAhYieldMetrics(cohort, { iterations: 200 });
    expect(m.evaluatedBets).toBe(6080);
    expect(m.totalStake).toBe(6080);
    expect(m.fullWins).toBe(2423);
    expect(m.halfWins).toBe(415);
    expect(m.pushes).toBe(404);
    expect(m.halfLosses).toBe(415);
    expect(m.fullLosses).toBe(2423);
    expect(m.totalPnl).toBeCloseTo(-103.975, 2);
    expect(m.yieldPct).toBeCloseTo(-1.7101, 3);
    expect(m.sampleSizeStatus).toBe('STRONG_SAMPLE');
    expect(Number.isFinite(m.roiCi95[0])).toBe(true);
    expect(m.roiCi95[0]).toBeLessThan(m.yieldPct / 100);
  });

  it('BetBrain consensus cohort is structurally symmetric across sides (same match, same line)', () => {
    const cohort = build.observations.filter((o) => o.provenance === 'betbrain_avg');
    const m = computeAhYieldMetrics(cohort, { iterations: 50 });
    expect(m.fullWins).toBe(m.fullLosses);
    expect(m.halfWins).toBe(m.halfLosses);
    expect(m.evaluatedBets).toBe(11716);
    expect(m.yieldPct).toBeLessThan(0); // consensus quotes carry a real bookmaker margin
  });
});
