// ============================================================================
// PREDICTION DENSITY & MULTI-MARKET OPTIMIZATION ENGINE
// ============================================================================
// Location: src/lib/quota/predictionDensityEngine.ts
//
// Invariants enforced (Section 5, 9, 10, 11, 12, 14, 15):
// 1. Maximizes qualified predictions unlocked per OddsPAPI request.
//    (A single request can unlock 3-7 independent predictions across AH, OU, BTTS).
// 2. Settlement-Aware EV Calculation:
//    - Binary & Half-line: EV = P(win) * odds - 1
//    - Full-line: EV = P(win) * (odds - 1) - P(loss)
//    - Quarter-line: EV = P(win) * (odds - 1) + P(half_win) * 0.5 * (odds - 1) - P(half_loss) * 0.5 - P(loss) * 1.0
// 3. Multi-market coverage:
//    - Asian Handicap (-0.25, -0.5, -0.75, -1.0, +0.25, +0.5, +0.75, +1.0)
//    - Totals / Over/Under line family (1.0, 1.5, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, 4.0)
//    - BTTS (YES, NO)
// 4. Density & Efficiency Telemetry tracking KPIs:
//    - predictionsUnlockedPerRequest
//    - positiveEVPredictionsPerRequest
//    - expectedPnLPerRequest
//    - quotaEfficiency
// ============================================================================

import { classifyLineType } from '@/lib/ledger/canonicalBetLedger';
import { MarketType, LineType } from '@/lib/ledger/predictionLedgerTypes';

export interface MarketProbabilityDistribution {
  pWin: number;
  pHalfWin?: number;
  pPush?: number;
  pHalfLoss?: number;
  pLoss: number;
}

export interface MarketCandidateInput {
  market: MarketType;
  selection: string;
  line: number | null;
  marketOdds: number;
  probabilities: MarketProbabilityDistribution;
  confidenceScore: number; // 0..100
  fairOdds?: number;
}

export interface EvaluatedMarketPrediction {
  market: MarketType;
  selection: string;
  line: number | null;
  lineType: LineType;
  marketOdds: number;
  modelProbability: number;
  fairOdds: number;
  expectedValue: number; // Settlement-aware EV
  expectedYield: number; // EV expressed as percentage
  edge: number; // modelProbability - marketImpliedProbability
  confidenceScore: number;
  probabilities: MarketProbabilityDistribution;
  isPositiveEv: boolean;
}

export interface FixtureMarketExpansion {
  canonicalMatchId: string;
  fixture: string;
  competition: string;
  kickoffUtc: string;
  oddsTimestampUtc: string;
  bookmaker: string;
  provider: string;
  candidates: EvaluatedMarketPrediction[];
  qualifiedPositiveEvPredictions: EvaluatedMarketPrediction[];
  predictionsUnlockedCount: number;
  totalExpectedValueUnlocked: number;
}

export interface PredictionDensityTelemetry {
  requestsConsumed: number;
  fixturesRefreshed: number;
  marketsRefreshed: number;
  qualifiedPredictions: number;
  positiveEVPredictions: number;
  predictionsPerRequest: number;
  positiveEVPredictionsPerRequest: number;
  expectedPnLPerRequest: number;
  actualPnLPerRequest: number;
  quotaEfficiency: number; // e.g. 2.4 picks per request
  marketBreakdown: {
    asianHandicap: number;
    totals: number;
    btts: number;
  };
  timestampUtc: string;
}

export class PredictionDensityEngine {
  /**
   * Calculates settlement-aware Expected Value (EV).
   *
   * Exact settlement rules:
   * - WIN: profit = (odds - 1)
   * - HALF_WIN: profit = 0.5 * (odds - 1)
   * - PUSH: profit = 0
   * - HALF_LOSS: loss = -0.5
   * - LOSS: loss = -1.0
   */
  public static calculateSettlementAwareEV(
    odds: number,
    probs: MarketProbabilityDistribution,
    line: number | null
  ): number {
    if (odds <= 1.0) return -1.0;

    const lineType = classifyLineType(line);

    const pWin = Math.max(0, Math.min(1, probs.pWin));
    const pHalfWin = Math.max(0, Math.min(1, probs.pHalfWin ?? 0));
    const pPush = Math.max(0, Math.min(1, probs.pPush ?? 0));
    const pHalfLoss = Math.max(0, Math.min(1, probs.pHalfLoss ?? 0));
    const pLoss = Math.max(0, Math.min(1, probs.pLoss));

    if (lineType === 'QUARTER') {
      // Quarter line EV expectation
      const ev =
        pWin * (odds - 1) +
        pHalfWin * 0.5 * (odds - 1) +
        pPush * 0 -
        pHalfLoss * 0.5 -
        pLoss * 1.0;
      return Math.round(ev * 10000) / 10000;
    }

    if (lineType === 'FULL') {
      // Full line (push possible)
      const ev = pWin * (odds - 1) + pPush * 0 - pLoss * 1.0;
      return Math.round(ev * 10000) / 10000;
    }

    // Binary / Half line (no push)
    const ev = pWin * (odds - 1) - pLoss * 1.0;
    return Math.round(ev * 10000) / 10000;
  }

