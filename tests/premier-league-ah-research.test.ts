import { describe, it, expect } from 'vitest';
import { generatePremierLeagueAhResearch } from '../src/lib/research/premierLeagueAhEngine';

describe('Forensic Premier League Asian Handicap Research (Holdout & Edge Validation)', () => {
  const payload = generatePremierLeagueAhResearch();

  it('1. Forensic Data Integrity: 760 expected matches, 760 final results, zero missingness', () => {
    const { dataIntegrity } = payload;
    expect(dataIntegrity.expectedFixtures).toBe(760);
    expect(dataIntegrity.discoveredFixtures).toBe(760);
    expect(dataIntegrity.finalResultsVerified).toBe(760);
    expect(dataIntegrity.missingResults).toBe(0);
    expect(dataIntegrity.duplicateRecords).toBe(0);
    expect(dataIntegrity.lookAheadPassed).toBe(true);
    expect(dataIntegrity.dummyDataPassed).toBe(true);
    expect(dataIntegrity.settlementEnginePassed).toBe(true);
    expect(dataIntegrity.provenanceStatus).toBe('PASS');
    expect(dataIntegrity.status).toBe('REAL_DATA');
  });

  it('2. Population Line Coverage: explicitly computes share of population for every market slice', () => {
    const { dataIntegrity } = payload;
    expect(dataIntegrity.ah0Records).toBe(89);
    expect(dataIntegrity.ah0CoveragePct).toBe(11.71); // 89 / 760 * 100
    expect(dataIntegrity.ahPositiveRecords).toBe(231);
    expect(dataIntegrity.ahPositiveCoveragePct).toBe(30.39); // 231 / 760 * 100
    expect(dataIntegrity.ahNegativeRecords).toBe(439);
    expect(dataIntegrity.ahNegativeCoveragePct).toBe(57.76); // 439 / 760 * 100
  });

  it('3. Zero-Dummy UI & Payload Rule: Contains no mock data strings', () => {
    const raw = JSON.stringify(payload);
    expect(raw.includes('LIV vs ARS')).toBe(false);
    expect(raw.includes('mock_odds')).toBe(false);
    expect(raw.includes('fake_fixture')).toBe(false);
    expect(payload.dataIntegrity.dummyDataPassed).toBe(true);
  });

  it('4. Primary Question: Home AH +0 Backtest accurately reflects empirical outcomes', () => {
    const sComb = payload.homeAhZero.bySeason.combined;
    expect(sComb.bets).toBe(89);
    expect(sComb.wins).toBe(30);
    expect(sComb.pushes).toBe(27);
    expect(sComb.losses).toBe(32);
    expect(sComb.winRate).toBe(48.4);
    expect(sComb.pushRate).toBe(30.3);
    expect(sComb.profit).toBe(-3.89);
    expect(sComb.roi).toBe(-4.37);
    expect(sComb.yieldRate).toBe(-4.37);
    expect(sComb.avgClv).toBe(-1.22);
  });

  it('5. Temporal Holdout: Away +0.50 survives out-of-sample holdout test', () => {
    const candidates = payload.lineMatrix.holdoutCandidates;
    const away050 = candidates.find((c) => c.ruleId === 'away_plus_050');
    expect(away050).toBeDefined();
    expect(away050?.discoveryRoi).toBe(15.0); // 2024/25
    expect(away050?.oosRoi).toBe(7.76); // 2025/26 (OOS)
    expect(away050?.oosClv).toBe(1.48); // 2025/26 OOS CLV
    expect(away050?.oosStatus).toBe('SURVIVED_OOS');
    expect(away050?.verdict).toBe('PROMISING');
  });

  it('6. Data-Mining Collapse: Away +1.50 and Away +1.00 fail out-of-sample holdout test', () => {
    const candidates = payload.lineMatrix.holdoutCandidates;
    
    const away150 = candidates.find((c) => c.ruleId === 'away_plus_150');
    expect(away150).toBeDefined();
    expect(away150?.discoveryRoi).toBe(21.52);
    expect(away150?.oosRoi).toBe(-5.88); // Collapsed OOS
    expect(away150?.oosStatus).toBe('FAILED_OOS_DATA_MINED');

    const away100 = candidates.find((c) => c.ruleId === 'away_plus_100');
    expect(away100).toBeDefined();
    expect(away100?.discoveryRoi).toBe(19.45);
    expect(away100?.oosRoi).toBe(-6.58); // Collapsed OOS
    expect(away100?.oosStatus).toBe('FAILED_OOS_DATA_MINED');
  });

  it('7. Model Validation & Benchmark Comparison: displays positive skill score over empirical baseline', () => {
    const mv = payload.modelValidation;
    expect(mv.sampleSize).toBe(760);
    expect(mv.brierScore).toBe(0.6088);
    expect(mv.baselineUniformBrier).toBe(0.6667);
    expect(mv.baselineHomeBiasBrier).toBe(0.612);
    expect(mv.brierSkillScore).toBe(0.52);
  });

  it('8. Multiple Testing Audit: exposes hypothesis count and survival summary', () => {
    const audit = payload.multipleTestingAudit;
    expect(audit.totalHypothesesTested).toBeGreaterThanOrEqual(100);
    expect(audit.holdoutSurvivalSummary).toContain('2 of 7 candidate rules');
  });

  it('9. Research Manifest: produces objective verdict based on data evidence', () => {
    const m = payload.manifest;
    expect(m.primaryBookmaker).toBe('Pinnacle');
    expect(m.stakingModel).toBe('1 Unit Flat Staking');
    expect(m.verdict).toBe('LOSS');
    expect(m.verdictExplanation).toContain('Unfiltered flat backing of HOME AH +0 is LOSS-MAKING');
  });
});
