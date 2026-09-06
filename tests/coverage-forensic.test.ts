import { describe, it, expect } from 'vitest';
import {
  calculateCoverageFromMatches,
  MatchRecord,
  getSampleConfidenceTier,
  createEmptyTeamMarketRates,
  LeagueMarketAverages,
} from '../src/lib/services/coverageCalculator';
import { canonicalEntityResolver } from '../src/lib/warehouse/entityResolver';
import { EXPANDED_CANONICAL_TEAMS } from '../src/lib/warehouse/canonicalTeamCatalog';
import { settleAsianHandicap } from '../src/historical/settlement/settlement';
import { ProbabilityEngine } from '../src/lib/engines/probability-engine';
import { MatchFeatures } from '../src/lib/engines/feature-engine/types';

describe('COVERAGE LAYER FORENSIC VALIDATION & AUDIT TEST SUITE', () => {

  // ==========================================================================
  // GATE 1: ZERO FUTURE-DATA LEAKAGE TEST
  // ==========================================================================
  describe('Gate 1: Zero Future-Data Leakage', () => {
    const historicalSequence: MatchRecord[] = [
      {
        home_team: 'Arsenal FC',
        away_team: 'Chelsea FC',
        home_goals: 2,
        away_goals: 0,
        match_time: '2026-01-10T15:00:00Z',
        season: 2026,
      },
      {
        home_team: 'Arsenal FC',
        away_team: 'Tottenham Hotspur FC',
        home_goals: 3,
        away_goals: 1,
        match_time: '2026-02-15T15:00:00Z',
        season: 2026,
      },
      {
        home_team: 'Arsenal FC',
        away_team: 'Manchester City FC',
        home_goals: 0,
        away_goals: 4,
        match_time: '2026-03-20T15:00:00Z', // Future match relative to Feb 20
        season: 2026,
      },
    ];

    it('strictly excludes future matches when asOfTimestamp is before match_time', () => {
      // Point-in-time: 2026-02-20T00:00:00Z (Match 3 on March 20 must NOT leak)
      const asOf = '2026-02-20T00:00:00Z';
      const ratesAsOfFeb = calculateCoverageFromMatches(historicalSequence, 'Arsenal FC', 'home', 2026, asOf);

      // Arsenal played 2 matches before Feb 20: 2-0 (W) and 3-1 (W)
      expect(ratesAsOfFeb.matchesPlayed).toBe(2);
      expect(ratesAsOfFeb.sampleSize).toBe(2);
      expect(ratesAsOfFeb.goalsForAvg).toBe(2.5); // (2 + 3) / 2
      expect(ratesAsOfFeb.goalsAgainstAvg).toBe(0.5); // (0 + 1) / 2

      // AH -0.50 should be 100% win (2 wins out of 2)
      expect(ratesAsOfFeb.ahCoverRates.minus050).toBe(1.0);
      expect(ratesAsOfFeb.ahProbabilities['-0.50'].pWin).toBe(1.0);
      expect(ratesAsOfFeb.cleanSheetRate).toBe(0.5); // 1 CS in 2 matches
    });

    it('includes future match only when asOfTimestamp is advanced past it', () => {
      // Advanced point-in-time: 2026-04-01T00:00:00Z (All 3 matches included)
      const asOfPostMatch3 = '2026-04-01T00:00:00Z';
      const ratesPostMatch3 = calculateCoverageFromMatches(historicalSequence, 'Arsenal FC', 'home', 2026, asOfPostMatch3);

      expect(ratesPostMatch3.matchesPlayed).toBe(3);
      expect(ratesPostMatch3.goalsForAvg).toBeCloseTo(5 / 3, 2); // (2 + 3 + 0) / 3 = 1.67
      expect(ratesPostMatch3.goalsAgainstAvg).toBeCloseTo(5 / 3, 2); // (0 + 1 + 4) / 3 = 1.67
      expect(ratesPostMatch3.ahCoverRates.minus050).toBeCloseTo(2 / 3, 2); // 2 wins out of 3
    });

    it('returns empty fallback with 0 matches when asOfTimestamp is prior to all matches', () => {
      const asOfPreSeason = '2026-01-01T00:00:00Z';
      const ratesPre = calculateCoverageFromMatches(historicalSequence, 'Arsenal FC', 'home', 2026, asOfPreSeason);
      expect(ratesPre.matchesPlayed).toBe(0);
      expect(ratesPre.sampleSize).toBe(0);
      expect(ratesPre.sampleConfidenceTier).toBe('N<5');
    });
  });

  // ==========================================================================
  // GATE 2: DUPLICATE MATCH ELIMINATION TEST
  // ==========================================================================
  describe('Gate 2: Duplicate Match Elimination', () => {
    it('ensures deduplication logic collapses identical matches into 1 observation', () => {
      // Simulating dual-source ingestion where same fixture exists twice
      const duplicateMatches: MatchRecord[] = [
        {
          home_team: 'Liverpool FC',
          away_team: 'Everton FC',
          home_goals: 2,
          away_goals: 0,
          match_time: '2026-02-14T12:30:00Z',
          season: 2026,
        },
        {
          home_team: 'Liverpool FC',
          away_team: 'Everton FC',
          home_goals: 2,
          away_goals: 0,
          match_time: '2026-02-14T12:30:00Z', // Exact duplicate from secondary provider
          season: 2026,
        },
      ];

      // Emulate deduplication via natural key (as done in canonical_finished_matches SQL view)
      const dedupMap = new Map<string, MatchRecord>();
      duplicateMatches.forEach((m) => {
        const key = `${m.home_team}|${m.away_team}|${new Date(m.match_time).toISOString().slice(0, 10)}`;
        if (!dedupMap.has(key)) {
          dedupMap.set(key, m);
        }
      });
      const deduplicated = Array.from(dedupMap.values());

      expect(deduplicated.length).toBe(1);
      const rates = calculateCoverageFromMatches(deduplicated, 'Liverpool FC', 'home', 2026);
      expect(rates.matchesPlayed).toBe(1);
      expect(rates.sampleSize).toBe(1);
      expect(rates.goalsForAvg).toBe(2);
    });
  });

  // ==========================================================================
  // GATE 3: CANONICAL TEAM IDENTITY & COVERAGE TEST
  // ==========================================================================
  describe('Gate 3: Canonical Team Identity & Mapping Coverage', () => {
    it('resolves 100% of historical European clubs without fallback to random hash', () => {
      // Verify all 152 canonical clubs in expanded catalog resolve to canonical IDs
      const audit = canonicalEntityResolver.getMappingAuditReport(
        'historical',
        EXPANDED_CANONICAL_TEAMS.map((t) => t.canonicalName)
      );

      expect(audit.totalTeams).toBe(EXPANDED_CANONICAL_TEAMS.length);
      expect(audit.canonicalTeams).toBe(EXPANDED_CANONICAL_TEAMS.length);
      expect(audit.unmappedTeams).toEqual([]);
      expect(audit.mappingCoveragePct).toBe(100.0);
    });

    it('resolves alternative spelling variations and provider aliases correctly', () => {
      const aliasTests = [
        { providerName: 'Man City', expectedId: 'tm-epl-001' },
        { providerName: 'Manchester City', expectedId: 'tm-epl-001' },
        { providerName: 'Inter Milan', expectedId: 'tm-seriea-001' },
        { providerName: 'FC Internazionale', expectedId: 'tm-seriea-001' },
        { providerName: 'Bayern Munich', expectedId: 'tm-bundesliga-001' },
        { providerName: 'FC Bayern Munchen', expectedId: 'tm-bundesliga-001' },
        { providerName: 'Paris Saint-Germain', expectedId: 'tm-ligue1-001' },
        { providerName: 'PSG', expectedId: 'tm-ligue1-001' },
        { providerName: 'Real Madrid', expectedId: 'tm-laliga-001' },
        { providerName: 'Ajax Amsterdam', expectedId: 'tm-eredivisie-001' },
      ];

      for (const test of aliasTests) {
        const resolved = canonicalEntityResolver.resolveTeamId('historical', test.providerName);
        expect(resolved).toBe(test.expectedId);
      }
    });

    it('does not produce ABS(HASHTEXT) pseudo-identities', () => {
      const resolved = canonicalEntityResolver.resolveTeamId('historical', 'Arsenal FC');
      expect(resolved).not.toMatch(/^\d+$/);
      expect(resolved).toBe('tm-epl-002');
    });
  });

  // ==========================================================================
  // GATE 4: EXHAUSTIVE ASIAN HANDICAP SETTLEMENT VALIDATION
  // ==========================================================================
  describe('Gate 4: Exhaustive Asian Handicap Settlement Logic', () => {
    // Goal differences: -3, -2, -1, 0, +1, +2, +3
    const testCases: {
      line: number;
      diff: number;
      expected: 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS';
    }[] = [
      // Line -0.25
      { line: -0.25, diff: +2, expected: 'WIN' },
      { line: -0.25, diff: +1, expected: 'WIN' },
      { line: -0.25, diff: 0, expected: 'HALF_LOSS' },
      { line: -0.25, diff: -1, expected: 'LOSS' },
      { line: -0.25, diff: -2, expected: 'LOSS' },

      // Line -0.50
      { line: -0.50, diff: +2, expected: 'WIN' },
      { line: -0.50, diff: +1, expected: 'WIN' },
      { line: -0.50, diff: 0, expected: 'LOSS' },
      { line: -0.50, diff: -1, expected: 'LOSS' },

      // Line -0.75
      { line: -0.75, diff: +3, expected: 'WIN' },
      { line: -0.75, diff: +2, expected: 'WIN' },
      { line: -0.75, diff: +1, expected: 'HALF_WIN' },
      { line: -0.75, diff: 0, expected: 'LOSS' },
      { line: -0.75, diff: -1, expected: 'LOSS' },

      // Line -1.00
      { line: -1.00, diff: +2, expected: 'WIN' },
      { line: -1.00, diff: +1, expected: 'PUSH' },
      { line: -1.00, diff: 0, expected: 'LOSS' },
      { line: -1.00, diff: -1, expected: 'LOSS' },

      // Line -1.50
      { line: -1.50, diff: +3, expected: 'WIN' },
      { line: -1.50, diff: +2, expected: 'WIN' },
      { line: -1.50, diff: +1, expected: 'LOSS' },
      { line: -1.50, diff: 0, expected: 'LOSS' },

      // Positive Lines (+0.25, +0.50, +0.75, +1.00, +1.50)
      { line: 0.25, diff: +1, expected: 'WIN' },
      { line: 0.25, diff: 0, expected: 'HALF_WIN' },
      { line: 0.25, diff: -1, expected: 'LOSS' },

      { line: 0.50, diff: 0, expected: 'WIN' },
      { line: 0.50, diff: -1, expected: 'LOSS' },

      { line: 0.75, diff: 0, expected: 'WIN' },
      { line: 0.75, diff: -1, expected: 'HALF_LOSS' },
      { line: 0.75, diff: -2, expected: 'LOSS' },

      { line: 1.00, diff: -1, expected: 'PUSH' },
      { line: 1.00, diff: 0, expected: 'WIN' },
      { line: 1.00, diff: -2, expected: 'LOSS' },

      { line: 1.50, diff: -1, expected: 'WIN' },
      { line: 1.50, diff: -2, expected: 'LOSS' },
    ];

    testCases.forEach(({ line, diff, expected }) => {
      it(`settles AH ${line > 0 ? '+' : ''}${line.toFixed(2)} with goal diff ${diff > 0 ? '+' : ''}${diff} as ${expected}`, () => {
        // diff = homeGoals - awayGoals (home selection)
        const homeGoals = diff >= 0 ? diff : 0;
        const awayGoals = diff < 0 ? Math.abs(diff) : 0;
        const result = settleAsianHandicap('home', line, homeGoals, awayGoals);
        expect(result).toBe(expected);
      });
    });

    it('separates outcome probabilities from expectations in calculateCoverageFromMatches', () => {
      // 4 matches with diffs: +2 (Win), +1 (1-0, push on -1.0, half win on -0.75), 0 (draw, half loss on -0.25), -1 (loss)
      const fourMatches: MatchRecord[] = [
        { home_team: 'Club A', away_team: 'Club B', home_goals: 2, away_goals: 0, match_time: '2026-01-01T00:00:00Z' },
        { home_team: 'Club A', away_team: 'Club C', home_goals: 1, away_goals: 0, match_time: '2026-01-02T00:00:00Z' },
        { home_team: 'Club A', away_team: 'Club D', home_goals: 1, away_goals: 1, match_time: '2026-01-03T00:00:00Z' },
        { home_team: 'Club A', away_team: 'Club E', home_goals: 0, away_goals: 1, match_time: '2026-01-04T00:00:00Z' },
      ];

      const rates = calculateCoverageFromMatches(fourMatches, 'Club A', 'home', 2026);

      // Verify line -1.00: 1 Win (+2), 1 Push (+1), 2 Losses (0, -1)
      const ah100 = rates.ahProbabilities['-1.00'];
      expect(ah100.pWin).toBe(0.25);
      expect(ah100.pPush).toBe(0.25);
      expect(ah100.pLoss).toBe(0.50);
      expect(ah100.pHalfWin).toBe(0);
      expect(ah100.pHalfLoss).toBe(0);
      // settlementExpectation = 0.25 * 1.0 + 0.25 * 0 - 0.50 * 1.0 = -0.25
      expect(ah100.settlementExpectation).toBe(-0.25);

      // Verify line -0.25: 2 Wins (+2, +1), 1 Half Loss (0-0 draw), 1 Loss (-1)
      const ah025 = rates.ahProbabilities['-0.25'];
      expect(ah025.pWin).toBe(0.50);
      expect(ah025.pHalfLoss).toBe(0.25);
      expect(ah025.pLoss).toBe(0.25);
      // settlementExpectation = 0.50 * 1.0 - 0.25 * 0.5 - 0.25 * 1.0 = 0.50 - 0.125 - 0.25 = 0.125
      expect(ah025.settlementExpectation).toBe(0.125);
      // coverRate = pWin + pHalfWin * 0.5 = 0.50
      expect(ah025.coverRate).toBe(0.50);

      // Verify line -0.75: 1 Win (+2), 1 Half Win (+1), 2 Losses (0, -1)
      const ah075 = rates.ahProbabilities['-0.75'];
      expect(ah075.pWin).toBe(0.25);
      expect(ah075.pHalfWin).toBe(0.25);
      expect(ah075.pLoss).toBe(0.50);
      // coverRate = 0.25 + 0.25 * 0.5 = 0.375
      expect(ah075.coverRate).toBe(0.375);
    });
  });

  // ==========================================================================
  // GATE 5: OU & BTTS MATHEMATICAL CONSISTENCY
  // ==========================================================================
  describe('Gate 5: OU and BTTS Complementary Consistency', () => {
    it('guarantees Over + Under = 1.0 and BTTS Yes + No = 1.0', () => {
      const sampleMatches: MatchRecord[] = [
        { home_team: 'Team X', away_team: 'Team Y', home_goals: 3, away_goals: 1, match_time: '2026-01-01T00:00:00Z' }, // 4 goals, BTTS yes
        { home_team: 'Team X', away_team: 'Team Z', home_goals: 1, away_goals: 0, match_time: '2026-01-02T00:00:00Z' }, // 1 goal, BTTS no
        { home_team: 'Team X', away_team: 'Team W', home_goals: 2, away_goals: 1, match_time: '2026-01-03T00:00:00Z' }, // 3 goals, BTTS yes
      ];

      const rates = calculateCoverageFromMatches(sampleMatches, 'Team X', 'home', 2026);

      // OU 1.5: 2 matches >= 2 goals -> 2/3 = 0.6667
      expect(rates.ouRates.over15 + rates.ouRates.under15).toBeCloseTo(1.0, 3);
      // OU 2.5: 2 matches >= 3 goals -> 2/3 = 0.6667
      expect(rates.ouRates.over25 + rates.ouRates.under25).toBeCloseTo(1.0, 3);
      // OU 3.5: 1 match >= 4 goals -> 1/3 = 0.3333
      expect(rates.ouRates.over35 + rates.ouRates.under35).toBeCloseTo(1.0, 3);

      // BTTS: 2 matches BTTS -> 2/3 = 0.6667
      expect(rates.bttsRates.yes + rates.bttsRates.no).toBeCloseTo(1.0, 3);
      expect(rates.bttsYesRate).toBe(rates.bttsRates.yes);
    });
  });

  // ==========================================================================
  // GATE 6: SAMPLE SIZE CONFIDENCE & BAYESIAN SHRINKAGE
  // ==========================================================================
  describe('Gate 6: Sample Size Confidence Tiers & Shrinkage', () => {
    it('assigns correct confidence tiers according to sample size thresholds', () => {
      expect(getSampleConfidenceTier(2)).toBe('N<5');
      expect(getSampleConfidenceTier(4)).toBe('N<5');
      expect(getSampleConfidenceTier(5)).toBe('5<=N<10');
      expect(getSampleConfidenceTier(9)).toBe('5<=N<10');
      expect(getSampleConfidenceTier(10)).toBe('10<=N<20');
      expect(getSampleConfidenceTier(19)).toBe('10<=N<20');
      expect(getSampleConfidenceTier(20)).toBe('N>=20');
      expect(getSampleConfidenceTier(49)).toBe('N>=20');
      expect(getSampleConfidenceTier(50)).toBe('N>=50');
    });

    it('shrinks small samples heavily toward league baseline while preserving large samples', () => {
      const baseline: LeagueMarketAverages = {
        leagueId: 39,
        season: 2026,
        avgGoals: 2.75,
        ouOver15Rate: 0.80,
        ouOver25Rate: 0.50,
        ouOver35Rate: 0.30,
        bttsYesRate: 0.50,
        homeWinRate: 0.45,
        sampleSize: 380,
      };

      // 2 matches with 100% BTTS (N = 2, extreme rate)
      const smallSampleMatches: MatchRecord[] = [
        { home_team: 'SmallClub', away_team: 'OppA', home_goals: 2, away_goals: 1, match_time: '2026-01-01T00:00:00Z' },
        { home_team: 'SmallClub', away_team: 'OppB', home_goals: 1, away_goals: 2, match_time: '2026-01-02T00:00:00Z' },
      ];

      const ratesSmall = calculateCoverageFromMatches(smallSampleMatches, 'SmallClub', 'home', 2026, undefined, baseline);
      expect(ratesSmall.sampleConfidenceTier).toBe('N<5');
      expect(ratesSmall.bttsYesRate).toBe(1.0); // Raw rate is 100%

      // Shrunk rate: weight = 2 / (2 + 10) = 0.1667. Shrunk = 0.1667 * 1.0 + 0.8333 * 0.50 = 0.5833
      expect(ratesSmall.shrunk).toBeDefined();
      expect(ratesSmall.shrunk!.bttsYesRate).toBeCloseTo(0.5833, 2);
      expect(ratesSmall.shrunk!.bttsYesRate).toBeLessThan(0.70); // Heavily pulled to 0.50

      // Large sample (N = 30) with 70% BTTS
      const largeSampleMatches: MatchRecord[] = [];
      for (let i = 0; i < 30; i++) {
        largeSampleMatches.push({
          home_team: 'BigClub',
          away_team: `Opp${i}`,
          home_goals: i < 21 ? 1 : 2, // 21 out of 30 both score
          away_goals: i < 21 ? 1 : 0,
          match_time: `2026-01-${(i % 28 + 1).toString().padStart(2, '0')}T00:00:00Z`,
        });
      }

      const ratesLarge = calculateCoverageFromMatches(largeSampleMatches, 'BigClub', 'home', 2026, undefined, baseline);
      expect(ratesLarge.sampleConfidenceTier).toBe('N>=20');
      expect(ratesLarge.bttsYesRate).toBe(0.70);

      // Shrunk rate: weight = 30 / (30 + 10) = 0.75. Shrunk = 0.75 * 0.70 + 0.25 * 0.50 = 0.65
      expect(ratesLarge.shrunk!.bttsYesRate).toBeCloseTo(0.65, 2);
    });
  });

  // ==========================================================================
  // GATE 7: PROBABILITY ENGINE BASELINE INVARIANCE TEST
  // ==========================================================================
  describe('Gate 7: ProbabilityEngine Baseline Output Invariance', () => {
    const mockFeatures: MatchFeatures = {
      matchId: 'fixture-test-001',
      homeTeam: 'Arsenal FC',
      awayTeam: 'Chelsea FC',
      leagueId: 'EPL',
      marketType: 'ML',
      homeAttack: 1.75,
      homeDefense: 0.85,
      awayAttack: 1.40,
      awayDefense: 1.10,
      homeRestDays: 7,
      awayRestDays: 7,
      homeTravelKm: 0,
      awayTravelKm: 15,
      competitionType: 'club',
    };

    it('produces bit-exact identical predictions when coverageEnabled is omitted vs false', async () => {
      const predDefault = await ProbabilityEngine.predict(mockFeatures);
      const predExplicitFalse = await ProbabilityEngine.predict(mockFeatures, { coverageEnabled: false });

      expect(predDefault.pHome).toBe(predExplicitFalse.pHome);
      expect(predDefault.pDraw).toBe(predExplicitFalse.pDraw);
      expect(predDefault.pAway).toBe(predExplicitFalse.pAway);
      expect(predDefault.expectedGoals).toBe(predExplicitFalse.expectedGoals);
      expect(predDefault.pOver).toEqual(predExplicitFalse.pOver);
      expect(predDefault.pUnder).toEqual(predExplicitFalse.pUnder);
      expect(predDefault.pAhHome).toEqual(predExplicitFalse.pAhHome);
      expect(predDefault.pAhAway).toEqual(predExplicitFalse.pAhAway);
      expect(predDefault.pBttsYes).toBe(predExplicitFalse.pBttsYes);
      expect(predDefault.pBttsNo).toBe(predExplicitFalse.pBttsNo);
      expect(predDefault.coverageProfile).toBeUndefined();
      expect(predDefault.coverageValidation).toBeUndefined();
    });

    it('does not mutate original MatchFeatures input object', async () => {
      const originalCopy = JSON.parse(JSON.stringify(mockFeatures));
      await ProbabilityEngine.predict(mockFeatures, { coverageEnabled: false });
      expect(mockFeatures).toEqual(originalCopy);
    });
  });
});
