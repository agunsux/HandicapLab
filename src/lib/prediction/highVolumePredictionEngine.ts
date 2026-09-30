// ============================================================================
// HIGH-VOLUME POSITIVE-EV DAILY PREDICTION ENGINE
// ============================================================================
// Location: src/lib/prediction/highVolumePredictionEngine.ts
//
// Invariants enforced (Section 7, 8, 14, 18, 19, 21, 23):
// 1. Tiered Qualification System:
//    - TIER_A: High EV (>= 4.0%) + High Confidence (>= 60)
//    - TIER_B: Positive EV (2.0% - 3.99%) + Acceptable Confidence (>= 50)
//    - TIER_C: Marginal Positive EV (1.0% - 1.99%) + Sufficient Confidence (>= 40)
//    - TIER_D: Negative EV (< 1.0%) or Insufficient Evidence -> REJECT
// 2. Strict Anti-Lookahead:
//    - predictionTimestampUtc < kickoffUtc
//    - oddsTimestampUtc <= predictionTimestampUtc
//    - kickoffUtc > nowUtc for active picks
// 3. Stale Data Kill-Switch:
//    - Odds age <= 24 hours (86400s)
//    - Zero synthetic, mock, or fabricated odds allowed.
// 4. Ledger Immutability:
//    - Every qualified pick is recorded with immutable cryptographic provenance.
// ============================================================================

import { CanonicalBetLedgerService } from '@/lib/ledger/canonicalBetLedger';
import {
  CanonicalPredictionRecord,
  MarketType,
  LineType,
  PredictionConfidence,
  ValueStatus,
} from '@/lib/ledger/predictionLedgerTypes';
import {
  PredictionDensityEngine,
  MarketCandidateInput,
  EvaluatedMarketPrediction,
} from '@/lib/quota/predictionDensityEngine';

export type QualificationTier = 'TIER_A' | 'TIER_B' | 'TIER_C' | 'TIER_D';

export interface FixtureInput {
  canonicalMatchId: string;
  fixture: string;
  competition: string;
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string; // ISO 8601 UTC
}

export interface OddsSnapshotInput {
  provider: string; // e.g. 'OddsPapi'
  bookmaker: string; // e.g. 'Pinnacle'
  oddsTimestampUtc: string; // ISO 8601 UTC
  marketCandidates: MarketCandidateInput[];
  quotaRequestId?: string;
  quotaCost?: number;
}

export interface EngineExecutionOptions {
  nowMs?: number;
  modelVersion?: string;
  pipelineVersion?: string;
  dataVersion?: string;
  minEvThreshold?: number; // default 0.01 (1.0%)
  sourceFeatures?: Record<string, any>;
  recordToLedger?: boolean;
}

export interface EngineExecutionResult {
  fixtureId: string;
  fixture: string;
  status: 'SUCCESS' | 'NO_QUALIFIED_PICKS' | 'REJECTED';
  rejectionReason?: string;
  allEvaluatedCandidates: EvaluatedMarketPrediction[];
  qualifiedPicks: CanonicalPredictionRecord[];
  summary: {
    tierA: number;
    tierB: number;
    tierC: number;
    disqualified: number;
  };
}

export class HighVolumePredictionEngine {
  public static readonly DEFAULT_MODEL_VERSION = 'HL-QMOD-v2.6-QUOTA-AWARE';
  public static readonly DEFAULT_PIPELINE_VERSION = 'hl-pipe-v4.2.0';
  public static readonly DEFAULT_DATA_VERSION = 'api-football-v3+oddspapi-v4';
  public static readonly MAX_ODDS_AGE_MS = 24 * 3600 * 1000; // 24 hours

  /**
   * Classifies a prediction into qualification tiers.
   */
  public static classifyTier(
    ev: number,
    confidenceScore: number
  ): QualificationTier {
    if (ev >= 0.04 && confidenceScore >= 60) return 'TIER_A';
    if (ev >= 0.02 && confidenceScore >= 50) return 'TIER_B';
    if (ev >= 0.01 && confidenceScore >= 40) return 'TIER_C';
    return 'TIER_D';
  }

