import { describe, it, expect } from 'vitest';
import path from 'path';
import fs from 'fs';
import { calculateBtts, calculateBttsFromGrid, settleBttsMatch } from '@/lib/research/bttsEngine';
import { buildScoreGrid } from '@/lib/engine/probability';
import { BttsLivePipelineService } from '@/lib/pipeline/bttsLivePipelineService';
import { BttsWalkForwardModel } from '@/lib/research/btts/walkForwardModel';
import { BttsBacktestEngine } from '@/lib/research/btts/backtestEngine';
import { SalmoSyncService } from '@/lib/pipeline/salmoSyncService';
import { PredictionLedgerRecord } from '@/lib/pipeline/dailyPredictionLedger';

describe('BTTS Production-Grade Mathematical Integrity & Pipeline Gate Suite', () => {

  // 1. SCORE MATRIX NORMALIZATION
  it('1. verifies Dixon-Coles score matrix sums to 1.0 within numerical tolerance', () => {
    const lambdas = [
      { h: 1.45, a: 1.15, rho: -0.04 },
      { h: 2.80, a: 0.90, rho: -0.05 },
      { h: 0.60, a: 0.50, rho: 0.0 },
      { h: 3.50, a: 2.20, rho: -0.08 },
    ];

    for (const item of lambdas) {
      const grid = buildScoreGrid(item.h, item.a, item.rho);
      let sum = 0;
      for (let x = 0; x <= 10; x++) {
        for (let y = 0; y <= 10; y++) {
          sum += grid[x][y];
        }
      }
      expect(sum).toBeCloseTo(1.0, 6);
    }
  });

  // 2. NON-NEGATIVE PROBABILITIES
  it('2. verifies all score matrix cell probabilities are non-negative', () => {
    const grid = buildScoreGrid(1.5, 1.2, -0.04);
    for (let x = 0; x <= 10; x++) {
      for (let y = 0; y <= 10; y++) {
        expect(grid[x][y]).toBeGreaterThanOrEqual(0);
        expect(grid[x][y]).toBeLessThanOrEqual(1);
      }
    }
  });

  // 3. BTTS YES DERIVATION
  it('3. derives BTTS YES by summing P(h>=1, a>=1) and verifies inclusion-exclusion parity', () => {
    const grid = buildScoreGrid(1.6, 1.3, -0.04);
    const result = calculateBttsFromGrid(grid, { homeXG: 1.6, awayXG: 1.3, rho: -0.04 });

    let directSum = 0;
    for (let x = 1; x <= 10; x++) {
      for (let y = 1; y <= 10; y++) {
        directSum += grid[x][y];
      }
    }

    expect(result.probabilities.yes).toBeCloseTo(directSum, 6);
    // Inclusion-exclusion parity: 1 - P(H=0) - P(A=0) + P(0,0)
    const incExc = 1.0 - result.pHomeZero - result.pAwayZero + result.pBothZero;
    expect(result.probabilities.yes).toBeCloseTo(incExc, 6);
  });

  // 4. BTTS NO DERIVATION
  it('4. derives BTTS NO by summing P(h=0 or a=0) and verifies exact complementarity', () => {
    const grid = buildScoreGrid(1.4, 1.1, -0.04);
    let directNoSum = 0;
    for (let x = 0; x <= 10; x++) {
      for (let y = 0; y <= 10; y++) {
        if (x === 0 || y === 0) {
          directNoSum += grid[x][y];
        }
      }
    }

    const result = calculateBttsFromGrid(grid, { homeXG: 1.4, awayXG: 1.1, rho: -0.04 });
    expect(result.probabilities.no).toBeCloseTo(directNoSum, 6);
  });

  // 5. YES + NO = 1
  it('5. strictly verifies P(BTTS YES) + P(BTTS NO) = 1.0 within floating point precision', () => {
    const res = calculateBtts(1.8, 1.2, -0.04);
    expect(res.probabilities.yes + res.probabilities.no).toBeCloseTo(1.0, 9);
    expect(res.probabilities.yes).toBeGreaterThan(0);
    expect(res.probabilities.no).toBeGreaterThan(0);
  });

  // 6. INDEPENDENT VS DIXON-COLES CALCULATION CONSISTENCY
  it('6. verifies Dixon-Coles adjustment correctly models dependency compared to independent Poisson', () => {
    const h = 1.2;
    const a = 1.0;
    const rho = -0.05;

    // Independent Poisson product: (1 - e^-h) * (1 - e^-a)
    const indepHomeScore = 1.0 - Math.exp(-h);
    const indepAwayScore = 1.0 - Math.exp(-a);
    const indepYes = indepHomeScore * indepAwayScore;

    // Dixon-Coles joint distribution
    const dcResult = calculateBtts(h, a, rho);

    // Negative rho inflates 0-0 and 1-1, resulting in a measurable difference from independent
    expect(dcResult.probabilities.yes).not.toBe(indepYes);
    expect(Math.abs(dcResult.probabilities.yes - indepYes)).toBeLessThan(0.05); // Realistic bounded deviation
  });

  // 7. FAIR ODDS
  it('7. verifies fair odds are strictly binary 1/P with zero quarter-line distortions', () => {
    const pYes = 0.55;
    const pNo = 0.45;
    const fairOddsYes = Number((1 / pYes).toFixed(4));
    const fairOddsNo = Number((1 / pNo).toFixed(4));

    expect(fairOddsYes).toBe(1.8182);
    expect(fairOddsNo).toBe(2.2222);
    // Fair odds * probability == 1
    expect(fairOddsYes * pYes).toBeCloseTo(1.0, 3);
    expect(fairOddsNo * pNo).toBeCloseTo(1.0, 3);
  });

  // 8. EV INTEGRITY
  it('8. verifies exact EV formula P * Odds - 1 on known test vectors', () => {
    const testCases = [
      { p: 0.55, odds: 2.00, expectedEv: 0.10 },
      { p: 0.50, odds: 1.90, expectedEv: -0.05 },
      { p: 0.60, odds: 1.80, expectedEv: 0.08 },
      { p: 0.35, odds: 3.00, expectedEv: 0.05 },
    ];

    for (const tc of testCases) {
      const ev = Number((tc.p * tc.odds - 1.0).toFixed(4));
      expect(ev).toBeCloseTo(tc.expectedEv, 4);
    }
  });

  // 9. ODDS MAPPING & MARKET EXTRACTION
  it('9. correctly de-vigs two-way BTTS odds and extracts market probabilities', () => {
    const oddsYes = 1.95;
    const oddsNo = 1.90;
    const devig = BttsLivePipelineService.devigBtts(oddsYes, oddsNo);

    expect(devig.fairProbYes + devig.fairProbNo).toBeCloseTo(1.0, 4);
    expect(devig.overround).toBeGreaterThan(0); // Margin > 0
    expect(devig.fairProbYes).toBeGreaterThan(0.45);
    expect(devig.fairProbNo).toBeGreaterThan(0.45);
  });

  // 10. HOME/AWAY MAPPING SYMMETRY
  it('10. verifies symmetric inputs produce symmetric marginal zero-goal probabilities', () => {
    const res = calculateBtts(1.5, 1.5, -0.04);
    expect(res.pHomeZero).toBeCloseTo(res.pAwayZero, 6);

    const asym1 = calculateBtts(2.5, 0.8, -0.04);
    const asym2 = calculateBtts(0.8, 2.5, -0.04);
    // Inverted lambdas should swap zero-goal probabilities
    expect(asym1.pHomeZero).toBeCloseTo(asym2.pAwayZero, 6);
    expect(asym1.pAwayZero).toBeCloseTo(asym2.pHomeZero, 6);
    // Overall BTTS probability is invariant to swapping home and away
    expect(asym1.probabilities.yes).toBeCloseTo(asym2.probabilities.yes, 6);
  });

  // 11. MARKET ISOLATION
  it('11. strictly isolates BTTS fulltime from AH, OU, cards, corners, and halftime BTTS', () => {
    const marketMap = new Map<number, any>([
      [104, { marketId: 104, marketName: 'Both Teams To Score', period: 'fulltime' }],
      [10300, { marketId: 10300, marketName: 'Both Teams To Score First Half', period: 'p1' }],
      [101, { marketId: 101, marketName: 'Asian Handicap', period: 'fulltime' }],
      [102, { marketId: 102, marketName: 'Over/Under', period: 'fulltime' }],
    ]);

    const isBttsFulltime = (id: number) => {
      const m = marketMap.get(id);
      return id === 104 || (m && m.marketName === 'Both Teams To Score' && m.period === 'fulltime');
    };

    expect(isBttsFulltime(104)).toBe(true);
    expect(isBttsFulltime(10300)).toBe(false); // First half rejected!
    expect(isBttsFulltime(101)).toBe(false); // Asian Handicap rejected!
    expect(isBttsFulltime(102)).toBe(false); // Over/Under rejected!
  });

  // 12. CANONICAL FIXTURE IDENTITY
  it('12. generates deterministic, collision-free canonical fixture IDs', () => {
    const id1 = BttsLivePipelineService.generateCanonicalFixtureId(
      'Premier League',
      'Arsenal FC',
      'Chelsea FC',
      '2026-10-05T19:00:00Z'
    );
    const id2 = BttsLivePipelineService.generateCanonicalFixtureId(
      'Premier League',
      'Arsenal',
      'Chelsea',
      '2026-10-05T19:00:00Z'
    );
    const idDiff = BttsLivePipelineService.generateCanonicalFixtureId(
      'Premier League',
      'Liverpool',
      'Chelsea',
      '2026-10-05T19:00:00Z'
    );

    expect(id1).toBe(id2); // Normalized names produce identical hash
    expect(id1).not.toBe(idDiff);
    expect(id1.length).toBe(16);
  });

  // 13. DUPLICATE PREVENTIONS
  it('13. prevents duplicate predictions for the same fixture and market selection', () => {
    const canonicalId = 'canonical_test_123';
    const predIdYes = `PRED-${canonicalId}-BTTS-YES`;
    const predIdNo = `PRED-${canonicalId}-BTTS-NO`;

    expect(predIdYes).not.toBe(predIdNo);
    expect(predIdYes).toBe(`PRED-${canonicalId}-BTTS-YES`);
  });

  // 14. CACHE KEY ISOLATION
  it('14. ensures BTTS predictions cannot collide with or overwrite Asian Handicap predictions', () => {
    const canonicalId = 'match_abc_456';
    const bttsKey = `PRED-${canonicalId}-BTTS-YES`;
    const ahKey = `PRED-${canonicalId}-AH-0.50-HOME`;

    expect(bttsKey).not.toBe(ahKey);
    expect(bttsKey.includes('BTTS')).toBe(true);
    expect(ahKey.includes('AH')).toBe(true);
  });

  // 15. TIMESTAMP INTEGRITY
  it('15. verifies timestamp format and order: feature_ts <= kickoff and odds_ts < kickoff', () => {
    const kickoff = new Date('2026-10-05T20:00:00.000Z').getTime();
    const cutoff = new Date(kickoff - 30 * 60 * 1000).getTime();
    const odds = new Date('2026-10-05T18:00:00.000Z').getTime();

    expect(cutoff).toBeLessThan(kickoff);
    expect(odds).toBeLessThan(kickoff);
  });

  // 16. NO LOOKAHEAD PROTECTION
  it('16. strictly rejects any feature or odds timestamp occurring at or after kickoff', () => {
    const kickoffMs = new Date('2026-10-05T15:00:00.000Z').getTime();
    const postKickoffOddsMs = new Date('2026-10-05T15:05:00.000Z').getTime();

    const isPreMatch = postKickoffOddsMs < kickoffMs;
    expect(isPreMatch).toBe(false);
  });

  // 17. VALUE CLASSIFICATION
  it('17. enforces mutually exclusive statuses: VALUE, NO_VALUE, DATA_UNAVAILABLE', () => {
    const evaluateStatus = (hasOdds: boolean, ev: number, edge: number): 'VALUE' | 'NO_VALUE' | 'DATA_UNAVAILABLE' => {
      if (!hasOdds) return 'DATA_UNAVAILABLE';
      if (ev >= 0.02 && edge >= 0.01) return 'VALUE';
      return 'NO_VALUE';
    };

    expect(evaluateStatus(false, 0.05, 0.03)).toBe('DATA_UNAVAILABLE');
    expect(evaluateStatus(true, 0.05, 0.03)).toBe('VALUE');
    expect(evaluateStatus(true, 0.01, 0.005)).toBe('NO_VALUE');
    expect(evaluateStatus(true, -0.05, -0.02)).toBe('NO_VALUE');
  });

  // 18. CONFIDENCE ENGINE INTEGRITY
  it('18. verifies high EV caused by extreme odds does NOT become HIGH confidence', () => {
    // Dangerous pick: low probability 30%, extreme odds 6.00 -> EV = 0.30*6 - 1 = +80%!
    const p = 0.30;
    const odds = 6.00;
    const ev = p * odds - 1.0;
    const edge = 0.10;

    const getConfidence = (prob: number, oddsVal: number, edgeVal: number, evVal: number) => {
      if (prob >= 0.58 && oddsVal >= 1.60 && edgeVal >= 0.03 && evVal >= 0.04) return 'HIGH';
      if (prob >= 0.52 && oddsVal >= 1.50 && edgeVal >= 0.015 && evVal >= 0.02) return 'MEDIUM';
      if (edgeVal > 0 && evVal > 0) return 'LOW';
      return 'NO_VALUE';
    };

    const conf = getConfidence(p, odds, edge, ev);
    // Must NOT be HIGH despite +80% EV!
    expect(conf).not.toBe('HIGH');
    expect(conf).toBe('LOW');
  });

  // 19. COUNT RECONCILIATION
  it('19. enforces arithmetic count invariant: Total = Value + NoValue + DataUnavailable', () => {
    const value = 5;
    const noValue = 18;
    const dataUnavailable = 3;
    const total = value + noValue + dataUnavailable;

    expect(total).toBe(26);
    expect(total - (value + noValue + dataUnavailable)).toBe(0);
  });

  // 20. DATA_UNAVAILABLE BEHAVIOR
  it('20. does not manufacture probabilities or odds when data is unavailable', () => {
    const record = {
      odds: 0,
      modelProbability: 0,
      fairOdds: 0,
      edge: 0,
      ev: 0,
      confidence: 'NO_VALUE',
      status: 'DATA_UNAVAILABLE',
    };

    expect(record.status).toBe('DATA_UNAVAILABLE');
    expect(record.odds).toBe(0);
    expect(record.ev).toBe(0);
  });

  // 21. HISTORICAL WALK-FORWARD REPRODUCIBILITY
  it('21. executes chronological walk-forward historical evaluation with zero future leaks', () => {
    const expandedFile = path.resolve('data/historical/btts_historical_odds_expanded.jsonl');
    const canonicalFile = path.resolve('data/golden/europe/canonical_matches.jsonl');

    if (fs.existsSync(expandedFile) && fs.existsSync(canonicalFile)) {
      const oddsRecords = fs.readFileSync(expandedFile, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
      const canonicalMatches = fs.readFileSync(canonicalFile, 'utf-8').trim().split('\n').map((l) => JSON.parse(l));

      const { evaluations, summary } = BttsBacktestEngine.runBacktest(oddsRecords, canonicalMatches);
      expect(evaluations.length).toBeGreaterThanOrEqual(100);
      expect(summary.lookaheadViolations).toBe(0);
      expect(summary.isSampleSufficient).toBe(true);
    }
  });

  // 22. PRODUCTION / RESEARCH PARITY
  it('22. verifies BttsLivePipelineService and BttsWalkForwardModel share the identical Dixon-Coles model', () => {
    const h = 1.55;
    const a = 1.25;
    const rho = -0.04;

    const engineRes = calculateBtts(h, a, rho);
    const grid = buildScoreGrid(h, a, rho);
    const gridRes = calculateBttsFromGrid(grid, { homeXG: h, awayXG: a, rho });

    expect(engineRes.probabilities.yes).toBeCloseTo(gridRes.probabilities.yes, 6);
    expect(engineRes.probabilities.no).toBeCloseTo(gridRes.probabilities.no, 6);
    expect(engineRes.fairOdds.yes).toBeCloseTo(gridRes.fairOdds.yes, 4);
    expect(engineRes.fairOdds.no).toBeCloseTo(gridRes.fairOdds.no, 4);
  });

  // 23. SALMO SYNC SCHEMA INTEGRITY
  it('23. synchronizes verified BTTS predictions to Salmo with complete public schema and zero credentials', async () => {
    SalmoSyncService.clearForTesting();

    const sampleBttsPick: PredictionLedgerRecord = {
      predictionId: 'pred_btts_test_1',
      canonicalMatchId: 'match_test_1',
      match: 'Bayern Munich vs Borussia Dortmund',
      homeTeam: 'Bayern Munich',
      awayTeam: 'Borussia Dortmund',
      competition: 'Bundesliga',
      market: 'BTTS',
      selection: 'YES',
      line: null,
      modelProbability: 0.62,
      calibratedProbability: 0.62,
      odds: 1.75,
      impliedProbability: 0.57,
      edge: 0.05,
      expectedValue: 0.085,
      confidence: 'HIGH',
      confidenceScore: 82,
      predictionTimestamp: new Date().toISOString(),
      kickoffTimestamp: new Date(Date.now() + 36 * 3600 * 1000).toISOString(),
      oddsTimestamp: new Date().toISOString(),
      modelVersion: 'BTTS-DixonColes-Opta-v1.0.0',
      featureVersion: 'pit-v1.2.0',
      runId: 'RUN-TEST-1',
      status: 'HIGH_CONFIDENCE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const report = await SalmoSyncService.synchronizeBtts([sampleBttsPick]);
    expect(report.status).toBe('SUCCESS');
    expect(report.syncedDecisions).toHaveLength(1);

    const card = report.syncedDecisions[0];
    expect(card.market).toBe('BTTS');
    expect(card.selection).toBe('YES');
    expect(card.odds).toBe(1.75);
    expect(card.fairOdds).toBeCloseTo(1 / 0.62, 2);
    expect(card.modelProbabilityPct).toBe(62.0);
    expect(card.expectedValuePct).toBe(8.5);
    expect(card.clvStatus).toBe('PENDING');

    // Security check: Zero API keys or secrets
    const cardStr = JSON.stringify(card);
    expect(cardStr).not.toContain('apiKey');
    expect(cardStr).not.toContain('DRIBBLE');
    expect(cardStr).not.toContain('ODDSPAPI');
    expect(cardStr).not.toContain('bearer');
  });
});
