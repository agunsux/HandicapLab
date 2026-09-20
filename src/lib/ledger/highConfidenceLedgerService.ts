// ============================================================================
// HIGH-CONFIDENCE PREDICTION LEDGER SERVICE
// ============================================================================
// Location: src/lib/ledger/highConfidenceLedgerService.ts
//
// Invariants enforced:
// 1. High confidence qualification: confidence_score > 70 strictly.
// 2. Virtual Research bet: stake_units = 1.0 (zero real money claims).
// 3. Supported markets strictly: AH, OU, BTTS (Zero Moneyline).
// 4. Point-in-time guarantee: prediction_created_at < kickoff_utc.
// 5. Kickoff lock: original odds/line/selection become immutable at kickoff.
// 6. Idempotency: same prediction never creates duplicate bets.
// ============================================================================

import crypto from 'crypto';
import {
  HIGH_CONFIDENCE_THRESHOLD,
  VIRTUAL_RESEARCH_STAKE_UNITS,
  BET_TYPE,
  SOURCE_SYSTEM,
  DESTINATION_SYSTEM,
  PIPELINE_VERSION,
  SUPPORTED_LEDGER_MARKETS,
} from './constants';
import {
  HighConfidenceLedgerEntry,
  LedgerState,
  LedgerTransitionEvent,
} from './types';
import { DurableLedgerStore } from './durableLedgerStore';
import { ProductionSignalDTO } from '@/lib/publishing/types';

export interface QualificationResult {
  qualified: boolean;
  rejectionReason?: string;
  ledgerEntry?: HighConfidenceLedgerEntry;
  isNewRecord?: boolean;
}

export class HighConfidenceLedgerService {
  /**
   * Evaluates a published prediction signal and, if qualified (>70% confidence),
   * creates an immutable 1-unit virtual research bet in the production ledger.
   */
  public static async qualifyAndRecordPrediction(
    signal: ProductionSignalDTO,
    options: { nowMs?: number } = {}
  ): Promise<QualificationResult> {
    const nowMs = options.nowMs || Date.now();
    const nowIso = new Date(nowMs).toISOString();

    // 1. Market Whitelist Check
    const market = signal.market?.toUpperCase() as any;
    if (!SUPPORTED_LEDGER_MARKETS.includes(market)) {
      return {
        qualified: false,
        rejectionReason: `REJECTED_MONEYLINE_UNSUPPORTED: Market '${signal.market}' is not eligible for high-confidence ledger.`,
      };
    }

    // 2. High Confidence Qualification Check (Strictly > 70)
    const confidence = Number((signal as any).confidenceScore ?? signal.confidence);
    if (isNaN(confidence) || confidence <= HIGH_CONFIDENCE_THRESHOLD) {
      return {
        qualified: false,
        rejectionReason: `CONFIDENCE_NOT_QUALIFIED: Confidence ${confidence}% is not strictly greater than threshold ${HIGH_CONFIDENCE_THRESHOLD}%.`,
      };
    }

    // 3. Point-in-Time Pre-Kickoff Invariant Check
    const predCreatedMs = new Date(signal.predictionTimestampUtc).getTime();
    const kickoffMs = new Date(signal.kickoffUtc).getTime();

    if (isNaN(kickoffMs) || isNaN(predCreatedMs)) {
      return {
        qualified: false,
        rejectionReason: 'INVALID_TIMESTAMP: Missing or invalid kickoff or prediction timestamp.',
      };
    }

    if (predCreatedMs >= kickoffMs) {
      return {
        qualified: false,
        rejectionReason: `REJECTED_POST_KICKOFF: Prediction created at ${signal.predictionTimestampUtc} is not strictly before kickoff at ${signal.kickoffUtc}.`,
      };
    }

    // 4. Deterministic Idempotency Key & Ledger ID
    // Normalizing line to avoid float rounding discrepancies (-0.25 -> -0.25)
    const modelVersion = signal.modelVersion || signal.providerProvenance?.modelVersion || 'dixon-coles-v1.0';
    const normalizedLine = Number(signal.line).toFixed(2);
    const normalizedSelection = signal.selection.trim().toUpperCase();
    const idempotencyKey = `${signal.fixtureId}_${signal.market}_${normalizedLine}_${normalizedSelection}_${modelVersion}`;
    const ledgerId = `led_${crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16)}`;

    // 5. Check If Already Recorded (Idempotency)
    const existingEntry = DurableLedgerStore.getEntry(ledgerId);
    if (existingEntry) {
      // If already recorded, return existing record without duplicate
      return {
        qualified: true,
        ledgerEntry: existingEntry,
        isNewRecord: false,
      };
    }

    // 6. Create Immutable 1-Unit Virtual Bet Snapshot
    const entry: HighConfidenceLedgerEntry = {
      ledgerId,
      signalId: signal.signalId,
      fixtureId: signal.fixtureId,
      canonicalMatchId: signal.canonicalMatchId,
      market: signal.market,
      line: signal.line,
      selection: signal.selection,
      verdict: signal.recommendation || 'VALUE_CANDIDATE',
      confidenceScore: confidence,
      modelProbability: signal.modelProbability,
      modelFairOdds: signal.fairOdds,
      odds: signal.currentOdds,
      bookmaker: signal.bookmaker || 'Pinnacle',
      stakeUnits: VIRTUAL_RESEARCH_STAKE_UNITS,
      betType: BET_TYPE,
      predictionCreatedAt: signal.predictionTimestampUtc,
      predictionLockedAt: nowMs >= kickoffMs ? nowIso : null,
      kickoffUtc: signal.kickoffUtc,
      sourceSystem: SOURCE_SYSTEM,
      destinationSystem: DESTINATION_SYSTEM,
      pipelineVersion: PIPELINE_VERSION,
      modelVersion,
      status: nowMs >= kickoffMs ? 'LOCKED' : 'RECORDED',
      settlementStatus: null,
      payloadHash: signal.payloadHash,
      idempotencyKey,
      competitionName: signal.competition,
      competitionId: signal.competitionId ?? (signal as any).leagueKey ?? 'ENG-PL',
      homeTeam: signal.homeTeam,
      awayTeam: signal.awayTeam,
    };

    // 7. Persist to Durable Store
    await DurableLedgerStore.recordEntry(entry);

    // 8. Log State Machine Event
    DurableLedgerStore.logEvent({
      eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ledgerId: entry.ledgerId,
      signalId: entry.signalId,
      fromState: 'QUALIFIED',
      toState: entry.status,
      reason: `High confidence prediction recorded as 1.0u virtual research bet (Confidence: ${confidence}%)`,
      timestampUtc: nowIso,
      actor: 'HIGH_CONFIDENCE_QUALIFIER',
      payloadHash: entry.payloadHash,
    });

    return {
      qualified: true,
      ledgerEntry: entry,
      isNewRecord: true,
    };
  }

