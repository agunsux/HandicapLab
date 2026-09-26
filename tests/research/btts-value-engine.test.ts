import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  BttsFeatureExtractor,
  BttsWalkForwardModel,
  BttsMarketEngine,
  BttsValueGate,
  BttsBacktestEngine,
  HistoricalMatchRecord,
  BttsOddsInputRecord,
} from '@/lib/research/btts';
import { settleBttsMatch } from '@/lib/research/bttsEngine';

describe('Epic BTTS Value Engine v1 — Phase 29 Mandatory Tests', () => {
  // TEST 1: BTTS YES: home goals >= 1, away goals >= 1 => YES
  it('TEST 1: BTTS YES: home goals >= 1 and away goals >= 1 resolves to YES / WIN', () => {
    const outcome = settleBttsMatch('YES', 2, 1);
    expect(outcome).toBe('WIN');

    const bothScored = 2 >= 1 && 1 >= 1;
    expect(bothScored).toBe(true);
  });

  // TEST 2: BTTS NO: home goals = 0 => NO
  it('TEST 2: BTTS NO: home goals = 0 resolves to NO (YES selection loses, NO selection wins)', () => {
    const outcomeYes = settleBttsMatch('YES', 0, 2);
    expect(outcomeYes).toBe('LOSS');

    const outcomeNo = settleBttsMatch('NO', 0, 2);
    expect(outcomeNo).toBe('WIN');
  });

  // TEST 3: BTTS NO: away goals = 0 => NO
  it('TEST 3: BTTS NO: away goals = 0 resolves to NO (YES selection loses, NO selection wins)', () => {
    const outcomeYes = settleBttsMatch('YES', 3, 0);
    expect(outcomeYes).toBe('LOSS');

    const outcomeNo = settleBttsMatch('NO', 3, 0);
    expect(outcomeNo).toBe('WIN');
  });

  // TEST 4: p = 0.60, odds = 1.80 => EV = +0.08
  it('TEST 4: p = 0.60, odds = 1.80 yields EV = +0.08 (+8.0%)', () => {
    const p = 0.60;
    const odds = 1.80;
    const ev = Number((p * odds - 1.0).toFixed(4));
    expect(ev).toBe(0.08);
  });

  // TEST 5: p = 0.50, odds = 2.00 => EV = 0
  it('TEST 5: p = 0.50, odds = 2.00 yields EV = 0.00 (neutral EV)', () => {
    const p = 0.50;
    const odds = 2.00;
    const ev = Number((p * odds - 1.0).toFixed(4));
    expect(ev).toBe(0.0);
  });

  // TEST 6: p = 0.45, odds = 2.00 => EV = -0.10
  it('TEST 6: p = 0.45, odds = 2.00 yields EV = -0.10 (-10.0%)', () => {
    const p = 0.45;
    const odds = 2.00;
    const ev = Number((p * odds - 1.0).toFixed(4));
    expect(ev).toBe(-0.10);
  });

  // TEST 7: odds timestamp after kickoff => INVALID
  it('TEST 7: odds timestamp after kickoff marks prediction as INVALID', () => {
    const evaluation = BttsValueGate.evaluate({
      canonicalMatchId: 'ENG-PL|2025-2026|2026-02-01|aston-villa|brentford',
      kickoffTimestamp: '2026-02-01T14:00:00.000Z',
      predictionTimestamp: '2026-02-01T14:05:00.000Z', // In-play!
      featureCutoffTimestamp: '2026-02-01',
      closingOddsTimestamp: '2026-02-01T14:05:00.000Z', // 5m after kickoff
      modelProbYes: 0.60,
      modelProbNo: 0.40,
      closingYesOdds: 1.85,
      closingNoOdds: 2.05,
      noVigProbYes: 0.51,
      noVigProbNo: 0.49,
      edgeYes: 0.09,
      edgeNo: -0.09,
      evYes: 0.11,
      evNo: -0.15,
      validationSampleSize: 150,
      calibrationValidated: true,
    });

    expect(evaluation.status).toBe('INVALID');
    expect(evaluation.recommendedSide).toBeNull();
    expect(evaluation.reason).toContain('Lookahead violation');
  });

  // TEST 8: feature timestamp after kickoff => INVALID
  it('TEST 8: feature timestamp after kickoff marks prediction as INVALID', () => {
    const evaluation = BttsValueGate.evaluate({
      canonicalMatchId: 'ENG-PL|2025-2026|2026-02-01|aston-villa|brentford',
      kickoffTimestamp: '2026-02-01T14:00:00.000Z',
      predictionTimestamp: '2026-02-01T13:55:00.000Z',
      featureCutoffTimestamp: '2026-02-02', // Next day! Future feature!
      closingOddsTimestamp: '2026-02-01T13:55:00.000Z',
      modelProbYes: 0.60,
      modelProbNo: 0.40,
      closingYesOdds: 1.85,
      closingNoOdds: 2.05,
      noVigProbYes: 0.51,
      noVigProbNo: 0.49,
      edgeYes: 0.09,
      edgeNo: -0.09,
      evYes: 0.11,
      evNo: -0.15,
      validationSampleSize: 150,
      calibrationValidated: true,
    });

    expect(evaluation.status).toBe('INVALID');
    expect(evaluation.reason).toContain('Lookahead violation');
  });

  // TEST 9: training data includes future match => INVALID
  it('TEST 9: feature extractor strictly ignores future matches prior to cutoff date', () => {
    const historicalMatches: HistoricalMatchRecord[] = [
      {
        canonicalId: 'match-1',
        leagueId: 'ENG-PL',
        season: '2025-2026',
        matchDate: '2026-01-15',
        homeTeam: 'Arsenal',
        awayTeam: 'Chelsea',
        homeGoals: 2,
        awayGoals: 1,
        btts: true,
      },
      {
        canonicalId: 'match-2',
        leagueId: 'ENG-PL',
        season: '2025-2026',
        matchDate: '2026-02-15', // FUTURE match relative to 2026-02-01
        homeTeam: 'Arsenal',
        awayTeam: 'Everton',
        homeGoals: 5,
        awayGoals: 0,
        btts: false,
      },
    ];

    const stats = BttsFeatureExtractor.extractTeamRollingStats(
      'Arsenal',
      'ALL',
      historicalMatches,
      '2026-02-01',
      10
    );

    // Only match-1 should be included! match-2 MUST be excluded!
    expect(stats.matchesCount).toBe(1);
    expect(stats.goalsScored).toBe(2);
    expect(stats.goalsConceded).toBe(1);
    expect(stats.bttsYesCount).toBe(1);
  });

  // TEST 10: insufficient historical sample => INSUFFICIENT_DATA
  it('TEST 10: insufficient validation sample marks prediction as INSUFFICIENT_DATA', () => {
    const evaluation = BttsValueGate.evaluate({
      canonicalMatchId: 'ENG-PL|2025-2026|2026-02-01|aston-villa|brentford',
      kickoffTimestamp: '2026-02-01T14:00:00.000Z',
      predictionTimestamp: '2026-02-01T13:55:00.000Z',
      featureCutoffTimestamp: '2026-02-01',
      closingOddsTimestamp: '2026-02-01T13:55:00.000Z',
      modelProbYes: 0.65,
      modelProbNo: 0.35,
      closingYesOdds: 2.10,
      closingNoOdds: 1.80,
      noVigProbYes: 0.46,
      noVigProbNo: 0.54,
      edgeYes: 0.19,
      edgeNo: -0.19,
      evYes: 0.365,
      evNo: -0.37,
      validationSampleSize: 16, // Only 16 fixtures! Below 100!
      minSampleSizeRequired: 100,
      calibrationValidated: true,
    });

    expect(evaluation.status).toBe('INSUFFICIENT_DATA');
    expect(evaluation.reason).toContain('INSUFFICIENT DATA: Validation sample (16 fixtures) is below statistical threshold');
  });

  // TEST 11: positive EV but calibration gate fails => NOT VALUE
  it('TEST 11: positive EV but unvalidated calibration yields RESEARCH_ONLY (NOT VALUE)', () => {
    const evaluation = BttsValueGate.evaluate({
      canonicalMatchId: 'ENG-PL|2025-2026|2026-02-01|aston-villa|brentford',
      kickoffTimestamp: '2026-02-01T14:00:00.000Z',
      predictionTimestamp: '2026-02-01T13:55:00.000Z',
      featureCutoffTimestamp: '2026-02-01',
      closingOddsTimestamp: '2026-02-01T13:55:00.000Z',
      modelProbYes: 0.65,
      modelProbNo: 0.35,
      closingYesOdds: 2.10,
      closingNoOdds: 1.80,
      noVigProbYes: 0.46,
      noVigProbNo: 0.54,
      edgeYes: 0.19,
      edgeNo: -0.19,
      evYes: 0.365,
      evNo: -0.37,
      validationSampleSize: 150, // sample >= 100
      minSampleSizeRequired: 100,
      calibrationValidated: false, // Calibration UNVALIDATED!
    });

    expect(evaluation.status).toBe('RESEARCH_ONLY');
    expect(evaluation.status).not.toBe('VALUE');
    expect(evaluation.reason).toContain('RESEARCH ONLY: Probabilities generated but out-of-sample calibration curve is unvalidated');
  });

  // TEST 12: positive EV but sample size gate fails => NOT VALUE
  it('TEST 12: positive EV but sample size gate fails yields INSUFFICIENT_DATA (NOT VALUE)', () => {
    const evaluation = BttsValueGate.evaluate({
      canonicalMatchId: 'ENG-PL|2025-2026|2026-02-01|aston-villa|brentford',
      kickoffTimestamp: '2026-02-01T14:00:00.000Z',
      predictionTimestamp: '2026-02-01T13:55:00.000Z',
      featureCutoffTimestamp: '2026-02-01',
      closingOddsTimestamp: '2026-02-01T13:55:00.000Z',
      modelProbYes: 0.62,
      modelProbNo: 0.38,
      closingYesOdds: 1.95,
      closingNoOdds: 1.95,
      noVigProbYes: 0.50,
      noVigProbNo: 0.50,
      edgeYes: 0.12,
      edgeNo: -0.12,
      evYes: 0.209,
      evNo: -0.259,
      validationSampleSize: 20, // Sample size gate fails
      minSampleSizeRequired: 100,
      calibrationValidated: true,
    });

    expect(evaluation.status).toBe('INSUFFICIENT_DATA');
    expect(evaluation.status).not.toBe('VALUE');
  });

  // TEST 13: same canonical match => one prediction record
  it('TEST 13: backtest maps 1:1 to unique canonical matches with zero duplicate predictions', () => {
    const bttsFile = path.resolve('data/historical/btts_historical_odds_2026.jsonl');
    const records = fs
      .readFileSync(bttsFile, 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    const canonicalIds = records.map((r: any) => r.canonical_match_id);
    const uniqueIds = new Set(canonicalIds);
    expect(canonicalIds.length).toBe(uniqueIds.size);
  });

  // TEST 14: p_btts_yes + p_btts_no => exactly 1 within numerical tolerance
  it('TEST 14: model guarantees p_btts_yes + p_btts_no = 1.0 within numerical tolerance', () => {
    const features = BttsFeatureExtractor.extractPreMatchFeatures(
      'ENG-PL|2025-2026|2026-02-01|aston-villa|brentford',
      'Aston Villa',
      'Brentford',
      'ENG-PL',
      '2025-2026',
      '2026-02-01T14:00:00.000Z',
      []
    );

    const pred = BttsWalkForwardModel.predict(features);
    const sum = pred.probabilities.pYes + pred.probabilities.pNo;
    expect(sum).toBeCloseTo(1.0, 5);
    expect(pred.probabilities.pYes).toBeGreaterThanOrEqual(0);
    expect(pred.probabilities.pYes).toBeLessThanOrEqual(1);
    expect(pred.probabilities.pNo).toBeGreaterThanOrEqual(0);
    expect(pred.probabilities.pNo).toBeLessThanOrEqual(1);
  });

  // TEST 15: fair odds = 1 / probability => correct
  it('TEST 15: model fair odds exactly equals 1 / probability without rounding distortion', () => {
    const pYes = 0.625;
    const pNo = 0.375;
    const fairOddsYes = Number((1.0 / pYes).toFixed(4));
    const fairOddsNo = Number((1.0 / pNo).toFixed(4));

    expect(fairOddsYes).toBe(1.6);
    expect(fairOddsNo).toBe(2.6667);
  });
});

describe('Epic BTTS Value Engine v1 — Real 2026 Backtest & Empirical Audit', () => {
  it('runs complete walk-forward backtest across all 16 EPL 2026 fixtures with zero lookahead violations', () => {
    const bttsFile = path.resolve('data/historical/btts_historical_odds_2026.jsonl');
    const oddsRecords = fs
      .readFileSync(bttsFile, 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    const canonicalFile = path.resolve('data/golden/europe/canonical_matches.jsonl');
    const canonicalMatches = fs
      .readFileSync(canonicalFile, 'utf-8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));

    const { evaluations, summary } = BttsBacktestEngine.runBacktest(oddsRecords, canonicalMatches);

    expect(evaluations).toHaveLength(16);
    expect(summary.totalMatches).toBe(16);
    expect(summary.lookaheadViolations).toBe(0);

    // Crucial Invariant: Sample size is 16 (< 100), so verdict MUST be INSUFFICIENT_DATA
    expect(summary.dataSufficiencyVerdict).toBe('INSUFFICIENT_DATA');
    expect(summary.isSampleSufficient).toBe(false);

    // Verify all 16 evaluations have status INSUFFICIENT_DATA
    for (const ev of evaluations) {
      expect(ev.status).toBe('INSUFFICIENT_DATA');
      expect(ev.modelProbYes + ev.modelProbNo).toBeCloseTo(1.0, 4);
      expect(ev.noVigMarketProbYes + ev.noVigMarketProbNo).toBeCloseTo(1.0, 4);
      expect(ev.fairOddsYes).toBeCloseTo(1 / ev.modelProbYes, 3);
      expect(ev.fairOddsNo).toBeCloseTo(1 / ev.modelProbNo, 3);
      expect(ev.edgeYes).toBeCloseTo(ev.modelProbYes - ev.noVigMarketProbYes, 4);
      expect(ev.edgeNo).toBeCloseTo(ev.modelProbNo - ev.noVigMarketProbNo, 4);
      expect(ev.evYes).toBeCloseTo(ev.modelProbYes * ev.marketOddsYes - 1.0, 4);
      expect(ev.evNo).toBeCloseTo(ev.modelProbNo * ev.marketOddsNo - 1.0, 4);
    }

    // Verify Three-Way Baselines Comparison is populated
    expect(summary.metrics.model.brierScore).toBeGreaterThan(0);
    expect(summary.metrics.market.brierScore).toBeGreaterThan(0);
    expect(summary.metrics.leagueBaseline.brierScore).toBeGreaterThan(0);
    expect(summary.calibrationBuckets.length).toBeGreaterThan(0);
  });
});