  /**
   * Evaluates a single market candidate and computes edge, EV, and fair odds.
   */
  public static evaluateCandidate(candidate: MarketCandidateInput): EvaluatedMarketPrediction {
    const lineType = classifyLineType(candidate.line);
    const ev = this.calculateSettlementAwareEV(
      candidate.marketOdds,
      candidate.probabilities,
      candidate.line
    );

    const modelProbability = candidate.probabilities.pWin;
    const marketImpliedProbability = candidate.marketOdds > 1.0 ? 1.0 / candidate.marketOdds : 1.0;
    const edge = Math.round((modelProbability - marketImpliedProbability) * 10000) / 10000;
    const fairOdds = modelProbability > 0 ? Math.round((1.0 / modelProbability) * 100) / 100 : 999.0;
    const isPositiveEv = ev > 0.005; // EV > 0.5% minimum threshold for consideration

    return {
      market: candidate.market,
      selection: candidate.selection,
      line: candidate.line,
      lineType,
      marketOdds: candidate.marketOdds,
      modelProbability,
      fairOdds: candidate.fairOdds ?? fairOdds,
      expectedValue: ev,
      expectedYield: Math.round(ev * 10000) / 100, // as percentage e.g. 3.52%
      edge,
      confidenceScore: candidate.confidenceScore,
      probabilities: candidate.probabilities,
      isPositiveEv,
    };
  }

  /**
   * Expands a fixture's market snapshot across AH, OU (line families), and BTTS.
   * Filters correlated duplicates on the same market, picking the highest EV candidate per market.
   */
  public static expandFixtureMarkets(
    fixture: {
      canonicalMatchId: string;
      fixture: string;
      competition: string;
      kickoffUtc: string;
      oddsTimestampUtc: string;
      bookmaker?: string;
      provider?: string;
    },
    rawCandidates: MarketCandidateInput[],
    minEvThreshold = 0.01 // Default 1.0% empirical EV floor
  ): FixtureMarketExpansion {
    const evaluated = rawCandidates.map(c => this.evaluateCandidate(c));

    // Group by market family to prevent redundant correlated selections
    // For Asian Handicap: pick best Home and/or Away line
    // For Over/Under: pick best line from the line family (e.g. 2.0 vs 2.25 vs 2.5)
    // For BTTS: pick best YES or NO
    const ahCandidates = evaluated.filter(e => e.market === 'AH' && e.expectedValue >= minEvThreshold);
    const ouCandidates = evaluated.filter(e => e.market === 'OU' && e.expectedValue >= minEvThreshold);
    const bttsCandidates = evaluated.filter(e => e.market === 'BTTS' && e.expectedValue >= minEvThreshold);

    // Pick top non-conflicting candidates
    const qualified: EvaluatedMarketPrediction[] = [];

    // AH: Pick best EV selection
    if (ahCandidates.length > 0) {
      ahCandidates.sort((a, b) => b.expectedValue - a.expectedValue);
      qualified.push(ahCandidates[0]);
    }

    // OU: Pick best EV line from family
    if (ouCandidates.length > 0) {
      ouCandidates.sort((a, b) => b.expectedValue - a.expectedValue);
      qualified.push(ouCandidates[0]);
    }

    // BTTS: Pick best EV selection
    if (bttsCandidates.length > 0) {
      bttsCandidates.sort((a, b) => b.expectedValue - a.expectedValue);
      qualified.push(bttsCandidates[0]);
    }

    const totalEv = qualified.reduce((acc, q) => acc + q.expectedValue, 0);

    return {
      canonicalMatchId: fixture.canonicalMatchId,
      fixture: fixture.fixture,
      competition: fixture.competition,
      kickoffUtc: fixture.kickoffUtc,
      oddsTimestampUtc: fixture.oddsTimestampUtc,
      bookmaker: fixture.bookmaker ?? 'Pinnacle',
      provider: fixture.provider ?? 'OddsPapi',
      candidates: evaluated,
      qualifiedPositiveEvPredictions: qualified,
      predictionsUnlockedCount: qualified.length,
      totalExpectedValueUnlocked: Math.round(totalEv * 10000) / 10000,
    };
  }

  /**
   * Computes telemetry KPIs across a batch or period.
   */
  public static computeTelemetry(
    requestsConsumed: number,
    expansions: FixtureMarketExpansion[],
    actualPnL = 0
  ): PredictionDensityTelemetry {
    let fixturesRefreshed = expansions.length;
    let marketsRefreshed = 0;
    let qualifiedPredictions = 0;
    let positiveEVPredictions = 0;
    let totalExpectedPnL = 0;

    const marketBreakdown = {
      asianHandicap: 0,
      totals: 0,
      btts: 0,
    };

    for (const exp of expansions) {
      marketsRefreshed += exp.candidates.length;
      for (const p of exp.qualifiedPositiveEvPredictions) {
        qualifiedPredictions++;
        if (p.expectedValue > 0) {
          positiveEVPredictions++;
          totalExpectedPnL += p.expectedValue;
        }
        if (p.market === 'AH') marketBreakdown.asianHandicap++;
        else if (p.market === 'OU') marketBreakdown.totals++;
        else if (p.market === 'BTTS') marketBreakdown.btts++;
      }
    }

    const safeReq = Math.max(1, requestsConsumed);
    const predictionsPerRequest = Math.round((qualifiedPredictions / safeReq) * 100) / 100;
    const positiveEVPredictionsPerRequest = Math.round((positiveEVPredictions / safeReq) * 100) / 100;
    const expectedPnLPerRequest = Math.round((totalExpectedPnL / safeReq) * 10000) / 10000;
    const actualPnLPerRequest = Math.round((actualPnL / safeReq) * 10000) / 10000;
    const quotaEfficiency = predictionsPerRequest;

    return {
      requestsConsumed,
      fixturesRefreshed,
      marketsRefreshed,
      qualifiedPredictions,
      positiveEVPredictions,
      predictionsPerRequest,
      positiveEVPredictionsPerRequest,
      expectedPnLPerRequest,
      actualPnLPerRequest,
      quotaEfficiency,
      marketBreakdown,
      timestampUtc: new Date().toISOString(),
    };
  }
}
