import { describe, it, expect } from 'vitest';
import { PublicLedgerEngine } from '../src/lib/public-ledger/ledger-engine';
import { PublicVerifierEngine } from '../src/lib/public-ledger/verifier-engine';
import { ScientificReportGeneratorEngine } from '../src/lib/public-ledger/report-generator';
import { HallEngine } from '../src/lib/public-ledger/hall-engine';
import { ModelTimelineEngine } from '../src/lib/public-ledger/timeline-engine';

describe('EPIC 40 — Public Ledger, Transparency & Scientific Reproducibility Test Suite', () => {
  describe('1. Public Prediction Ledger Engine', () => {
    it('should generate sequential ID (#000001) and SHA-256 cryptographic hashes', () => {
      const rec = PublicLedgerEngine.createPublicRecord({
        predictionNumber: 1,
        fixtureId: 'fix-pub-101',
        league: 'Premier League',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        kickoff: new Date().toISOString(),
        market: 'asian_handicap',
        selection: 'home',
        modelProb: 0.58,
        ciLower: 0.54,
        ciUpper: 0.62,
        modelFairOdds: 1.724,
        bookmakerOdds: 2.05,
        probEdge: 0.08,
        expectedValue: 0.189,
        recommendation: 'STRONG_VALUE',
        modelVersion: 'v1.40.0',
        featureVersion: 'f-v2.5',
      });

      expect(rec.formattedPredictionId).toBe('#000001');
      expect(rec.predictionHash.length).toBe(64);
      expect(rec.verificationStatus).toBe('VERIFIED');

      const settled = PublicLedgerEngine.appendSettlement(rec, 1.95, 'WIN');
      expect(settled.settlement?.result).toBe('WIN');
      expect(settled.settlement?.profit).toBe(1.05);
    });
  });

  describe('2. Public Verifier & Reproducibility Engine', () => {
    it('should assert bit-exact mathematical reproducibility and valid prediction hashes', () => {
      const rec = PublicLedgerEngine.createPublicRecord({
        predictionNumber: 2,
        fixtureId: 'fix-pub-102',
        league: 'La Liga',
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        kickoff: new Date().toISOString(),
        market: 'moneyline',
        selection: 'home',
        modelProb: 0.53,
        ciLower: 0.48,
        ciUpper: 0.58,
        modelFairOdds: 1.887,
        bookmakerOdds: 2.15,
        probEdge: 0.05,
        expectedValue: 0.1395,
        recommendation: 'VALUE',
        modelVersion: 'v1.40.0',
        featureVersion: 'f-v2.5',
      });

      const cert = PublicVerifierEngine.verifyRecord(rec);
      expect(cert.isReproducible).toBe(true);
      expect(cert.isHashValid).toBe(true);
      expect(cert.overallStatus).toBe('VERIFIED');
    });
  });

  describe('3. Automated Scientific Report Generator', () => {
    it('should automatically generate Weekly Research Report markdown', () => {
      const report = ScientificReportGeneratorEngine.generateWeeklyReport('2026-W31');
      expect(report.periodIdentifier).toBe('2026-W31');
      expect(report.totalPredictions).toBe(118);
      expect(report.formattedMarkdown).toContain('# HandicapLab Weekly Scientific Report');
    });
  });

  describe('4. Hall of Fame & Hall of Shame Engine', () => {
    it('should return Hall of Fame entries and Hall of Shame postmortems', () => {
      const hof = HallEngine.getHallOfFame();
      const hos = HallEngine.getHallOfShame();

      expect(hof.length).toBeGreaterThan(0);
      expect(hos.length).toBeGreaterThan(0);
      expect(hos[0].postmortemNotes).toContain('Postmortem');
    });
  });

  describe('5. Model Evolution Timeline Engine', () => {
    it('should return versioned release nodes from v1.00 to v1.40.0', () => {
      const timeline = ModelTimelineEngine.getTimeline();
      expect(timeline.length).toBeGreaterThanOrEqual(6);
      expect(timeline[0].version).toBe('v1.40.0');
    });
  });
});
