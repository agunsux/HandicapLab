// Test Suite for EPIC 60 Stage B — Three-Model Split & Per-Market Evidence Ceilings
import { describe, it, expect } from 'vitest';
import {
  ThreeModelEngine,
  AsianHandicapModel,
  OverUnderModel,
  BttsModel,
  UpstreamPoissonEngine,
  GOLDEN_EVIDENCE_DENSITY,
} from '../src/lib/engines/three-model-engine';
import { EdgeScanner } from '../src/lib/engines/edge-scanner';
import { ProbabilityOutput } from '../src/lib/engines/probability-engine/types';

describe('EPIC 60 Stage B — Three-Model Split & Evidence Ceilings', () => {
  const upstream = UpstreamPoissonEngine.computeMatrix(1.65, 1.15, -0.06);
  const matrix = upstream.scoreMatrix;

  describe('B1: Asian Handicap Model', () => {
    it('should compute independent probabilities for quarter, half, and whole lines', () => {
      const line0 = AsianHandicapModel.computeLine(matrix, 0.0);
      const lineQtr = AsianHandicapModel.computeLine(matrix, -0.25);
      const lineHalf = AsianHandicapModel.computeLine(matrix, -0.5);
      const lineWhole = AsianHandicapModel.computeLine(matrix, -1.0);

      expect(line0.pCover + line0.pPush + line0.pFail).toBeCloseTo(1.0, 3);
      expect(lineQtr.pCover + lineQtr.pPush + lineQtr.pFail).toBeCloseTo(1.0, 3);
      expect(lineHalf.pCover + lineHalf.pPush + lineHalf.pFail).toBeCloseTo(1.0, 3);
      expect(lineWhole.pCover + lineWhole.pPush + lineWhole.pFail).toBeCloseTo(1.0, 3);
      expect(lineHalf.pPush).toBe(0.0); // -0.5 cannot push
    });

    it('should gate sparse AH lines (|line| >= 2.25 or sample < 250) to INSUFFICIENT_DATA', () => {
      const line225 = AsianHandicapModel.computeLine(matrix, -2.25);
      const line250 = AsianHandicapModel.computeLine(matrix, -2.5);
      const line300 = AsianHandicapModel.computeLine(matrix, -3.0);

      expect(line225.evidenceStatus).toBe('INSUFFICIENT_DATA');
      expect(line250.evidenceStatus).toBe('INSUFFICIENT_DATA');
      expect(line300.evidenceStatus).toBe('INSUFFICIENT_DATA');
      expect(line225.economics?.status).toBe('INSUFFICIENT_DATA');
      expect(line225.economics?.ev).toBeNull();
    });

    it('should tag populated AH lines as EVALUATED with their gold sample size', () => {
      const line025 = AsianHandicapModel.computeLine(matrix, -0.25);
      const line075 = AsianHandicapModel.computeLine(matrix, -0.75);

      expect(line025.evidenceStatus).toBe('EVALUATED');
      expect(line025.sampleSizeGold).toBe(GOLDEN_EVIDENCE_DENSITY.AH['-0.25']);
      expect(line075.evidenceStatus).toBe('EVALUATED');
      expect(line075.sampleSizeGold).toBe(GOLDEN_EVIDENCE_DENSITY.AH['-0.75']);
    });
  });

  describe('B2: Over/Under Model', () => {
    it('should allow line 2.5 only to display EVALUATED economics (N=23,875)', () => {
      const line25 = OverUnderModel.computeLine(matrix, 2.5);
      expect(line25.evidenceStatus).toBe('EVALUATED');
      expect(line25.sampleSizeGold).toBe(23875);
      expect(line25.economics).toBeUndefined();
    });

    it('should hard-gate quarter and non-2.5 lines to NO_HISTORICAL_EVIDENCE', () => {
      const line225 = OverUnderModel.computeLine(matrix, 2.25);
      const line275 = OverUnderModel.computeLine(matrix, 2.75);
      const line325 = OverUnderModel.computeLine(matrix, 3.25);
      const line150 = OverUnderModel.computeLine(matrix, 1.5);

      expect(line225.evidenceStatus).toBe('NO_HISTORICAL_EVIDENCE');
      expect(line275.evidenceStatus).toBe('NO_HISTORICAL_EVIDENCE');
      expect(line325.evidenceStatus).toBe('NO_HISTORICAL_EVIDENCE');
      expect(line150.evidenceStatus).toBe('NO_HISTORICAL_EVIDENCE');
      expect(line225.economics?.status).toBe('NO_HISTORICAL_EVIDENCE');
      expect(line225.economics?.ev).toBeNull();
    });
  });

  describe('B3: BTTS Model', () => {
    it('should calculate valid probabilities but hard-gate economics to INSUFFICIENT_DATA (N=0)', () => {
      const btts = BttsModel.compute(matrix);
      expect(btts.pYes + btts.pNo).toBeCloseTo(1.0, 3);
      expect(btts.pYes).toBeGreaterThan(0.3);
      expect(btts.evidenceStatus).toBe('INSUFFICIENT_DATA');
      expect(btts.sampleSizeGold).toBe(0);
      expect(btts.economics.status).toBe('INSUFFICIENT_DATA');
      expect(btts.economics.ev).toBeNull();
      expect(btts.economics.clv).toBeNull();
      expect(btts.economics.isValueBet).toBe(false);
    });
  });

  describe('Serialization Layer & EdgeScanner Gating', () => {
    const fullOutput = ThreeModelEngine.predict('match-ep60-1', 1.65, 1.15, -0.06);

    it('should enforce NO_HISTORICAL_EVIDENCE at query serialization for OU 2.25/2.75/3.25', () => {
      const res225 = ThreeModelEngine.serializeMarketQuery(fullOutput, 'OU', 2.25);
      const res275 = ThreeModelEngine.serializeMarketQuery(fullOutput, 'OU', 2.75);
      const res250 = ThreeModelEngine.serializeMarketQuery(fullOutput, 'OU', 2.5);

      expect(res225.economicMetrics.status).toBe('NO_HISTORICAL_EVIDENCE');
      expect(res225.economicMetrics.ev).toBeNull();
      expect(res275.economicMetrics.status).toBe('NO_HISTORICAL_EVIDENCE');
      expect(res250.economicMetrics.status).toBe('EVALUATED');
      expect(res250.economicMetrics.sampleSize).toBe(23875);
    });

    it('should enforce INSUFFICIENT_DATA at query serialization for BTTS', () => {
      const resBtts = ThreeModelEngine.serializeMarketQuery(fullOutput, 'BTTS');
      expect(resBtts.economicMetrics.status).toBe('INSUFFICIENT_DATA');
      expect(resBtts.economicMetrics.ev).toBeNull();
      expect(resBtts.economicMetrics.clv).toBeNull();
      expect(resBtts.probabilities.yes).toBe(fullOutput.btts.pYes);
    });

    it('should enforce INSUFFICIENT_DATA for sparse AH lines (|line| >= 2.25)', () => {
      const resSparse = ThreeModelEngine.serializeMarketQuery(fullOutput, 'AH', -2.5);
      const resPop = ThreeModelEngine.serializeMarketQuery(fullOutput, 'AH', -0.5);

      expect(resSparse.economicMetrics.status).toBe('INSUFFICIENT_DATA');
      expect(resSparse.economicMetrics.ev).toBeNull();
      expect(resPop.economicMetrics.status).toBe('EVALUATED');
      expect(resPop.economicMetrics.sampleSize).toBe(2312);
    });

    it('should prevent EdgeScanner from emitting any value bets for BTTS or quarter OU lines', () => {
      const mockOutput: ProbabilityOutput = {
        matchId: 'match-ep60-1',
        marketType: 'BTTS',
        pHome: 0.5,
        pDraw: 0.25,
        pAway: 0.25,
        pOver: { '2.5': 0.60, '2.25': 0.65 },
        pUnder: { '2.5': 0.40, '2.25': 0.35 },
        pAhHome: { '-0.5': 0.55, '-2.5': 0.20 },
        pAhAway: { '-0.5': 0.45, '-2.5': 0.80 },
        pBttsYes: 0.70,
        pBttsNo: 0.30,
        modelVersion: {
          name: 'prematch-v1',
          algo: 'dixon-coles',
          features: 'basic-v1',
          trainedAt: new Date(),
          trainedOnMatches: 1000,
        },
        calibrationApplied: true,
      };

      // BTTS Scan -> must return empty array
      const bttsPicks = EdgeScanner.scan('match-ep60-1', 'BTTS' as any, mockOutput, { homeOdds: 2.2, awayOdds: 1.8 } as any);
      expect(bttsPicks).toHaveLength(0);

      // OU 2.25 Scan -> must return empty array
      const ou225Picks = EdgeScanner.scan('match-ep60-1', 'OU', mockOutput, { homeOdds: 2.2, awayOdds: 1.8, line: 2.25 } as any);
      expect(ou225Picks).toHaveLength(0);

      // AH -2.5 (sparse) Scan -> must return empty array
      const ahSparsePicks = EdgeScanner.scan('match-ep60-1', 'AH', mockOutput, { homeOdds: 3.5, awayOdds: 1.4, line: -2.5 } as any);
      expect(ahSparsePicks).toHaveLength(0);

      // OU 2.5 Scan -> allowed to emit pick if EV > 0
      const ou25Picks = EdgeScanner.scan('match-ep60-1', 'OU', mockOutput, { homeOdds: 2.0, awayOdds: 2.0, line: 2.5 } as any);
      expect(ou25Picks.length).toBeGreaterThan(0);
    });
  });
});
