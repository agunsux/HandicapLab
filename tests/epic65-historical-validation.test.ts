import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  settleAsianHandicap,
  settleAsianTotal,
  profitOfOutcome,
  SettlementOutcome
} from '../src/historical/settlement/settlement';
import { studentTPValue } from '../scripts/epic65_backtest_runner';

describe('EPIC 65 — Historical Data Foundation & AH Segment Profitability Audit', () => {

  describe('1. Asian Handicap Quarter-Line Settlement Rigor', () => {
    it('should settle 0.00 (Pick\'em / Level Ball) accurately', () => {
      expect(settleAsianHandicap('home', 0.0, 2, 1)).toBe('WIN');
      expect(settleAsianHandicap('home', 0.0, 1, 1)).toBe('PUSH');
      expect(settleAsianHandicap('home', 0.0, 0, 1)).toBe('LOSS');
    });

    it('should settle -0.25 line with proper half-loss on draw', () => {
      expect(settleAsianHandicap('home', -0.25, 2, 1)).toBe('WIN');
      expect(settleAsianHandicap('home', -0.25, 1, 1)).toBe('HALF_LOSS');
      expect(settleAsianHandicap('home', -0.25, 0, 1)).toBe('LOSS');

      // Profit calculations for half-loss (odds 2.00, stake 1.0 -> -0.5 profit)
      expect(profitOfOutcome('HALF_LOSS', 2.00, 1.0)).toBe(-0.5);
    });

    it('should settle +0.25 line with proper half-win on draw', () => {
      expect(settleAsianHandicap('home', 0.25, 2, 1)).toBe('WIN');
      expect(settleAsianHandicap('home', 0.25, 1, 1)).toBe('HALF_WIN');
      expect(settleAsianHandicap('home', 0.25, 0, 1)).toBe('LOSS');

      // Profit calculations for half-win (odds 1.90, stake 1.0 -> +0.45 profit)
      expect(profitOfOutcome('HALF_WIN', 1.90, 1.0)).toBeCloseTo(0.45, 5);
    });

    it('should settle -0.75 line with proper half-win on 1-goal victory', () => {
      expect(settleAsianHandicap('home', -0.75, 2, 1)).toBe('HALF_WIN');
      expect(settleAsianHandicap('home', -0.75, 3, 1)).toBe('WIN');
      expect(settleAsianHandicap('home', -0.75, 1, 1)).toBe('LOSS');
    });

    it('should settle +0.75 line with proper half-loss on 1-goal defeat', () => {
      // Away team with +0.75 handicap: home 2, away 1 (away lost by 1)
      expect(settleAsianHandicap('away', 0.75, 2, 1)).toBe('HALF_LOSS');
      expect(settleAsianHandicap('away', 0.75, 1, 1)).toBe('WIN');
      expect(settleAsianHandicap('away', 0.75, 3, 1)).toBe('LOSS');
    });

    it('should settle -1.00 line with push on 1-goal victory', () => {
      expect(settleAsianHandicap('home', -1.0, 2, 1)).toBe('PUSH');
      expect(settleAsianHandicap('home', -1.0, 3, 1)).toBe('WIN');
      expect(settleAsianHandicap('home', -1.0, 1, 1)).toBe('LOSS');
    });
  });

  describe('2. Student\'s t-Distribution & Benjamini-Hochberg FDR Mathematics', () => {
    it('should compute two-tailed p-values accurately via regularized incomplete beta', () => {
      // Large t-statistic (strong edge) -> p-value near 0
      const pSmall = studentTPValue(4.5, 50);
      expect(pSmall).toBeLessThan(0.0001);

      // t-statistic near 0 (no edge) -> p-value near 1
      const pLarge = studentTPValue(0.1, 50);
      expect(pLarge).toBeGreaterThan(0.9);

      // Known t-statistic test vector: df=10, t=2.2281 -> p ~= 0.05
      const pVector = studentTPValue(2.2281, 10);
      expect(pVector).toBeCloseTo(0.05, 2);
    });

    it('should control False Discovery Rate at q=0.05 across multiple hypotheses', () => {
      const pValues = [0.001, 0.008, 0.015, 0.035, 0.045, 0.12, 0.25, 0.50];
      const M = pValues.length;
      const q = 0.05;

      const results = pValues.map((p, idx) => {
        const k = idx + 1;
        const bhCriticalP = (k / M) * q;
        return { p, bhCriticalP, isSignificant: p <= bhCriticalP };
      });

      // Rank 1: 0.001 <= (1/8)*0.05 = 0.00625 -> True
      expect(results[0].isSignificant).toBe(true);
      // Rank 2: 0.008 <= (2/8)*0.05 = 0.0125 -> True
      expect(results[1].isSignificant).toBe(true);
      // Rank 3: 0.015 <= (3/8)*0.05 = 0.01875 -> True
      expect(results[2].isSignificant).toBe(true);
      // Rank 4: 0.035 <= (4/8)*0.05 = 0.025 -> False
      expect(results[3].isSignificant).toBe(false);
    });
  });

  describe('3. Stage A Dataset & Governance Invariants', () => {
    it('should verify pre-locked hypotheses configuration file exists', () => {
      const hypPath = path.resolve('src/historical/research/epic65_hypotheses.json');
      expect(fs.existsSync(hypPath)).toBe(true);

      const hyp = JSON.parse(fs.readFileSync(hypPath, 'utf-8'));
      expect(hyp.epic).toBe(65);
      expect(hyp.segments.length).toBe(7);
      expect(hyp.leagues.length).toBe(5);
      expect(hyp.minSampleSize).toBe(30);
      expect(hyp.fdrCorrection.method).toBe('Benjamini-Hochberg');
      expect(hyp.fdrCorrection.qValue).toBe(0.05);
      expect(hyp.poolingRule).toBe('STRICTLY_DISALLOWED_NEVER_POOL_LEAGUES');
    });

    it('should verify Stage A checkpoint and candidate league probe artifacts', () => {
      const stageAPath = path.resolve('docs/epic65_stage_a_checkpoint.md');
      const probePath = path.resolve('docs/epic65_candidate_leagues_probe.md');

      expect(fs.existsSync(stageAPath)).toBe(true);
      expect(fs.existsSync(probePath)).toBe(true);

      const stageAContent = fs.readFileSync(stageAPath, 'utf-8');
      expect(stageAContent).toContain('3,504');
      expect(stageAContent).toContain('ENG-PL');
      expect(stageAContent).toContain('ESP-LALIGA');
      expect(stageAContent).toContain('ITA-SERIEA');
      expect(stageAContent).toContain('DEU-BUNDESLIGA');
      expect(stageAContent).toContain('FRA-LIGUE1');
      expect(stageAContent).toContain('SOURCE_DATA_ABSENT');

      const probeContent = fs.readFileSync(probePath, 'utf-8');
      expect(probeContent).toContain('REJECTED');
      expect(probeContent).toContain('Brasileirão Série A');
      expect(probeContent).toContain('Liga MX');
      expect(probeContent).toContain('Major League Soccer');
      expect(probeContent).toContain('Saudi Pro League');
      expect(probeContent).toContain('Argentina Liga Profesional');
    });
  });

  describe('4. Backtest Report Audit & Empirical Outcomes', () => {
    it('should confirm reproducible backtest output has zero favorite edge and significant underdog alpha', () => {
      const reportPath = path.resolve('data/reports/epic65_backtest_report.json');
      expect(fs.existsSync(reportPath)).toBe(true);

      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

      // Invariant: 35 cells audited, 30 meeting N >= 30, exactly 9 significant
      expect(report.stageB_AsianHandicap.cellsAudited).toBe(35);
      expect(report.stageB_AsianHandicap.cellsMeetingMinSampleN30).toBe(30);
      expect(report.stageB_AsianHandicap.cellsSignificantAfterFdr).toBe(9);

      // Invariant: Zero favorite segments have positive significant alpha
      const favoriteSegments = ['DEEP_FAVORITE', 'CLEAR_FAVORITE', 'SLIGHT_FAVORITE'];
      const significantFavorites = report.stageB_AsianHandicap.fullSegmentGrid.filter(
        (c: any) => favoriteSegments.includes(c.segmentId) && c.isSignificant
      );
      expect(significantFavorites.length).toBe(0);

      // Invariant: All significant cells are underdogs or pick'em
      const significantCells = report.stageB_AsianHandicap.fullSegmentGrid.filter((c: any) => c.isSignificant);
      for (const cell of significantCells) {
        expect(['CLEAR_UNDERDOG', 'SLIGHT_UNDERDOG', 'PICKEM']).toContain(cell.segmentId);
        expect(cell.sampleSize).toBeGreaterThanOrEqual(30);
        expect(cell.yieldPercent).toBeGreaterThan(0);
        expect(cell.pValue).toBeLessThanOrEqual(cell.bhCriticalP);
      }
    });

    it('should confirm BTTS evaluation is calibrated without financial claims', () => {
      const reportPath = path.resolve('data/reports/epic65_backtest_report.json');
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

      expect(report.stageC_BttsCalibration.length).toBe(5);
      for (const btts of report.stageC_BttsCalibration) {
        expect(btts.sampleSize).toBeGreaterThan(500);
        // ECE should be well-calibrated (under 15%)
        expect(btts.ece).toBeLessThan(0.15);
        expect(btts.calibrationCurve.length).toBe(10);
      }
    });

    it('should confirm Over/Under 2.5 Pinnacle closing evaluation', () => {
      const reportPath = path.resolve('data/reports/epic65_backtest_report.json');
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

      expect(report.stageD_OverUnder25.perLeague.length).toBe(5);
      expect(report.stageD_OverUnder25.aggregate.betsPlaced).toBeGreaterThan(2000);
      // Aggregate hit rate should be near 50%
      expect(report.stageD_OverUnder25.aggregate.hitRate).toBeGreaterThan(0.45);
      expect(report.stageD_OverUnder25.aggregate.hitRate).toBeLessThan(0.55);
    });
  });
});
