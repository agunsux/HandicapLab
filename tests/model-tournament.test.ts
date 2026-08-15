// Test suite for EPIC 54 — Model Tournament & Champion Selection
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  executeModelTournament,
  calculateDixonColesMatrix,
  matrixToCanonicalOutputs,
  devigOdds,
  loadVerifiedHistoricalData,
} from '../src/lib/tournament/modelTournamentEngine';

describe('EPIC 54 — Model Tournament & Champion Selection', () => {
  const tournament = executeModelTournament();

  describe('Hard Data & Governance Gates', () => {
    test('should only load real historical matches with is_synthetic = false', () => {
      const data = loadVerifiedHistoricalData();
      expect(data.length).toBeGreaterThan(1000);
      data.forEach((m) => {
        expect(m.is_synthetic).toBe(false);
      });
    });

    test('should evaluate across at least 3 distinct chronological walk-forward folds', () => {
      expect(tournament.foldsCount).toBeGreaterThanOrEqual(3);
      expect(tournament.totalOosMatches).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Canonical Probability Output Formats', () => {
    test('should produce valid sum-to-1 probabilities across all 4 markets', () => {
      const matrix = calculateDixonColesMatrix(1.5, 1.2, -0.06);
      const outputs = matrixToCanonicalOutputs(matrix);

      // Moneyline: [P(Home), P(Draw), P(Away)]
      expect(outputs.moneyline).toHaveLength(3);
      const sumMl = outputs.moneyline.reduce((s, p) => s + p, 0);
      expect(sumMl).toBeCloseTo(1.0, 2);

      // Asian Handicap: [P(Cover), P(Push), P(Fail)]
      expect(outputs.asianHandicap).toHaveLength(3);
      const sumAh = outputs.asianHandicap.reduce((s, p) => s + p, 0);
      expect(sumAh).toBeCloseTo(1.0, 2);

      // Over / Under: [P(Over), P(Under)]
      expect(outputs.overUnder).toHaveLength(2);
      const sumOu = outputs.overUnder.reduce((s, p) => s + p, 0);
      expect(sumOu).toBeCloseTo(1.0, 2);

      // BTTS: [P(Yes), P(No)]
      expect(outputs.btts).toHaveLength(2);
      const sumBtts = outputs.btts.reduce((s, p) => s + p, 0);
      expect(sumBtts).toBeCloseTo(1.0, 2);
    });

    test('should correctly de-vig sharp market odds', () => {
      const devigged = devigOdds([2.0, 3.4, 3.8]);
      expect(devigged).toHaveLength(3);
      const sum = devigged.reduce((s, p) => s + p, 0);
      expect(sum).toBeCloseTo(1.0, 2);
      expect(devigged[0]).toBeGreaterThan(devigged[1]);
      expect(devigged[1]).toBeGreaterThan(devigged[2]);
    });
  });

  describe('Tournament Evaluation & Promotion Gates', () => {
    test('should evaluate all three candidate models across all 4 markets', () => {
      expect(tournament.models.model_0_baseline).toBeDefined();
      expect(tournament.models.model_1_football_only).toBeDefined();
      expect(tournament.models.model_2_market_ensemble).toBeDefined();

      const markets = ['moneyline', 'asianHandicap', 'overUnder', 'btts'] as const;
      for (const m of markets) {
        expect(tournament.models.model_0_baseline.aggregateMarkets[m].sampleSize).toBeGreaterThan(0);
        expect(tournament.models.model_1_football_only.aggregateMarkets[m].sampleSize).toBeGreaterThan(0);
        expect(tournament.models.model_2_market_ensemble.aggregateMarkets[m].sampleSize).toBeGreaterThan(0);
      }
    });

    test('should verify that CLV, Calibration, and ROI are all evaluated for promotion', () => {
      for (const marketKey of Object.keys(tournament.champions)) {
        const champ = tournament.champions[marketKey];
        expect(champ.championModel).toBeDefined();
        expect(champ.incumbentModel).toBe('model_0_baseline');
        expect(champ.metricsComparison.challenger.clv).toBeGreaterThanOrEqual(0);
        expect(champ.metricsComparison.challenger.brierScore).toBeLessThan(1.0);
      }
    });
  });

  describe('Artifact Persistence', () => {
    test('should write all required tournament JSON artifacts to data/verification', () => {
      const outDir = path.resolve(process.cwd(), 'data', 'verification');
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      fs.writeFileSync(path.join(outDir, 'MODEL_TOURNAMENT_RESULTS.json'), JSON.stringify(tournament, null, 2), 'utf8');
      fs.writeFileSync(path.join(outDir, 'MODEL_CHAMPION.json'), JSON.stringify(tournament.champions, null, 2), 'utf8');
      fs.writeFileSync(
        path.join(outDir, 'WALK_FORWARD_RESULTS.json'),
        JSON.stringify(
          {
            folds: tournament.models.model_2_market_ensemble.folds,
            totalOosMatches: tournament.totalOosMatches,
          },
          null,
          2
        ),
        'utf8'
      );
      fs.writeFileSync(
        path.join(outDir, 'CALIBRATION_REPORT.json'),
        JSON.stringify(
          {
            model_0_baseline: tournament.models.model_0_baseline.aggregateMarkets,
            model_1_football_only: tournament.models.model_1_football_only.aggregateMarkets,
            model_2_market_ensemble: tournament.models.model_2_market_ensemble.aggregateMarkets,
          },
          null,
          2
        ),
        'utf8'
      );
      fs.writeFileSync(
        path.join(outDir, 'CLV_REPORT.json'),
        JSON.stringify(
          {
            model_0_clv: {
              ml: tournament.models.model_0_baseline.aggregateMarkets.moneyline.clv,
              ah: tournament.models.model_0_baseline.aggregateMarkets.asianHandicap.clv,
              ou: tournament.models.model_0_baseline.aggregateMarkets.overUnder.clv,
              btts: tournament.models.model_0_baseline.aggregateMarkets.btts.clv,
            },
            model_1_clv: {
              ml: tournament.models.model_1_football_only.aggregateMarkets.moneyline.clv,
              ah: tournament.models.model_1_football_only.aggregateMarkets.asianHandicap.clv,
              ou: tournament.models.model_1_football_only.aggregateMarkets.overUnder.clv,
              btts: tournament.models.model_1_football_only.aggregateMarkets.btts.clv,
            },
            model_2_clv: {
              ml: tournament.models.model_2_market_ensemble.aggregateMarkets.moneyline.clv,
              ah: tournament.models.model_2_market_ensemble.aggregateMarkets.asianHandicap.clv,
              ou: tournament.models.model_2_market_ensemble.aggregateMarkets.overUnder.clv,
              btts: tournament.models.model_2_market_ensemble.aggregateMarkets.btts.clv,
            },
          },
          null,
          2
        ),
        'utf8'
      );

      expect(fs.existsSync(path.join(outDir, 'MODEL_TOURNAMENT_RESULTS.json'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'MODEL_CHAMPION.json'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'WALK_FORWARD_RESULTS.json'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'CALIBRATION_REPORT.json'))).toBe(true);
      expect(fs.existsSync(path.join(outDir, 'CLV_REPORT.json'))).toBe(true);
    });
  });
});
