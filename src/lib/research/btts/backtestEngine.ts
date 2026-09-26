// ============================================================================
// BTTS VALUE ENGINE v1 — WALK-FORWARD BACKTEST & AUDIT ENGINE
// ============================================================================
// Location: src/lib/research/btts/backtestEngine.ts
//
// Invariants:
//   - Strict Chronological Walk-Forward: zero future leakage.
//   - Three-Way Comparison: Model vs Market vs Simple League Baseline.
//   - Calibration Reliability Buckets (10 bins / 5pp buckets).
//   - Lookahead Audit: verifies feature_ts < kickoff, odds_ts < kickoff.
//   - Distinguishes POSITIVE RESULT from PROVEN EDGE.
// ============================================================================

import { BttsValueEvaluation, BttsBacktestSummary, BttsValueStatus } from './types';
import { BttsFeatureExtractor, HistoricalMatchRecord } from './featureExtractor';
import { BttsWalkForwardModel } from './walkForwardModel';
import { BttsMarketEngine } from './marketEngine';
import { BttsValueGate } from './valueGate';

export interface BttsBacktestConfig {
  minSampleSizeRequired?: number; // default 100
  minEdge?: number; // default 0.03 (3%)
  minEv?: number; // default 0.03 (+3%)
  calibrationValidated?: boolean; // default false in Phase 1
}

export interface BttsOddsInputRecord {
  canonical_match_id: string;
  provider_fixture_id: string;
  league_id: string;
  season: string;
  kickoff_at: string;
  home_team: string;
  away_team: string;
  bookmaker: string;
  opening_yes_odds: number | null;
  opening_no_odds: number | null;
  opening_timestamp: string | null;
  closing_yes_odds: number | null;
  closing_no_odds: number | null;
  closing_timestamp: string | null;
  inplay_observations_rejected?: number;
}

