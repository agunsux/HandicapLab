import { describe, it, expect } from 'vitest';
import { LEAGUE_REGISTRY, getLeagueConfigById } from '../src/lib/crons/leagueRegistry';
import { EdgeScanner } from '../src/lib/engines/edge-scanner';
import { ProbabilityEngine } from '../src/lib/engines/probability-engine';
import { UncertaintyEngine } from '../src/lib/engines/probability-engine/uncertainty';
import { MatchFeatures } from '../src/lib/engines/feature-engine/types';
import { ProbabilityOutput } from '../src/lib/engines/probability-engine/types';

describe('Core League Configuration & Rules', () => {
  describe('League Registry Configuration', () => {
    it('should have 6 active enabled Tier 1 competitions', () => {
      const activeIds = ['eng_premier_league', 'uefa_champions_league', 'esp_la_liga', 'ita_serie_a', 'ger_bundesliga', 'fra_ligue_1'];
      for (const id of activeIds) {
        const config = getLeagueConfigById(id);
        expect(config).toBeDefined();
        expect(config?.enabled).toBe(true);
        expect(config?.status).toBe('ACTIVE');
      }
    });

    it('should correctly configure Ligue 2 as DISABLED', () => {
      const config = getLeagueConfigById('fra_ligue_2');
      expect(config).toBeDefined();
      expect(config?.enabled).toBe(false);
      expect(config?.status).toBe('DISABLED');
    });
  });

  describe('EdgeScanner Market Suitability Check', () => {
    const mockModelOutput = (leagueId: string, marketType: 'ML' | 'AH' | 'OU'): ProbabilityOutput => ({
      matchId: 'match-123',
      marketType,
      leagueId,
      pHome: 0.60,
      pDraw: 0.25,
      pAway: 0.15,
      pOver: { '2.5': 0.55 },
      pUnder: { '2.5': 0.45 },
      pAhHome: { '-0.5': 0.60 },
      pAhAway: { '-0.5': 0.40 },
      modelVersion: {
        name: 'test',
        algo: 'test',
        features: 'test',
        trainedAt: new Date(),
        trainedOnMatches: 100
      },
      calibrationApplied: false
    });

    const marketOdds = {
      homeOdds: 2.50, // high odds to create positive EV
      awayOdds: 2.50,
      drawOdds: 4.00,
      line: 2.5
    };

    it('allows scanning suitable markets for EPL', () => {
      // EPL supports AH, OU, ML
      const picksML = EdgeScanner.scan('match-123', 'ML', mockModelOutput('eng_premier_league', 'ML'), marketOdds);
      expect(picksML.length).toBeGreaterThan(0);

      const picksOU = EdgeScanner.scan('match-123', 'OU', mockModelOutput('eng_premier_league', 'OU'), marketOdds);
      expect(picksOU.length).toBeGreaterThan(0);
    });

    it('filters out unsuitable markets for Ligue 2', () => {
      // Ligue 2 does NOT support AH or OU (marketSuitability.AH === false, OU === false)
      const picksAH = EdgeScanner.scan('match-123', 'AH', mockModelOutput('fra_ligue_2', 'AH'), { ...marketOdds, line: -0.5 });
      expect(picksAH).toEqual([]);

      const picksOU = EdgeScanner.scan('match-123', 'OU', mockModelOutput('fra_ligue_2', 'OU'), marketOdds);
      expect(picksOU).toEqual([]);

      // Ligue 2 DOES support ML
      const picksML = EdgeScanner.scan('match-123', 'ML', mockModelOutput('fra_ligue_2', 'ML'), marketOdds);
      expect(picksML.length).toBeGreaterThan(0);
    });
  });

  describe('UncertaintyEngine Historical Matches Check', () => {
    const baseFeatures: MatchFeatures = {
      matchId: 'match-123',
      marketType: 'ML',
      kickoffAt: new Date(),
      homeFormLast5: [3, 1, 3, 0, 3],
      awayFormLast5: [1, 1, 0, 3, 0],
      homeFormWeighted: 1.8,
      awayFormWeighted: 1.2,
      homeRestDays: 5,
      awayRestDays: 4,
      homeTravelKm: 100,
      homeElo: 1550,
      awayElo: 1450,
      eloDelta: 100,
      homeAttack: 1.2,
      homeDefense: 0.9,
      awayAttack: 1.0,
      awayDefense: 1.1,
      leagueAvgGoals: 2.5,
      isHomeAdvantage: true,
      leagueId: 'eng_premier_league', // minHistoricalMatches: 10
      season: '2026',
      generatedAt: new Date()
    };

    it('does not penalize confidence if sufficient historical matches are present', () => {
      const features = { ...baseFeatures, historicalMatchesCount: 15 };
      const conf = UncertaintyEngine.calculate(features, [0.55, 0.25, 0.20], [0.52, 0.27, 0.21]);
      
      expect(conf.finalConfidence).toBeGreaterThan(0.6);
    });

    it('penalizes confidence score if historical matches are insufficient', () => {
      const featuresFull = { ...baseFeatures, historicalMatchesCount: 10 };
      const featuresLow = { ...baseFeatures, historicalMatchesCount: 3 }; // 3/10 = 0.3 completeness

      const confFull = UncertaintyEngine.calculate(featuresFull, [0.55, 0.25, 0.20], [0.52, 0.27, 0.21]);
      const confLow = UncertaintyEngine.calculate(featuresLow, [0.55, 0.25, 0.20], [0.52, 0.27, 0.21]);

      expect(confLow.finalConfidence).toBeLessThan(confFull.finalConfidence);
      expect(confLow.finalConfidence).toBeCloseTo(confFull.finalConfidence * 0.3, 2);
    });
  });
});
