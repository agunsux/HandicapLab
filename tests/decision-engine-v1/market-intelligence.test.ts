// HandicapLab Market Intelligence - Unit & Integration Test Suite
// Location: tests/decision-engine-v1/market-intelligence.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { CLVEngine } from '../../src/lib/market/clvEngine';
import { VolatilityEngine } from '../../src/lib/market/volatilityEngine';
import { EfficiencyMetrics } from '../../src/lib/market/efficiencyMetrics';
import { SteamMoveDetector } from '../../src/lib/market/steamDetector';
import { MarketDataValidator } from '../../src/lib/market/dataValidator';
import { MarketLogRepository } from '../../src/lib/data/marketLogRepository';
import { MockMarketDataProvider } from '../../src/lib/market/mockProvider';
import { DatasetExporter, ResearchRecord } from '../../src/lib/market/datasetExporter';
import { OddsMovementEvent, OddsSnapshot } from '../../src/lib/market/providerInterface';
import path from 'path';
import fs from 'fs';

describe('Sprint 25: Market Intelligence Layer & CLV Engine Tests', () => {
  
  beforeEach(() => {
    MarketLogRepository.clear();
  });

  describe('CLV Calculation Correctness & Edge cases', () => {
    it('should calculate opening = closing correctly', () => {
      const res = CLVEngine.calculate(2.00, 2.00, 2.00, 0.025);
      expect(res.clvPercent).toBe(0.00);
      expect(res.clvDecimal).toBe(0.0000);
      expect(res.expectedEdge).toBeCloseTo((2.00 * (0.50 / 1.025)) - 1.0, 4);
    });

    it('should calculate opening > closing (value gained)', () => {
      const res = CLVEngine.calculate(2.00, 2.10, 1.90, 0.025);
      expect(res.clvPercent).toBeGreaterThan(0);
      expect(res.valueGained).toBeCloseTo((2.10 / 1.90) - 1.0, 4);
      expect(res.valueLost).toBe(0);
    });

    it('should calculate opening < closing (value lost)', () => {
      const res = CLVEngine.calculate(2.00, 1.90, 2.10, 0.025);
      expect(res.clvPercent).toBeLessThan(0);
      expect(res.valueLost).toBeCloseTo(Math.abs((1.90 / 2.10) - 1.0), 4);
      expect(res.valueGained).toBe(0);
    });
  });

  describe('Volatility & Efficiency Scoring', () => {
    it('should calculate volatility score and max swing properly', () => {
      const events: OddsMovementEvent[] = [
        {
          id: '1', eventType: 'OddsOpened', timestamp: new Date().toISOString(),
          bookmaker: 'Pinnacle', market: 'ML', selection: 'home',
          oldOdds: 2.10, newOdds: 2.10, impliedProbability: 0.476,
          movementMagnitude: 0, movementDirection: 'neutral'
        },
        {
          id: '2', eventType: 'OddsUpdated', timestamp: new Date().toISOString(),
          bookmaker: 'Pinnacle', market: 'ML', selection: 'home',
          oldOdds: 2.10, newOdds: 2.30, impliedProbability: 0.434,
          movementMagnitude: 0.20, movementDirection: 'up'
        }
      ];

      const vol = VolatilityEngine.calculate(events);
      expect(vol.movementFrequency).toBe(2);
      expect(vol.maxSwing).toBeCloseTo(0.20, 2);
      expect(vol.volatilityScore).toBeGreaterThan(0);
    });

    it('should evaluate consensus spread and price discovery speed', () => {
      const providerOdds: Record<string, OddsSnapshot> = {
        Pinnacle: { home: 1.95, draw: 3.40, away: 3.80 },
        Bet365: { home: 1.91, draw: 3.30, away: 3.70 }
      };

      const metrics = EfficiencyMetrics.evaluate(providerOdds);
      expect(metrics.consensusSpread).toBeCloseTo(0.04, 4);
      expect(metrics.liquidityProxy).toBe('High'); // Pinnacle is present
    });
  });

  describe('Steam Move & RLM Detection', () => {
    it('should detect sharp steam movements on Pinnacle', () => {
      const events: OddsMovementEvent[] = [
        {
          id: '1', eventType: 'OddsUpdated', timestamp: new Date().toISOString(),
          bookmaker: 'Pinnacle', market: 'ML', selection: 'home',
          oldOdds: 2.10, newOdds: 1.95, impliedProbability: 0.51,
          movementMagnitude: 0.15, // > steamThreshold (0.05)
          movementDirection: 'down'
        }
      ];

      const steam = SteamMoveDetector.detect(events, 'home', 2.10, 1.95);
      expect(steam.isSharpSteam).toBe(true);
      expect(steam.steamScore).toBeGreaterThanOrEqual(45);
    });

    it('should detect reverse line movements', () => {
      const events: OddsMovementEvent[] = [
        {
          id: '1', eventType: 'OddsUpdated', timestamp: new Date().toISOString(),
          bookmaker: 'Bet365', market: 'ML', selection: 'home',
          oldOdds: 2.10, newOdds: 2.05, impliedProbability: 0.48,
          movementMagnitude: 0.05, movementDirection: 'down'
        }
      ];

      // Prediction is 'home', odds drops from 2.10 to 1.95 (reverse move)
      const steam = SteamMoveDetector.detect(events, 'home', 2.10, 1.95);
      expect(steam.isReverseLineMovement).toBe(true);
    });
  });

  describe('Data Quality Validations', () => {
    it('should flag negative or impossible odds', () => {
      const events: OddsMovementEvent[] = [
        {
          id: '1', eventType: 'OddsUpdated', timestamp: new Date().toISOString(),
          bookmaker: 'Bet365', market: 'ML', selection: 'home',
          oldOdds: -1.5, newOdds: 2.05, impliedProbability: 0.48,
          movementMagnitude: 0.05, movementDirection: 'down'
        }
      ];

      const issues = MarketDataValidator.validateHistory(events);
      expect(issues.some((i) => i.type === 'ERROR' && i.message.includes('invalid/negative odds'))).toBe(true);
    });
  });

  describe('Deterministic Replay & Exporter', () => {
    it('should produce identical CLV deterministically', () => {
      const r1 = CLVEngine.calculate(2.00, 2.10, 1.90, 0.025);
      const r2 = CLVEngine.calculate(2.00, 2.10, 1.90, 0.025);
      expect(r1).toEqual(r2);
    });

    it('should export datasets successfully', () => {
      const records: ResearchRecord[] = [
        {
          matchId: 'match-1',
          predictedSelection: 'home',
          openingOdds: 2.00,
          closingOdds: 1.90,
          clvPercent: 5.26,
          expectedEdge: 0.05,
          volatilityScore: 24,
          steamScore: 45,
          stabilityScore: 76,
          consensusScore: 90,
          status: 'won',
          profitLoss: 0.95,
          timestamp: new Date().toISOString()
        }
      ];

      const tempDir = path.join(__dirname, '../../src/lib/market/temp_export');
      DatasetExporter.export(records, tempDir);

      expect(fs.existsSync(path.join(tempDir, 'market_dataset_v1.json'))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, 'market_dataset_v1.csv'))).toBe(true);

      // Clean up
      fs.unlinkSync(path.join(tempDir, 'market_dataset_v1.json'));
      fs.unlinkSync(path.join(tempDir, 'market_dataset_v1.csv'));
      fs.rmdirSync(tempDir);
    });
  });

  describe('Latency Target Assertions', () => {
    it('should compute CLV in < 5ms', () => {
      const start = process.hrtime.bigint();
      CLVEngine.calculate(2.00, 2.10, 1.90, 0.025);
      const end = process.hrtime.bigint();
      const diffMs = Number(end - start) / 1e6;
      expect(diffMs).toBeLessThan(5);
    });
  });
});