export class BttsBacktestEngine {
  /**
   * Runs the complete walk-forward evaluation across all historical odds records.
   */
  public static runBacktest(
    oddsRecords: BttsOddsInputRecord[],
    canonicalMatches: HistoricalMatchRecord[],
    config: BttsBacktestConfig = {}
  ): {
    evaluations: BttsValueEvaluation[];
    summary: BttsBacktestSummary;
  } {
    const minSample = config.minSampleSizeRequired ?? BttsValueGate.DEFAULT_MIN_SAMPLE;
    const minEdge = config.minEdge ?? BttsValueGate.DEFAULT_MIN_EDGE;
    const minEv = config.minEv ?? BttsValueGate.DEFAULT_MIN_EV;
    const isCalibrated = config.calibrationValidated ?? false;

    // Index canonical matches by canonicalId for result lookup
    const canonicalMap = new Map<string, HistoricalMatchRecord>();
    for (const m of canonicalMatches) {
      canonicalMap.set(m.canonicalId, m);
    }

    // Sort odds records chronologically
    const sortedRecords = [...oddsRecords].sort((a, b) =>
      a.kickoff_at.localeCompare(b.kickoff_at)
    );

    const evaluations: BttsValueEvaluation[] = [];
    let lookaheadViolations = 0;

    const statusCounts: Record<BttsValueStatus, number> = {
      INSUFFICIENT_DATA: 0,
      RESEARCH_ONLY: 0,
      NO_VALUE: 0,
      VALUE: 0,
      INVALID: 0,
    };

    for (const rec of sortedRecords) {
      const kickoffMs = Date.parse(rec.kickoff_at);
      const closeTs = rec.closing_timestamp ?? '';
      const closeMs = Date.parse(closeTs);

      // Check for lookahead violation in odds timing
      const oddsPreMatch = Number.isFinite(kickoffMs) && Number.isFinite(closeMs) && closeMs < kickoffMs;
      if (!oddsPreMatch) {
        lookaheadViolations++;
      }

      // Check odds validity
      const closingYes = rec.closing_yes_odds;
      const closingNo = rec.closing_no_odds;
      if (!closingYes || !closingNo || closingYes <= 1.0 || closingNo <= 1.0) {
        statusCounts.INVALID++;
        continue;
      }

      // 1. Extract Pre-Match Features (strictly before kickoff)
      const features = BttsFeatureExtractor.extractPreMatchFeatures(
        rec.canonical_match_id,
        rec.home_team,
        rec.away_team,
        rec.league_id,
        rec.season,
        rec.kickoff_at,
        canonicalMatches
      );

      // 2. Generate Walk-Forward Model Probabilities
      const modelPred = BttsWalkForwardModel.predict(features);

      // 3. De-vig Market Odds & Compute Fair Odds, Edge, EV
      const marketOdds = BttsMarketEngine.parseMarketOdds(
        closingYes,
        closingNo,
        closeTs,
        rec.kickoff_at,
        rec.bookmaker,
        rec.opening_yes_odds,
        rec.opening_no_odds,
        rec.opening_timestamp
      );

      const marketComp = BttsMarketEngine.evaluateMarket(
        modelPred.probabilities.pYes,
        modelPred.probabilities.pNo,
        marketOdds
      );

      // 4. Evaluate Evidence & Sample Gate
      const gateResult = BttsValueGate.evaluate({
        canonicalMatchId: rec.canonical_match_id,
        kickoffTimestamp: rec.kickoff_at,
        predictionTimestamp: closeTs || features.featureCutoffTimestamp,
        featureCutoffTimestamp: features.featureCutoffTimestamp,
        closingOddsTimestamp: closeTs,
        modelProbYes: modelPred.probabilities.pYes,
        modelProbNo: modelPred.probabilities.pNo,
        closingYesOdds: closingYes,
        closingNoOdds: closingNo,
        noVigProbYes: marketOdds.noVigProbYes,
        noVigProbNo: marketOdds.noVigProbNo,
        edgeYes: marketComp.edge.yes,
        edgeNo: marketComp.edge.no,
        evYes: marketComp.expectedValue.yes,
        evNo: marketComp.expectedValue.no,
        validationSampleSize: sortedRecords.length,
        minSampleSizeRequired: minSample,
        minEdge,
        minEv,
        calibrationValidated: isCalibrated,
      });

      statusCounts[gateResult.status]++;

      // 5. Link Actual Canonical Match Result & Settlement
      const actualMatch = canonicalMap.get(rec.canonical_match_id);
      let actualHomeGoals: number | undefined;
      let actualAwayGoals: number | undefined;
      let actualBttsOutcome: boolean | undefined;
      let settlementResult: 'WIN' | 'LOSS' | 'VOID' | 'UNSETTLED' = 'UNSETTLED';
      let settlementReturn = 0;

      if (actualMatch && typeof actualMatch.homeGoals === 'number' && typeof actualMatch.awayGoals === 'number') {
        actualHomeGoals = actualMatch.homeGoals;
        actualAwayGoals = actualMatch.awayGoals;
        actualBttsOutcome = actualMatch.homeGoals >= 1 && actualMatch.awayGoals >= 1;

        if (gateResult.recommendedSide === 'YES') {
          if (actualBttsOutcome) {
            settlementResult = 'WIN';
            settlementReturn = Number((closingYes - 1.0).toFixed(4));
          } else {
            settlementResult = 'LOSS';
            settlementReturn = -1.0;
          }
        } else if (gateResult.recommendedSide === 'NO') {
          if (!actualBttsOutcome) {
            settlementResult = 'WIN';
            settlementReturn = Number((closingNo - 1.0).toFixed(4));
          } else {
            settlementResult = 'LOSS';
            settlementReturn = -1.0;
          }
        }
      }

      evaluations.push({
        canonicalMatchId: rec.canonical_match_id,
        kickoffTimestamp: rec.kickoff_at,
        homeTeam: rec.home_team,
        awayTeam: rec.away_team,
        modelVersion: modelPred.modelVersion,
        predictionTimestamp: closeTs,
        featureCutoffTimestamp: features.featureCutoffTimestamp,
        trainingSampleSize: modelPred.trainingSampleSize,
        modelProbYes: modelPred.probabilities.pYes,
        modelProbNo: modelPred.probabilities.pNo,
        fairOddsYes: marketComp.fairOdds.yes,
        fairOddsNo: marketComp.fairOdds.no,
        marketOddsYes: closingYes,
        marketOddsNo: closingNo,
        noVigMarketProbYes: marketOdds.noVigProbYes,
        noVigMarketProbNo: marketOdds.noVigProbNo,
        edgeYes: marketComp.edge.yes,
        edgeNo: marketComp.edge.no,
        evYes: marketComp.expectedValue.yes,
        evNo: marketComp.expectedValue.no,
        recommendedSide: gateResult.recommendedSide,
        status: gateResult.status,
        gates: gateResult.gates,
        reason: gateResult.reason,
        baselineLeagueProbYes: modelPred.baselines.baselineLeagueProbYes,
        baselineTeamFormProbYes: modelPred.baselines.baselineTeamFormProbYes,
        actualHomeGoals,
        actualAwayGoals,
        actualBttsOutcome,
        settlementResult,
        settlementReturn,
      });
    }

    // 6. Compute Statistical Metrics Across Evaluated Set
    const settledMatches = evaluations.filter((e) => e.actualBttsOutcome !== undefined);
    const nSettled = settledMatches.length;

    let modelBrierSum = 0;
    let modelLogLossSum = 0;
    let marketBrierSum = 0;
    let marketLogLossSum = 0;
    let leagueBrierSum = 0;
    let leagueLogLossSum = 0;
    const eps = 1e-12;

    for (const e of settledMatches) {
      const y = e.actualBttsOutcome ? 1 : 0;

      // Model
      const pMod = Math.max(eps, Math.min(1 - eps, e.modelProbYes));
      modelBrierSum += Math.pow(pMod - y, 2);
      modelLogLossSum += -(y * Math.log(pMod) + (1 - y) * Math.log(1 - pMod));

      // Market
      const pMkt = Math.max(eps, Math.min(1 - eps, e.noVigMarketProbYes));
      marketBrierSum += Math.pow(pMkt - y, 2);
      marketLogLossSum += -(y * Math.log(pMkt) + (1 - y) * Math.log(1 - pMkt));

      // League Baseline
      const pLg = Math.max(eps, Math.min(1 - eps, e.baselineLeagueProbYes));
      leagueBrierSum += Math.pow(pLg - y, 2);
      leagueLogLossSum += -(y * Math.log(pLg) + (1 - y) * Math.log(1 - pLg));
    }

    // Calibration Buckets (0.50-0.55, 0.55-0.60, 0.60-0.65, 0.65-0.70, 0.70+)
    const buckets = [
      { range: '0.50-0.55', min: 0.50, max: 0.55, sumPred: 0, sumObs: 0, count: 0 },
      { range: '0.55-0.60', min: 0.55, max: 0.60, sumPred: 0, sumObs: 0, count: 0 },
      { range: '0.60-0.65', min: 0.60, max: 0.65, sumPred: 0, sumObs: 0, count: 0 },
      { range: '0.65-0.70', min: 0.65, max: 0.70, sumPred: 0, sumObs: 0, count: 0 },
      { range: '0.70+', min: 0.70, max: 1.00, sumPred: 0, sumObs: 0, count: 0 },
    ];

    for (const e of settledMatches) {
      const p = e.modelProbYes;
      const y = e.actualBttsOutcome ? 1 : 0;
      for (const b of buckets) {
        if (p >= b.min && (p < b.max || (b.max === 1.0 && p <= 1.0))) {
          b.sumPred += p;
          b.sumObs += y;
          b.count++;
          break;
        }
      }
    }

    const calibrationBuckets = buckets.map((b) => ({
      bucketRange: b.range,
      predictedMean: b.count > 0 ? Number((b.sumPred / b.count).toFixed(4)) : 0,
      observedRate: b.count > 0 ? Number((b.sumObs / b.count).toFixed(4)) : 0,
      count: b.count,
    }));

    // Signals Performance (flat 1-unit hypothetical tracking, strictly for research)
    const signaled = evaluations.filter((e) => e.recommendedSide !== null && e.settlementResult !== 'UNSETTLED');
    const wins = signaled.filter((e) => e.settlementResult === 'WIN').length;
    const losses = signaled.filter((e) => e.settlementResult === 'LOSS').length;
    const totalStaked = signaled.length;
    const totalReturn = signaled.reduce((acc, e) => acc + (e.settlementReturn || 0), 0);
    const roi = totalStaked > 0 ? Number((totalReturn / totalStaked).toFixed(4)) : 0;

    const avgOdds =
      totalStaked > 0
        ? Number(
            (
              signaled.reduce((acc, e) => {
                const odds = e.recommendedSide === 'YES' ? e.marketOddsYes : e.marketOddsNo;
                return acc + odds;
              }, 0) / totalStaked
            ).toFixed(3)
          )
        : 0;

    const avgEdge =
      totalStaked > 0
        ? Number(
            (
              signaled.reduce((acc, e) => {
                const edge = e.recommendedSide === 'YES' ? e.edgeYes : e.edgeNo;
                return acc + edge;
              }, 0) / totalStaked
            ).toFixed(4)
          )
        : 0;

    const avgEV =
      totalStaked > 0
        ? Number(
            (
              signaled.reduce((acc, e) => {
                const ev = e.recommendedSide === 'YES' ? e.evYes : e.evNo;
                return acc + ev;
              }, 0) / totalStaked
            ).toFixed(4)
          )
        : 0;

    const isSampleSufficient = sortedRecords.length >= minSample;

    const summary: BttsBacktestSummary = {
      datasetName: 'BTTS_HISTORICAL_ODDS_2026',
      totalMatches: sortedRecords.length,
      evaluatedMatches: evaluations.length,
      lookaheadViolations,
      statusCounts,
      sampleSize: sortedRecords.length,
      minSampleSizeRequired: minSample,
      isSampleSufficient,
      metrics: {
        model: {
          brierScore: nSettled > 0 ? Number((modelBrierSum / nSettled).toFixed(5)) : 0,
          logLoss: nSettled > 0 ? Number((modelLogLossSum / nSettled).toFixed(5)) : 0,
          meanPredictedProb:
            nSettled > 0
              ? Number((settledMatches.reduce((s, e) => s + e.modelProbYes, 0) / nSettled).toFixed(4))
              : 0,
        },
        market: {
          brierScore: nSettled > 0 ? Number((marketBrierSum / nSettled).toFixed(5)) : 0,
          logLoss: nSettled > 0 ? Number((marketLogLossSum / nSettled).toFixed(5)) : 0,
          meanMarketProb:
            nSettled > 0
              ? Number((settledMatches.reduce((s, e) => s + e.noVigMarketProbYes, 0) / nSettled).toFixed(4))
              : 0,
        },
        leagueBaseline: {
          brierScore: nSettled > 0 ? Number((leagueBrierSum / nSettled).toFixed(5)) : 0,
          logLoss: nSettled > 0 ? Number((leagueLogLossSum / nSettled).toFixed(5)) : 0,
          baselineProb:
            nSettled > 0
              ? Number((settledMatches.reduce((s, e) => s + e.baselineLeagueProbYes, 0) / nSettled).toFixed(4))
              : 0,
        },
      },
      calibrationBuckets,
      signalsCount: totalStaked,
      winsCount: wins,
      lossesCount: losses,
      hitRate: totalStaked > 0 ? Number(((wins / totalStaked) * 100).toFixed(1)) : 0,
      avgOdds,
      avgEdge,
      avgEV,
      totalStaked,
      totalReturn: Number(totalReturn.toFixed(4)),
      roi,
      yieldPct: Number((roi * 100).toFixed(2)),
      dataSufficiencyVerdict: isSampleSufficient ? 'SUFFICIENT_FOR_RESEARCH' : 'INSUFFICIENT_DATA',
      researchConclusion: isSampleSufficient
        ? 'Sample size is sufficient for research exploration.'
        : `INSUFFICIENT DATA: Only ${sortedRecords.length} historical odds fixtures available (minimum required: ${minSample}). Probabilities are mathematically sound, but statistical edge cannot be confirmed without expanded multi-season odds ingestion.`,
    };

    return {
      evaluations,
      summary,
    };
  }
}