  /**
   * Scans recorded bets and locks any whose kickoff time has arrived.
   * After locking, original odds, lines, and parameters are permanently frozen.
   */
  public static async lockBetsForKickoff(nowMs: number = Date.now()): Promise<number> {
    const ledger = DurableLedgerStore.loadLedger();
    const nowIso = new Date(nowMs).toISOString();
    let lockedCount = 0;

    for (const [id, entry] of Object.entries(ledger)) {
      const kickMs = new Date(entry.kickoffUtc).getTime();
      if (kickMs <= nowMs && entry.status === 'RECORDED') {
        entry.status = 'LOCKED';
        entry.predictionLockedAt = nowIso;
        lockedCount++;

        DurableLedgerStore.logEvent({
          eventId: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ledgerId: entry.ledgerId,
          signalId: entry.signalId,
          fromState: 'RECORDED',
          toState: 'LOCKED',
          reason: 'Match kickoff reached. Bet snapshot locked permanently.',
          timestampUtc: nowIso,
          actor: 'KICKOFF_LOCKER',
          payloadHash: entry.payloadHash,
        });
      }
    }

    if (lockedCount > 0) {
      DurableLedgerStore.saveLedger(ledger);
    }

    return lockedCount;
  }

  /**
   * Returns all active ledger entries matching optional filter criteria.
   */
  public static getLedgerEntries(filters: {
    status?: LedgerState;
    market?: string;
    league?: string;
    minConfidence?: number;
    date?: string;
  } = {}): HighConfidenceLedgerEntry[] {
    const ledger = DurableLedgerStore.loadLedger();
    let entries = Object.values(ledger);

    if (filters.status) {
      entries = entries.filter((e) => e.status === filters.status);
    }
    if (filters.market) {
      entries = entries.filter((e) => e.market === filters.market);
    }
    if (filters.league) {
      entries = entries.filter((e) => e.competitionName.toLowerCase().includes(filters.league!.toLowerCase()));
    }
    if (filters.minConfidence !== undefined) {
      entries = entries.filter((e) => e.confidenceScore >= filters.minConfidence!);
    }
    if (filters.date) {
      entries = entries.filter((e) => e.kickoffUtc.startsWith(filters.date!));
    }

    return entries;
  }
}
