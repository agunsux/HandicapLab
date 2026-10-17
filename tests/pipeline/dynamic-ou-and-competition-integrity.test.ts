import { describe, it, expect } from 'vitest';
import {
  calculateAsianTotalProbability,
  calculateAsianHandicapProbability,
  buildScoreGrid,
} from '@/lib/engine/probability';
import { ExpectedValueCalculator } from '@/lib/research/settlement/evCalculator';
import { ConfidenceGateSystem, ConfidenceGateInput } from '@/lib/pipeline/confidenceGate';
import { DailyPipelineOrchestrator } from '@/lib/pipeline/dailyOrchestrator';
import { DailyPredictionLedgerService } from '@/lib/pipeline/dailyPredictionLedger';
import { RunIdentityService } from '@/lib/pipeline/runIdentity';
import { SalmoSyncService } from '@/lib/pipeline/salmoSyncService';
import { CanonicalFixture } from '@/lib/services/canonicalFixtureRegistry';

describe('Dynamic O/U Line Engine, Quarter-Line EV & Competition Integrity Suite', () => {
  const homeXG = 1.65;
  const awayXG = 1.25;
  const rho = -0.06;

  describe('1. Dynamic Over/Under Probability Engine across Line Families', () => {
    it('accurately resolves whole lines (e.g. 2.0) with non-zero push probability', () => {
      const prob = calculateAsianTotalProbability(homeXG, awayXG, 2.0, true, rho);
      expect(prob.push).toBeGreaterThan(0.10); // P(x + y == 2)
      expect(prob.halfWin).toBe(0);
      expect(prob.halfLoss).toBe(0);
      const total = prob.win + prob.halfWin + prob.push + prob.halfLoss + prob.loss;
      expect(Number(total.toFixed(4))).toBe(1.0);
    });

    it('accurately resolves half lines (e.g. 2.5) with zero push and zero split', () => {
      const prob = calculateAsianTotalProbability(homeXG, awayXG, 2.5, true, rho);
      expect(prob.push).toBe(0);
      expect(prob.halfWin).toBe(0);
      expect(prob.halfLoss).toBe(0);
      expect(prob.win).toBeGreaterThan(0.40);
      expect(prob.loss).toBeGreaterThan(0.30);
      const total = prob.win + prob.loss;
      expect(Number(total.toFixed(4))).toBe(1.0);
    });

    it('accurately resolves quarter line 2.25 with halfLoss on 2 goals and zero halfWin', () => {
      const prob = calculateAsianTotalProbability(homeXG, awayXG, 2.25, true, rho);
      expect(prob.push).toBe(0);
      expect(prob.halfWin).toBe(0);
      expect(prob.halfLoss).toBeGreaterThan(0.10); // 2 goals = half loss for Over 2.25
      expect(prob.cover).toBe(prob.win);
      const total = prob.win + prob.halfWin + prob.push + prob.halfLoss + prob.loss;
      expect(Number(total.toFixed(4))).toBe(1.0);
    });

    it('accurately resolves quarter line 2.75 with halfWin on 3 goals and zero halfLoss', () => {
      const prob = calculateAsianTotalProbability(homeXG, awayXG, 2.75, true, rho);
      expect(prob.push).toBe(0);
      expect(prob.halfWin).toBeGreaterThan(0.10); // 3 goals = half win for Over 2.75
      expect(prob.halfLoss).toBe(0);
      expect(prob.cover).toBeCloseTo(prob.win + 0.5 * prob.halfWin, 4);
      const total = prob.win + prob.halfWin + prob.push + prob.halfLoss + prob.loss;
      expect(Number(total.toFixed(4))).toBe(1.0);
    });
  });

  describe('2. Quarter-Line Split EV Calculation vs Binary Reduction', () => {
    it('computes exact EV for quarter lines without treating half-losses as full losses', () => {
      // Over 2.25: win=0.50, halfLoss=0.25, loss=0.25, odds=1.95
      const evQuarter = ExpectedValueCalculator.computeQuarterLineEv(0.50, 0, 0, 0.25, 0.25, 1.95);
      // EV = 0.50 * 0.95 + 0 * 0 + 0 * 0 + 0.25 * (-0.5) + 0.25 * (-1.0)
      //    = 0.475 - 0.125 - 0.25 = +0.100
      expect(evQuarter.expectedValue).toBe(0.1);
      expect(evQuarter.isPositiveEv).toBe(true);

      // Binary EV would have done: (0.50 * 1.95) - 1 = -0.025 (false negative!)
      const evBinary = ExpectedValueCalculator.computeBinaryEv(0.50, 1.95);
      expect(evBinary.expectedValue).toBe(-0.025);
      expect(evBinary.isPositiveEv).toBe(false);
    });
  });

  describe('3. Authoritative Competition Integrity Gate', () => {
    const baseKickoff = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const basePred = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const baseOdds = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    it('rejects Hull City when claimed as Premier League fixture with COMPETITION_MISMATCH', () => {
      const input: ConfidenceGateInput = {
        canonicalMatchId: 'CANONICAL_HULL_TEST',
        fixtureId: 'fix_hull_01',
        match: 'Fulham vs Hull City',
        homeTeam: 'Fulham',
        awayTeam: 'Hull City',
        competition: 'Premier League',
        kickoffUtc: baseKickoff,
        market: 'AH',
        selection: 'Fulham -0.75',
        line: -0.75,
        odds: 1.95,
        modelProbability: 0.72,
        calibratedProbability: 0.72,
        predictionTimestampUtc: basePred,
        oddsTimestampUtc: baseOdds,
        modelVersion: 'dixon-coles-v1.0',
        sampleSizeHome: 15,
        sampleSizeAway: 15,
        modelValidated: true,
      };

      const result = ConfidenceGateSystem.evaluate(input);
      expect(result.qualified).toBe(false);
      expect(result.isHighConfidence).toBe(false);
      expect(result.status).toBe('INVALID');
      expect(result.verdict).toBe('LEWATI');
      expect(result.rejectionReasons.some((r) => r.includes('COMPETITION_MISMATCH'))).toBe(true);
      expect(result.rejectionReasons.some((r) => r.includes('Hull City is an EFL Championship club'))).toBe(true);
    });

    it('allows legitimate Premier League clash (Everton vs Chelsea)', () => {
      const input: ConfidenceGateInput = {
        canonicalMatchId: 'CANONICAL_EVE_CHE',
        fixtureId: 'fix_eve_che',
        match: 'Everton vs Chelsea',
        homeTeam: 'Everton',
        awayTeam: 'Chelsea',
        competition: 'Premier League',
        kickoffUtc: baseKickoff,
        market: 'AH',
        selection: 'Everton +0.25',
        line: 0.25,
        odds: 1.95,
        modelProbability: 0.70,
        calibratedProbability: 0.70,
        predictionTimestampUtc: basePred,
        oddsTimestampUtc: baseOdds,
        modelVersion: 'dixon-coles-v1.0',
        sampleSizeHome: 15,
        sampleSizeAway: 15,
        modelValidated: true,
        outcomeProbabilities: {
          win: 0.45,
          halfWin: 0.25,
          push: 0.0,
          halfLoss: 0.0,
          loss: 0.30,
        },
      };

      const result = ConfidenceGateSystem.evaluate(input);
      expect(result.status).toBe('HIGH_CONFIDENCE');
      expect(result.qualified).toBe(true);
      expect(result.verdict).toBe('LAYAK');
      expect(result.rejectionReasons.length).toBe(0);
    });
  });

  describe('4. Dynamic O/U Family Pipeline Discovery', () => {
    it('evaluates dynamic lines quoted in overUnderFamily (2.25, 2.75) with exact quarter line EV', async () => {
      RunIdentityService.clearForTesting();
      DailyPredictionLedgerService.clearForTesting();
      SalmoSyncService.clearForTesting();

      const kickoffUtc = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
      const mockFixture: CanonicalFixture = {
        fixtureId: 'fix_dynamic_ou_test',
        providerFixtureId: 'p_dyn_01',
        competitionId: 39,
        competitionName: 'Premier League',
        season: '2025',
        homeTeam: 'Everton',
        awayTeam: 'Chelsea',
        kickoffUtc,
        status: 'SCHEDULED',
        source: 'the-odds-api',
        firstSeenAt: new Date().toISOString(),
        lastSyncedAt: new Date().toISOString(),
        markets: {
          asianHandicap: { available: true, line: 0.25, homeOdds: 1.95, awayOdds: 1.95 },
          overUnder: { available: true, line: 2.5, overOdds: 1.95, underOdds: 1.91 },
          btts: { available: true, line: 0.5, yesOdds: 1.75, noOdds: 2.10 },
          // Quoted lines from provider: 2.25 and 2.75 in overUnderFamily
          overUnderFamily: {
            2.25: { available: true, line: 2.25, overOdds: 1.80, underOdds: 2.05 },
            2.5: { available: true, line: 2.5, overOdds: 1.95, underOdds: 1.91 },
            2.75: { available: true, line: 2.75, overOdds: 2.15, underOdds: 1.75 },
          },
        } as any,
      };

      const report = await DailyPipelineOrchestrator.executeDailyRun({
        customFixtures: [mockFixture],
        trigger: 'MANUAL',
        forceNew: true,
      });

      expect(report.status).toBe('SUCCESS');

      const ledger = DailyPredictionLedgerService.loadLedger();
      const records = Object.values(ledger).filter((r) => r.runId === report.runId);

      const ouRecords = records.filter((r) => r.market === 'OU');
      // Must contain dynamic lines 2.25 and 2.75
      const line225 = ouRecords.find((r) => r.line === 2.25);
      const line275 = ouRecords.find((r) => r.line === 2.75);

      expect(line225).toBeDefined();
      expect(line225?.odds).toBe(1.80);
      expect(line225?.selection).toBe('Over 2.25');

      expect(line275).toBeDefined();
      expect(line275?.odds).toBe(2.15);
      expect(line275?.selection).toBe('Over 2.75');
    });
  });
});
