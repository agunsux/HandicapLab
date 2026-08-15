// Test suite for EPIC 56 — Live Shadow Evidence & Production Truth
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  LiveShadowEngine,
  ImmutablePredictionSnapshot,
  ShadowSettledObservation,
} from '../src/lib/shadow/liveShadowEngine';

describe('EPIC 56 — Live Shadow Evidence & 14-Day Champion Validation', () => {
  describe('1. Prediction Immutability & Fixed Timestamp Snapshot', () => {
    test('should generate deterministic immutable snapshot hash', () => {
      const snap1 = LiveShadowEngine.createPredictionSnapshot({
        prediction_id: 'pred-live-001',
        canonical_fixture_id: 'EPL-2026-mancity-chelsea',
        model_id: 'model_2_market_ensemble',
        model_version: 'ensemble-v1',
        model_layer: 'SHADOW',
        market: 'Moneyline',
        selection: 'Manchester City',
        prediction_timestamp: '2026-08-22T14:00:00Z',
        probability: 0.574,
        fair_odds: 1.74,
        entry_odds: 1.95,
        bookmaker: 'Pinnacle',
        ev: 0.12,
      });

      const snap2 = LiveShadowEngine.createPredictionSnapshot({
        prediction_id: 'pred-live-001',
        canonical_fixture_id: 'EPL-2026-mancity-chelsea',
        model_id: 'model_2_market_ensemble',
        model_version: 'ensemble-v1',
        model_layer: 'SHADOW',
        market: 'Moneyline',
        selection: 'Manchester City',
        prediction_timestamp: '2026-08-22T14:00:00Z',
        probability: 0.574,
        fair_odds: 1.74,
        entry_odds: 1.95,
        bookmaker: 'Pinnacle',
        ev: 0.12,
      });

      expect(snap1.immutable_hash).toBe(snap2.immutable_hash);
      expect(snap1.model_layer).toBe('SHADOW');
    });
  });

  describe('2. Closing Line Gate & CLV Calculation', () => {
    test('should calculate positive CLV correctly when closing line beats entry line', () => {
      // Entry 1.95, Closing 1.85 -> CLV = 1.95 / 1.85 - 1 = +0.0541 (+5.41%)
      const clv = LiveShadowEngine.computeCLV(1.95, 1.85);
      expect(clv).toBe(0.0541);
    });

    test('should return UNAVAILABLE when closing line is missing without defaulting to 0', () => {
      const clv = LiveShadowEngine.computeCLV(1.95, 'UNAVAILABLE');
      expect(clv).toBe('UNAVAILABLE');
    });
  });

  describe('3. Realized Settlement P/L & ROI Calculation', () => {
    test('should compute realized profit from actual result rather than prediction probability', () => {
      const winProfit = LiveShadowEngine.computeRealizedProfit(1.0, 1.95, 'WIN');
      expect(winProfit).toBe(0.95);

      const lossProfit = LiveShadowEngine.computeRealizedProfit(1.0, 1.95, 'LOSS');
      expect(lossProfit).toBe(-1.0);

      const pushProfit = LiveShadowEngine.computeRealizedProfit(1.0, 1.95, 'PUSH');
      expect(pushProfit).toBe(0.0);
    });
  });

  describe('4. Minimum Sample Rule & Three Metric Layers', () => {
    test('should declare INCONCLUSIVE if shadow sample size < 30', () => {
      const sampleObs: ShadowSettledObservation[] = [
        {
          prediction_id: 'pred-1',
          canonical_fixture_id: 'fix-1',
          model_id: 'model_2_market_ensemble',
          market: 'Moneyline',
          selection: 'Home',
          entry_odds: 1.95,
          closing_odds: 1.90,
          clv: 0.0263,
          final_score: '2-1',
          market_result: 'WIN',
          realized_profit: 0.95,
          settlement_timestamp: '2026-08-22T18:30:00Z',
          data_integrity_status: 'CONFIRMED',
        },
      ];

      const report = LiveShadowEngine.compileShadowValidation(sampleObs);
      expect(report.market_reports['Moneyline'].status).toContain('INCONCLUSIVE');
      expect(report.market_reports['Moneyline'].decision).toBe('RETAIN BASELINE (CONTINUE OBSERVATION)');
    });

    test('should cleanly separate Historical OOS, Live Shadow, and Production Baseline layers', () => {
      const report = LiveShadowEngine.compileShadowValidation([]);
      expect(report.three_layer_metrics.historical_oos_epic54).toBeDefined();
      expect(report.three_layer_metrics.live_shadow_epic56).toBeDefined();
      expect(report.three_layer_metrics.production_baseline_model0).toBeDefined();
      expect(report.three_layer_metrics.live_shadow_epic56.interim_decision).toBe('MODEL 0 RETAINED (SHADOW ACTIVE)');
    });
  });

  describe('5. Daily Audit & Artifact Persistence', () => {
    test('should persist daily audit and shadow artifacts', () => {
      const report = LiveShadowEngine.compileShadowValidation([]);
      LiveShadowEngine.persistShadowArtifacts(report);

      const outDir = path.resolve(process.cwd(), 'data', 'verification');
      expect(fs.existsSync(path.join(outDir, 'LIVE_SHADOW_RESULTS.json'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'LIVE_SHADOW_CLV.json'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'LIVE_SHADOW_CALIBRATION.json'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'LIVE_SHADOW_DRIFT.json'))).toBe(true);
    });
  });
});
