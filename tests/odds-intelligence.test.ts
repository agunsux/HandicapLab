import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MarginEngine } from '../src/lib/warehouse/oddsIntelligence/marginEngine';
import { ConsensusEngine } from '../src/lib/warehouse/oddsIntelligence/consensusEngine';
import { CLVEngine } from '../src/lib/warehouse/oddsIntelligence/clvEngine';
import { MovementEngine } from '../src/lib/warehouse/oddsIntelligence/movementEngine';
import { OddsSnapshot } from '../src/lib/warehouse/oddsIntelligence/types';

describe('Odds Intelligence Engine', () => {

  describe('MarginEngine', () => {
    it('should calculate overround correctly', () => {
      // 2.0, 2.0 implies 0.5 + 0.5 = 1.0 (no margin)
      expect(MarginEngine.calculateOverround([2.0, 2.0])).toBe(1.0);
      
      // 1.9, 1.9 implies ~0.526 + ~0.526 = 1.0526 (5.26% margin)
      expect(MarginEngine.calculateOverround([1.9, 1.9])).toBeCloseTo(1.0526, 4);
    });

    it('should calculate proportional fair probability', () => {
      const odds = [1.9, 1.9]; // overround = 1.0526
      // Proportional fair prob for 1.9 -> (1/1.9) / 1.0526 = 0.5
      expect(MarginEngine.calculateFairProbability(odds, 1.9, 'proportional')).toBeCloseTo(0.5, 4);
    });

    it('should calculate Shin true probability accurately', () => {
      const odds = [1.5, 4.0, 8.0]; 
      // 1/1.5 = 0.6667
      // 1/4.0 = 0.25
      // 1/8.0 = 0.125
      // Sum = 1.0417 (4.17% overround)
      const probFavorite = MarginEngine.calculateFairProbability(odds, 1.5, 'shin');
      const probUnderdog1 = MarginEngine.calculateFairProbability(odds, 4.0, 'shin');
      const probUnderdog2 = MarginEngine.calculateFairProbability(odds, 8.0, 'shin');
      
      // Sum of Shin probabilities should equal ~1.0
      expect(probFavorite + probUnderdog1 + probUnderdog2).toBeCloseTo(1.0, 2);
      // Shin gives favorite more probability than proportional usually
      expect(probFavorite).toBeGreaterThan(0.63);
    });
  });

  describe('ConsensusEngine', () => {
    it('should calculate market consensus correctly', () => {
      const snapshots: OddsSnapshot[] = [
        { fixture_id: '1', bookmaker_id: 'a', market_id: 'm1', selection: 'Home', decimal_odds: 2.0, timestamp: '2026-07-01T10:00:00Z', source_id: 's1' },
        { fixture_id: '1', bookmaker_id: 'b', market_id: 'm1', selection: 'Home', decimal_odds: 2.1, timestamp: '2026-07-01T10:00:00Z', source_id: 's2' },
        { fixture_id: '1', bookmaker_id: 'c', market_id: 'm1', selection: 'Home', decimal_odds: 1.95, timestamp: '2026-07-01T10:00:00Z', source_id: 's3' }
      ];

      const consensus = ConsensusEngine.calculateConsensus('1', 'm1', 'Home', '2026-07-01T10:00:00Z', snapshots);
      
      expect(consensus.bookmaker_count).toBe(3);
      expect(consensus.best_odds).toBe(2.1);
      expect(consensus.median_odds).toBe(2.0); // middle value of [1.95, 2.0, 2.1]
      expect(consensus.average_odds).toBeCloseTo(2.0167, 4); // (1.95 + 2.0 + 2.1) / 3
      expect(consensus.consensus_probability).toBe(0.5); // 1 / 2.0
    });
  });

  describe('CLVEngine', () => {
    it('should calculate Fractional CLV', () => {
      // Taken 2.20, Closes 2.00 -> +10% CLV
      expect(CLVEngine.calculateFractionalCLV(2.20, 2.00)).toBeCloseTo(0.10, 4);
      // Taken 1.90, Closes 2.00 -> -5% CLV
      expect(CLVEngine.calculateFractionalCLV(1.90, 2.00)).toBeCloseTo(-0.05, 4);
    });

    it('should calculate EV CLV', () => {
      // Taken 2.20, True Closes 50% (2.0)
      expect(CLVEngine.calculateExpectedValueCLV(2.20, 0.5)).toBeCloseTo(0.10, 4);
    });

    it('should calculate Log CLV', () => {
      // ln(2.20 / 2.00) = ln(1.1)
      expect(CLVEngine.calculateLogCLV(2.20, 2.00)).toBeCloseTo(Math.log(1.1), 4);
    });
  });

  describe('MovementEngine', () => {
    it('should calculate movement properties correctly', () => {
      const opening: OddsSnapshot = {
        fixture_id: '1', bookmaker_id: 'a', market_id: 'm1', selection: 'Home', decimal_odds: 2.50, timestamp: '2026-07-01T10:00:00Z'
      };
      
      const current: OddsSnapshot = {
        fixture_id: '1', bookmaker_id: 'a', market_id: 'm1', selection: 'Home', decimal_odds: 1.95, timestamp: '2026-07-01T11:00:00Z'
      }; // 1 hour later

      const movement = MovementEngine.calculateMovement(opening, current);
      
      // Percentage movement: (1.95 - 2.5) / 2.5 = -22%
      expect(movement.movement_percentage).toBe(-22);
      expect(movement.odds_drift).toBe(-0.55);
      
      // Steam velocity: dropped 22% in 1 hour -> 22 steam velocity
      expect(movement.steam_velocity).toBe(22);
      
      // Favourite flip: opening was 2.5 (underdog), current is 1.95 (favourite crossover threshold)
      expect(movement.favourite_flip).toBe(true);
    });
  });

});
