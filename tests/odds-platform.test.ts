// Test Suite for Production Odds Data Platform
// Location: tests/odds-platform.test.ts

import { describe, it, expect } from 'vitest';
import { TeamNormalizer } from '../src/lib/data/teamNormalizer';
import { FixtureMatcher, MatchEntity } from '../src/lib/data/fixtureMatcher';
import { OddsNormalizer } from '../src/lib/data/oddsNormalizer';

describe('Odds Data Platform - Ingestion & Normalization Layer', () => {

  describe('TeamNormalizer', () => {
    it('should normalize common team name variations to their canonical forms', () => {
      expect(TeamNormalizer.normalize('Man United')).toBe('Manchester United');
      expect(TeamNormalizer.normalize('man utd')).toBe('Manchester United');
      expect(TeamNormalizer.normalize('Manchester Utd')).toBe('Manchester United');
      
      expect(TeamNormalizer.normalize('Man City')).toBe('Manchester City');
      expect(TeamNormalizer.normalize('manchester city fc')).toBe('Manchester City');
      
      expect(TeamNormalizer.normalize('spurs')).toBe('Tottenham Hotspur');
      expect(TeamNormalizer.normalize('Tottenham Hotspur FC')).toBe('Tottenham Hotspur');
      
      expect(TeamNormalizer.normalize('Arsenal FC')).toBe('Arsenal');
    });

    it('should correctly determine equivalent team names', () => {
      expect(TeamNormalizer.areEquivalent('Man United', 'manchester united')).toBe(true);
      expect(TeamNormalizer.areEquivalent('Man City', 'Manc City')).toBe(true);
      expect(TeamNormalizer.areEquivalent('Chelsea FC', 'chelsea')).toBe(true);
      expect(TeamNormalizer.areEquivalent('Arsenal', 'Spurs')).toBe(false);
    });
  });

  describe('FixtureMatcher', () => {
    const mockFixtures: MatchEntity[] = [
      {
        id: '1',
        home_team: 'Manchester United',
        away_team: 'Fulham',
        kickoff: '2024-08-16T19:00:00Z',
        league: 'Premier League'
      },
      {
        id: '2',
        home_team: 'Ipswich Town',
        away_team: 'Liverpool',
        kickoff: '2024-08-17T11:30:00Z',
        league: 'Premier League'
      }
    ];

    it('should match directly by fixture ID if matches exists', () => {
      const match = FixtureMatcher.findMatch(mockFixtures, {
        fixtureId: '1',
        homeTeam: 'Man United',
        awayTeam: 'Fulham',
        kickoff: '2024-08-16T19:00:00Z'
      });
      expect(match).not.toBeNull();
      expect(match?.id).toBe('1');
    });

    it('should match using teams and kickoff time window (within 24 hours)', () => {
      // 3 hours difference in kickoff, other names used
      const match = FixtureMatcher.findMatch(mockFixtures, {
        homeTeam: 'man utd',
        awayTeam: 'Fulham FC',
        kickoff: '2024-08-16T22:00:00Z'
      });
      expect(match).not.toBeNull();
      expect(match?.id).toBe('1');
    });

    it('should not match if kickoff time is outside the 24-hour window', () => {
      const match = FixtureMatcher.findMatch(mockFixtures, {
        homeTeam: 'man utd',
        awayTeam: 'Fulham FC',
        kickoff: '2024-08-18T22:00:00Z' // 2 days difference
      });
      expect(match).toBeNull();
    });

    it('should not match if team names do not match', () => {
      const match = FixtureMatcher.findMatch(mockFixtures, {
        homeTeam: 'man utd',
        awayTeam: 'Liverpool',
        kickoff: '2024-08-16T19:00:00Z'
      });
      expect(match).toBeNull();
    });
  });

  describe('OddsNormalizer', () => {
    it('should accurately calculate implied probability and overrounds for 3-way moneyline', () => {
      // ML: Home: 2.00, Draw: 3.40, Away: 3.80
      // Implied: 1/2.00 = 0.5, 1/3.40 = 0.294118, 1/3.80 = 0.263158
      // Sum = 1.057276 => Overround = ~5.73%
      const result = OddsNormalizer.normalize({ home: 2.00, draw: 3.40, away: 3.80 });

      expect(result.impliedProbabilities.home).toBeCloseTo(0.5, 4);
      expect(result.impliedProbabilities.draw).toBeCloseTo(0.294118, 4);
      expect(result.impliedProbabilities.away).toBeCloseTo(0.263158, 4);
      expect(result.overround).toBeCloseTo(0.057276, 4);
      expect(result.expectedMargin).toBeCloseTo(0.05417, 3);
    });

    it('should accurately normalize probabilities to sum to 100%', () => {
      const result = OddsNormalizer.normalize({ home: 1.85, away: 2.05 });
      const sumNormalized = Object.values(result.normalizedProbabilities).reduce((a, b) => a + b, 0);
      
      expect(sumNormalized).toBeCloseTo(1.0, 5);
      expect(result.overround).toBeGreaterThan(0.0);
    });
  });
});
