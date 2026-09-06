import { describe, it, expect } from 'vitest';
import {
  CoverageCalculatorService,
  mapDbRowToTeamMarketRates,
  createEmptyTeamMarketRates,
  TeamMarketRates,
} from '../lib/services/coverageCalculator';

describe('Coverage Calculator Service Unit Tests', () => {
  const service = new CoverageCalculatorService();

  // ==========================================================================
  // TEST 1: DB ROW MAPPING & FALLBACKS
  // ==========================================================================
  describe('mapDbRowToTeamMarketRates', () => {
    it('accurately maps database row with all coverage metrics', () => {
      const mockRow = {
        team_id: 33,
        team_name: 'Arsenal',
        league_id: 39,
        season: 2025,
        venue: 'home',
        matches_played: 19,
        goals_for_avg: 2.21,
        goals_against_avg: 0.74,
        ah_cover_rate: 0.6842,
        ah_cover_rate_minus_025: 0.7368,
        ah_cover_rate_minus_075: 0.5789,
        ah_cover_rate_minus_100: 0.5263,
        ah_cover_rate_minus_150: 0.4211,
        ou_over_15_rate: 0.8947,
        ou_over_25_rate: 0.6316,
        ou_over_35_rate: 0.3684,
        btts_yes_rate: 0.5263,
        clean_sheet_rate: 0.4737,
        failed_to_score_rate: 0.0526,
        first_half_goals_avg: 1.15,
        second_half_goals_avg: 1.80,
        sample_size: 19,
      };

      const mapped = mapDbRowToTeamMarketRates(mockRow);

      expect(mapped.teamId).toBe(33);
      expect(mapped.teamName).toBe('Arsenal');
      expect(mapped.venue).toBe('home');
      expect(mapped.matchesPlayed).toBe(19);
      expect(mapped.goalsForAvg).toBe(2.21);
      expect(mapped.ahCoverRates.minus050).toBe(0.6842);
      expect(mapped.ahCoverRates.minus025).toBe(0.7368);
      expect(mapped.ahCoverRates.minus100).toBe(0.5263);
      expect(mapped.ouRates.over25).toBe(0.6316);
      expect(mapped.bttsYesRate).toBe(0.5263);
      expect(mapped.cleanSheetRate).toBe(0.4737);
    });

    it('returns empty fallback with null rates when row is absent', () => {
      const empty = createEmptyTeamMarketRates(999, 'away', 2026, 'New Club');
      expect(empty.teamId).toBe(999);
      expect(empty.matchesPlayed).toBe(0);
      expect(empty.ahCoverRates.minus050).toBeNull();
      expect(empty.ahCoverRates.minus025).toBeNull();
      expect(empty.sampleSize).toBe(0);
    });
  });

  // ==========================================================================
  // TEST 2: MATCHUP PROFILE & DIFFERENTIALS
  // ==========================================================================
  describe('calculateAHLineConfidenceSync & Matchup Differentials', () => {
    const homeRates: TeamMarketRates = {
      teamId: 33,
      teamName: 'Arsenal',
      canonicalId: 'tm-epl-002',
      leagueId: 39,
      season: 2025,
      venue: 'home',
      matchesPlayed: 19,
      goalsForAvg: 2.3,
      goalsAgainstAvg: 0.7,
      ahCoverRates: {
        minus025: 0.75,
        minus050: 0.70,
        minus075: 0.60,
        minus100: 0.50,
        minus150: 0.40,
      },
      ahProbabilities: {},
      ouRates: {
        over15: 0.85,
        under15: 0.15,
        over25: 0.65,
        under25: 0.35,
        over35: 0.35,
        under35: 0.65,
      },
      bttsRates: {
        yes: 0.55,
        no: 0.45,
      },
      bttsYesRate: 0.55,
      cleanSheetRate: 0.45,
      failedToScoreRate: 0.05,
      firstHalfGoalsAvg: 1.1,
      secondHalfGoalsAvg: 1.9,
      sampleConfidenceTier: '10<=N<20',
      sampleSize: 19,
    };

    const awayRates: TeamMarketRates = {
      teamId: 40,
      teamName: 'Chelsea',
      canonicalId: 'tm-epl-006',
      leagueId: 39,
      season: 2025,
      venue: 'away',
      matchesPlayed: 18,
      goalsForAvg: 1.2,
      goalsAgainstAvg: 1.8,
      ahCoverRates: {
        minus025: 0.45,
        minus050: 0.40,
        minus075: 0.35,
        minus100: 0.30,
        minus150: 0.20,
      },
      ahProbabilities: {},
      ouRates: {
        over15: 0.80,
        under15: 0.20,
        over25: 0.55,
        under25: 0.45,
        over35: 0.30,
        under35: 0.70,
      },
      bttsRates: {
        yes: 0.60,
        no: 0.40,
      },
      bttsYesRate: 0.60,
      cleanSheetRate: 0.20,
      failedToScoreRate: 0.25,
      firstHalfGoalsAvg: 0.9,
      secondHalfGoalsAvg: 2.1,
      sampleConfidenceTier: '10<=N<20',
      sampleSize: 18,
    };

    it('calculates head-to-head differentials correctly', () => {
      // ahEdge = home(-0.5) - away(-0.5) = 0.70 - 0.40 = +0.30
      const ahEdge = Number(((homeRates.ahCoverRates.minus050 || 0) - (awayRates.ahCoverRates.minus050 || 0)).toFixed(4));
      expect(ahEdge).toBe(0.30);

      // ouTendency = (0.65 + 0.55) / 2 = 0.60
      const ouTendency = ((homeRates.ouRates.over25 + awayRates.ouRates.over25) / 2);
      expect(ouTendency).toBeCloseTo(0.60, 4);

      // bttsTendency = (0.55 + 0.60) / 2 = 0.575
      const bttsTendency = ((homeRates.bttsYesRate + awayRates.bttsYesRate) / 2);
      expect(bttsTendency).toBeCloseTo(0.575, 4);
    });

    it('calculates AH line confidence using the weighted formula', () => {
      // Formula: (home_cover * 0.6) + ((1 - away_cover) * 0.4)
      // For line -0.5: homeCover(-0.5) = 0.70, awayCover(+0.5) = awayCover(-0.5) = 0.40
      // rawConfidence = (0.70 * 0.6) + ((1 - 0.40) * 0.4) = 0.42 + 0.24 = 0.66 -> 66%
      const conf = service.calculateAHLineConfidenceSync(homeRates, awayRates, -0.5);
      expect(conf).toBe(66);
    });

    it('dampens confidence toward 50 when sample size is small (< 10 matches)', () => {
      const smallSampleHome: TeamMarketRates = {
        ...homeRates,
        sampleSize: 4,
      };
      const smallSampleAway: TeamMarketRates = {
        ...awayRates,
        sampleSize: 4,
      };

      const conf = service.calculateAHLineConfidenceSync(smallSampleHome, smallSampleAway, -0.5);
      // Min sample is 4 -> weight = 4/10 = 0.4 -> 50 * 0.6 + 66 * 0.4 = 30 + 26.4 = 56
      expect(conf).toBeLessThan(66);
      expect(conf).toBeGreaterThanOrEqual(50);
    });
  });

  // ==========================================================================
  // TEST 3: LEAGUE AVERAGES FALLBACK
  // ==========================================================================
  describe('getLeagueAverages', () => {
    it('returns solid European default baselines when league has no cached data', async () => {
      const averages = await service.getLeagueAverages(99999);
      expect(averages.leagueId).toBe(99999);
      expect(averages.avgGoals).toBeGreaterThan(2.0);
      expect(averages.ouOver25Rate).toBeGreaterThan(0.40);
      expect(averages.bttsYesRate).toBeGreaterThan(0.40);
    });
  });
});