  /**
   * Evaluates candidates for a single fixture and optionally registers them into the canonical ledger.
   */
  public static processFixture(
    fixture: FixtureInput,
    oddsSnapshot: OddsSnapshotInput,
    options: EngineExecutionOptions = {}
  ): EngineExecutionResult {
    const nowMs = options.nowMs ?? Date.now();
    const nowIso = new Date(nowMs).toISOString();

    const kickoffMs = new Date(fixture.kickoffUtc).getTime();
    if (isNaN(kickoffMs)) {
      throw new Error(`INVALID_KICKOFF_DATE: ${fixture.kickoffUtc}`);
    }

    // 1. Anti-Lookahead Gate: Prediction timestamp MUST be strictly before kickoff
    if (nowMs >= kickoffMs) {
      return {
        fixtureId: fixture.canonicalMatchId,
        fixture: fixture.fixture,
        status: 'REJECTED',
        rejectionReason: `TEMPORAL_LEAKAGE_VIOLATION: Current time ${nowIso} is at or after kickoff ${fixture.kickoffUtc}.`,
        allEvaluatedCandidates: [],
        qualifiedPicks: [],
        summary: { tierA: 0, tierB: 0, tierC: 0, disqualified: 0 },
      };
    }

    // 2. Reject synthetic / fabricated odds
    const bmLower = (oddsSnapshot.bookmaker || '').toLowerCase();
    const provLower = (oddsSnapshot.provider || '').toLowerCase();
    if (
      bmLower.includes('mock') ||
      bmLower.includes('synthetic') ||
      bmLower.includes('fake') ||
      provLower.includes('mock') ||
      provLower.includes('synthetic')
    ) {
      return {
        fixtureId: fixture.canonicalMatchId,
        fixture: fixture.fixture,
        status: 'REJECTED',
        rejectionReason: 'FABRICATED_ODDS_REJECTED: Mock or synthetic odds provider detected.',
        allEvaluatedCandidates: [],
        qualifiedPicks: [],
        summary: { tierA: 0, tierB: 0, tierC: 0, disqualified: 0 },
      };
    }

    // 3. Stale Data Kill-Switch: Odds must not exceed 24 hours age
    const oddsMs = new Date(oddsSnapshot.oddsTimestampUtc).getTime();
    if (isNaN(oddsMs) || nowMs - oddsMs > this.MAX_ODDS_AGE_MS) {
      const ageHours = isNaN(oddsMs) ? 'UNKNOWN' : ((nowMs - oddsMs) / 3600000).toFixed(1);
      return {
        fixtureId: fixture.canonicalMatchId,
        fixture: fixture.fixture,
        status: 'REJECTED',
        rejectionReason: `STALE_ODDS_REJECTED: Odds age (${ageHours}h) exceeds 24-hour SLA.`,
        allEvaluatedCandidates: [],
        qualifiedPicks: [],
        summary: { tierA: 0, tierB: 0, tierC: 0, disqualified: 0 },
      };
    }

    // 4. Odds timestamp must not be after prediction timestamp
    if (oddsMs > nowMs) {
      return {
        fixtureId: fixture.canonicalMatchId,
        fixture: fixture.fixture,
        status: 'REJECTED',
        rejectionReason: `FUTURE_ODDS_TIMESTAMP_REJECTED: Odds timestamp ${oddsSnapshot.oddsTimestampUtc} is in the future.`,
        allEvaluatedCandidates: [],
        qualifiedPicks: [],
        summary: { tierA: 0, tierB: 0, tierC: 0, disqualified: 0 },
      };
    }

    // 5. Expand fixture markets and calculate settlement-aware EV
    const minEv = options.minEvThreshold ?? 0.01;
    const expansion = PredictionDensityEngine.expandFixtureMarkets(
      {
        canonicalMatchId: fixture.canonicalMatchId,
        fixture: fixture.fixture,
        competition: fixture.competition,
        kickoffUtc: fixture.kickoffUtc,
        oddsTimestampUtc: oddsSnapshot.oddsTimestampUtc,
        bookmaker: oddsSnapshot.bookmaker,
        provider: oddsSnapshot.provider,
      },
      oddsSnapshot.marketCandidates,
      minEv
    );

    const summary = { tierA: 0, tierB: 0, tierC: 0, disqualified: 0 };
    const qualifiedPicks: CanonicalPredictionRecord[] = [];

    const modelVersion = options.modelVersion ?? this.DEFAULT_MODEL_VERSION;
    const pipelineVersion = options.pipelineVersion ?? this.DEFAULT_PIPELINE_VERSION;
    const dataVersion = options.dataVersion ?? this.DEFAULT_DATA_VERSION;

    for (const cand of expansion.qualifiedPositiveEvPredictions) {
      const tier = this.classifyTier(cand.expectedValue, cand.confidenceScore);

      if (tier === 'TIER_D') {
        summary.disqualified++;
        continue;
      }

      if (tier === 'TIER_A') summary.tierA++;
      else if (tier === 'TIER_B') summary.tierB++;
      else if (tier === 'TIER_C') summary.tierC++;

      // Determine confidence label
      let confLabel: PredictionConfidence = 'LOW';
      if (cand.confidenceScore >= 75) confLabel = 'HIGH';
      else if (cand.confidenceScore >= 55) confLabel = 'MEDIUM';

      const valueStatus: ValueStatus = cand.expectedValue >= 0.03 ? 'VALUE' : 'QUALIFIED';

      const predPayload = {
        canonicalFixtureId: fixture.canonicalMatchId,
        fixtureId: fixture.canonicalMatchId,
        fixture: fixture.fixture,
        league: fixture.competition,
        competition: fixture.competition,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        kickoffTimestamp: fixture.kickoffUtc,
        market: cand.market,
        selection: cand.selection,
        line: cand.line,
        lineType: cand.lineType,
        provider: oddsSnapshot.provider,
        bookmaker: oddsSnapshot.bookmaker,
        marketOdds: cand.marketOdds,
        oddsTimestamp: oddsSnapshot.oddsTimestampUtc,
        modelProbability: cand.modelProbability,
        calibratedProbability: cand.modelProbability,
        fairOdds: cand.fairOdds,
        expectedValue: cand.expectedValue,
        edge: cand.edge,
        confidence: confLabel,
        confidenceScore: cand.confidenceScore,
        valueStatus,
        predictionTimestamp: nowIso,
        featureTimestamp: oddsSnapshot.oddsTimestampUtc,
        modelVersion,
        pipelineVersion,
        dataVersion,
        qualificationTier: tier,
        quotaRequestId: oddsSnapshot.quotaRequestId,
        quotaCost: oddsSnapshot.quotaCost,
        sourceFeatures: options.sourceFeatures,
        kickoffUtc: fixture.kickoffUtc,
        predictionTimestampUtc: nowIso,
        oddsTimestampUtc: oddsSnapshot.oddsTimestampUtc,
        oddsProvider: oddsSnapshot.provider,
      };

      if (options.recordToLedger) {
        const { record } = CanonicalBetLedgerService.recordPrediction(predPayload);
        qualifiedPicks.push(record);
      } else {
        const dummyId = CanonicalBetLedgerService.generatePredictionId(
          fixture.canonicalMatchId,
          cand.market,
          cand.line,
          cand.selection,
          oddsSnapshot.bookmaker
        );
        qualifiedPicks.push({
          ...predPayload,
          predictionId: dummyId,
          rawPredictionPayloadHash: 'DRY_RUN_HASH',
          inputSnapshotHash: 'DRY_RUN_INPUT_HASH',
          status: 'PENDING',
          settlement: null,
          clvRecord: null,
          revisions: [],
          odds: cand.marketOdds,
          match: fixture.fixture,
          ev: cand.expectedValue,
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    }

    const status = qualifiedPicks.length > 0 ? 'SUCCESS' : 'NO_QUALIFIED_PICKS';

    return {
      fixtureId: fixture.canonicalMatchId,
      fixture: fixture.fixture,
      status,
      allEvaluatedCandidates: expansion.candidates,
      qualifiedPicks,
      summary,
    };
  }
}
