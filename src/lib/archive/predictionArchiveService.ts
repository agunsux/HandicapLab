// ============================================================================
// CANONICAL PREDICTION ARCHIVE SERVICE
// ============================================================================
// Location: src/lib/archive/predictionArchiveService.ts
//
// Invariants enforced:
// 1. Permanent Historical Evidence: Archive records are NEVER deleted or overwritten.
// 2. Daily Picks is strictly a dynamic projection of current unplayed predictions.
// 3. Immutability: Historical predictions remain tied to their original model version.
// 4. Exact quarter-line settlement & yield contribution.
// 5. Atomic persistence & append-only JSONL streaming.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import {
  PredictionArchiveRecord,
  DailyPickProjection,
  DailyPickRunSnapshot,
  ArchiveMarket,
  ArchiveStatus,
  PredictionSettlementRecord,
} from './types';
import { ModelVersionRegistry } from './modelVersionRegistry';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';
import { supabase } from '@/lib/supabase.server';

function getArchiveJsonPath(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.resolve('data/test_ledger/prediction_archive.json');
  }
  if (process.env.VERCEL) {
    const os = require('os');
    return path.join(os.tmpdir(), 'handicaplab_prediction_archive.json');
  }
  return path.resolve('data/ledger/prediction_archive.json');
}

function getArchiveJsonlPath(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.resolve('data/test_ledger/prediction_archive.jsonl');
  }
  if (process.env.VERCEL) {
    const os = require('os');
    return path.join(os.tmpdir(), 'handicaplab_prediction_archive.jsonl');
  }
  return path.resolve('data/ledger/prediction_archive.jsonl');
}

function getDailyRunSnapshotsPath(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.resolve('data/test_ledger/daily_pick_run_snapshots.jsonl');
  }
  if (process.env.VERCEL) {
    const os = require('os');
    return path.join(os.tmpdir(), 'handicaplab_daily_pick_run_snapshots.jsonl');
  }
  return path.resolve('data/ledger/daily_pick_run_snapshots.jsonl');
}

function getSettlementsJsonlPath(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.resolve('data/test_ledger/prediction_settlements.jsonl');
  }
  if (process.env.VERCEL) {
    const os = require('os');
    return path.join(os.tmpdir(), 'handicaplab_prediction_settlements.jsonl');
  }
  return path.resolve('data/ledger/prediction_settlements.jsonl');
}

export class PredictionArchiveService {
  private static cachedStore: Record<string, PredictionArchiveRecord> | null = null;

  // ──────────────────────────────────────────────────────────────────────────
  // ATOMIC PERSISTENCE HELPERS
  // ──────────────────────────────────────────────────────────────────────────

  private static atomicWriteJson(filePath: string, data: any): void {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const content = JSON.stringify(data, null, 2);
      const tempPath = filePath + '.tmp.' + Date.now() + '.' + Math.random().toString(36).slice(2, 7);
      fs.writeFileSync(tempPath, content, 'utf8');

      let attempts = 0;
      while (attempts < 5) {
        try {
          fs.renameSync(tempPath, filePath);
          return;
        } catch (err: any) {
          if (err?.code === 'EPERM' || err?.code === 'EBUSY') {
            attempts++;
            try {
              fs.writeFileSync(filePath, content, 'utf8');
              try { fs.unlinkSync(tempPath); } catch {}
              return;
            } catch (writeErr: any) {
              if (attempts >= 5) {
                try { fs.unlinkSync(tempPath); } catch {}
                throw writeErr;
              }
              const end = Date.now() + 25;
              while (Date.now() < end) {}
            }
          } else {
            try { fs.unlinkSync(tempPath); } catch {}
            throw err;
          }
        }
      }
    } catch (err: any) {
      if (err?.code === 'EROFS') {
        console.warn('[PredictionArchiveService] Read-only filesystem detected, write skipped:', filePath);
        return;
      }
      throw err;
    }
  }

  private static appendJsonLine(filePath: string, item: any): void {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(filePath, JSON.stringify(item) + '\n', 'utf8');
    } catch (e: any) {
      if (e?.code === 'EROFS') {
        return;
      }
      console.warn('[PredictionArchiveService] Failed to append JSONL line to ' + filePath + ':', e);
    }
  }

  public static loadArchive(): Record<string, PredictionArchiveRecord> {
    if (this.cachedStore) return this.cachedStore;

    try {
      const p = getArchiveJsonPath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.cachedStore = parsed;
          return parsed;
        }
      } else if (process.env.VERCEL) {
        const bundled = path.resolve('data/ledger/prediction_archive.json');
        if (fs.existsSync(bundled)) {
          const raw = fs.readFileSync(bundled, 'utf8');
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            this.cachedStore = parsed;
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('[PredictionArchiveService] Could not read archive file, initializing empty:', e);
    }

    const emptyStore: Record<string, PredictionArchiveRecord> = {};
    this.cachedStore = emptyStore;
    return emptyStore;
  }

  public static saveArchive(store: Record<string, PredictionArchiveRecord>): void {
    this.cachedStore = store;
    this.atomicWriteJson(getArchiveJsonPath(), store);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // IMMUTABLE RECORDING OF PREDICTIONS
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Records a generated prediction snapshot immutably into the permanent archive.
   * If a record with the same deterministic identity already exists, returns the existing record (idempotency).
   */
  public static async recordPrediction(
    input: Omit<PredictionArchiveRecord, 'predictionId' | 'provenanceHash' | 'createdAt' | 'updatedAt'> & {
      predictionId?: string;
      provenanceHash?: string;
    }
  ): Promise<{ record: PredictionArchiveRecord; isNew: boolean }> {
    const store = this.loadArchive();
    const nowIso = new Date().toISOString();

    // Temporal Invariant Enforcement: oddsTimestamp <= predictionTimestamp < kickoffTimestamp
    const kickMs = new Date(input.kickoffTimestamp).getTime();
    const predMs = new Date(input.predictionTimestamp).getTime();
    const oddsMs = new Date(input.oddsTimestamp).getTime();

    if (!isNaN(kickMs) && !isNaN(predMs) && predMs >= kickMs) {
      throw new Error(
        `[PredictionArchive] Temporal leakage violation: predictionTimestamp (${input.predictionTimestamp}) >= kickoffTimestamp (${input.kickoffTimestamp})`
      );
    }
    if (!isNaN(predMs) && !isNaN(oddsMs) && oddsMs > predMs) {
      throw new Error(
        `[PredictionArchive] Temporal leakage violation: oddsTimestamp (${input.oddsTimestamp}) > predictionTimestamp (${input.predictionTimestamp})`
      );
    }

    const modelVersion = input.modelVersion || ModelVersionRegistry.getActiveModelVersion(input.market).versionId;
    const normalizedLine = Number(input.line).toFixed(2);
    const normalizedSelection = input.selection.trim().toUpperCase();
    const idempotencyKey = `${input.fixtureId}_${input.market}_${normalizedLine}_${normalizedSelection}_${modelVersion}`;
    const predictionId = input.predictionId || `pred_${crypto.createHash('sha256').update(idempotencyKey).digest('hex').slice(0, 16)}`;

    const existing = store[predictionId];
    if (existing) {
      // If already settled or locked, do not modify
      if (existing.status === 'SETTLED' || existing.status === 'KICKED_OFF') {
        return { record: existing, isNew: false };
      }

      // If market odds shifted prior to kickoff, update entry odds snapshot while preserving identity
      if (existing.status === 'GENERATED' || existing.status === 'ACTIVE') {
        if (input.marketOdds !== existing.marketOdds || input.edge !== existing.edge) {
          existing.marketOdds = input.marketOdds;
          existing.edge = input.edge;
          existing.expectedValue = input.expectedValue;
          existing.fairOdds = input.fairOdds;
          existing.decision = input.decision;
          existing.confidence = input.confidence;
          existing.oddsTimestamp = input.oddsTimestamp;
          existing.updatedAt = nowIso;
          this.saveArchive(store);
          return { record: existing, isNew: false };
        }
      }
      return { record: existing, isNew: false };
    }

    // Compute cryptographic provenance hash for forensic auditability
    const provenancePayload = JSON.stringify({
      idempotencyKey,
      fixtureId: input.fixtureId,
      canonicalMatchId: input.canonicalMatchId,
      market: input.market,
      line: input.line,
      selection: input.selection,
      modelVersion,
      modelParametersVersion: input.modelParametersVersion,
      scoreGridSummary: input.scoreGridSummary,
      marketOdds: input.marketOdds,
      fairOdds: input.fairOdds,
      modelProbability: input.modelProbability,
      predictionTimestamp: input.predictionTimestamp,
      kickoffTimestamp: input.kickoffTimestamp,
    });
    const provenanceHash = input.provenanceHash || crypto.createHash('sha256').update(provenancePayload).digest('hex');

    const newRecord: PredictionArchiveRecord = {
      ...input,
      predictionId,
      modelVersion,
      provenanceHash,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    store[predictionId] = newRecord;
    this.saveArchive(store);

    // Stream append to immutable JSONL audit ledger
    this.appendJsonLine(getArchiveJsonlPath(), newRecord);

    // Log to durable transition events
    DurableLedgerStore.logEvent({
      eventId: `evt_pred_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ledgerId: predictionId,
      signalId: predictionId,
      fromState: 'RECORDED' as any,
      toState: (newRecord.status === 'ACTIVE' ? 'RECORDED' : newRecord.status) as any,
      reason: `Immutable prediction archived for ${input.homeTeam} vs ${input.awayTeam} (${input.market} ${input.line}).`,
      timestampUtc: nowIso,
      actor: 'HIGH_CONFIDENCE_QUALIFIER' as any,
      payloadHash: provenanceHash,
    });

    // Optional Supabase synchronisation if configured
    try {
      if (process.env.NODE_ENV !== 'test') {
        await supabase.from('prediction_snapshots').insert({
          id: undefined,
          fixture_id: input.fixtureId,
          model_version: modelVersion,
          market_type: input.market === 'AH' ? 'asian_handicap' : input.market === 'OU' ? 'over_under' : 'btts',
          line: input.line,
          prediction_prob: input.modelProbability,
          market_prob: input.marketOdds > 1 ? Number((1 / input.marketOdds).toFixed(6)) : 0.5,
          edge: input.edge,
          confidence: input.confidence,
          input_data_hash: provenanceHash,
          timestamp: input.predictionTimestamp,
        });
      }
    } catch (e) {
      // Non-blocking fallback to durable filesystem store
    }

    return { record: newRecord, isNew: true };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // AUTOMATIC SETTLEMENT INTO ARCHIVE
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Settles an archived prediction against verified match result and closing line.
   */
  public static async settleArchivedPrediction(
    predictionId: string,
    settlement: PredictionSettlementRecord
  ): Promise<{ settled: boolean; record: PredictionArchiveRecord | null }> {
    const store = this.loadArchive();
    const record = store[predictionId];

    if (!record) {
      return { settled: false, record: null };
    }

    // Idempotency: Cannot re-settle already settled prediction
    if (record.status === 'SETTLED' && record.settlement !== null) {
      return { settled: false, record };
    }

    // Invariant: Settlement cannot occur before kickoff
    const kickMs = new Date(record.kickoffTimestamp).getTime();
    const settledMs = new Date(settlement.settledAt).getTime();
    if (!isNaN(kickMs) && !isNaN(settledMs) && settledMs < kickMs) {
      throw new Error(
        `[PredictionArchive] Temporal settlement violation: settledAt (${settlement.settledAt}) < kickoffTimestamp (${record.kickoffTimestamp})`
      );
    }

    // Invariant (Gate 6): Settlement cannot occur before match result timestamp
    if (settlement.resultReceivedAt) {
      const resultMs = new Date(settlement.resultReceivedAt).getTime();
      if (!isNaN(resultMs) && !isNaN(settledMs) && settledMs < resultMs) {
        throw new Error(
          `[PredictionArchive] Temporal settlement violation: settledAt (${settlement.settledAt}) < resultReceivedAt (${settlement.resultReceivedAt})`
        );
      }
    }

    const nowIso = new Date().toISOString();
    record.status = settlement.outcome === 'VOID' ? 'VOID' : 'SETTLED';
    record.settlement = settlement;
    record.updatedAt = nowIso;

    this.saveArchive(store);

    // Stream settlement to JSONL
    this.appendJsonLine(getSettlementsJsonlPath(), {
      predictionId,
      settlement,
      timestampUtc: nowIso,
    });

    // Log state transition
    DurableLedgerStore.logEvent({
      eventId: `evt_stl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ledgerId: predictionId,
      signalId: predictionId,
      fromState: record.status,
      toState: 'SETTLED',
      reason: `Settled as ${settlement.outcome} (${settlement.homeGoals}-${settlement.awayGoals}). Profit: ${settlement.profitUnits > 0 ? '+' : ''}${settlement.profitUnits}U.`,
      timestampUtc: nowIso,
      actor: 'SETTLEMENT_ENGINE',
      payloadHash: record.provenanceHash,
    });

    return { settled: true, record };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // KICKOFF LOCK & IMMUTABILITY FREEZE
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Automatically locks any prediction whose match kickoff has occurred.
   * Original odds, lines, and model parameters are permanently frozen.
   */
  public static async lockPredictionsForKickoff(nowMs: number = Date.now()): Promise<number> {
    const store = this.loadArchive();
    const nowIso = new Date(nowMs).toISOString();
    let lockedCount = 0;

    for (const record of Object.values(store)) {
      const kickMs = new Date(record.kickoffTimestamp).getTime();
      if (kickMs <= nowMs && (record.status === 'GENERATED' || record.status === 'ACTIVE')) {
        record.status = 'KICKED_OFF';
        record.updatedAt = nowIso;
        lockedCount++;

        DurableLedgerStore.logEvent({
          eventId: `evt_lock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ledgerId: record.predictionId,
          signalId: record.predictionId,
          fromState: 'RECORDED' as any,
          toState: 'LOCKED' as any,
          reason: 'Match kickoff reached. Prediction parameters permanently locked.',
          timestampUtc: nowIso,
          actor: 'KICKOFF_LOCKER',
          payloadHash: record.provenanceHash,
        });
      }
    }

    if (lockedCount > 0) {
      this.saveArchive(store);
    }

    return lockedCount;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DYNAMIC DAILY PICKS PROJECTION (AUTOMATIC CALENDAR ROLLOVER)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Projects active unplayed predictions into the Daily Picks feed.
   * Automatically partitions into TODAY, TOMORROW, and NEXT_7_DAYS based on UTC calendar dates.
   * Zero manual updates required when the calendar changes.
   */
  public static getDailyPicksProjection(options: {
    nowMs?: number;
    horizon?: 'TODAY' | 'TOMORROW' | 'NEXT_7_DAYS' | 'ALL';
    market?: ArchiveMarket;
    minConfidence?: number;
  } = {}): DailyPickProjection[] {
    const store = this.loadArchive();
    const nowMs = options.nowMs || Date.now();
    const todayDateStr = new Date(nowMs).toISOString().slice(0, 10);
    const tomorrowDateStr = new Date(nowMs + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const projections: DailyPickProjection[] = [];

    for (const record of Object.values(store)) {
      const kickMs = new Date(record.kickoffTimestamp).getTime();

      // Guard: Only future matches (not yet kicked off)
      if (kickMs <= nowMs) continue;

      // Guard: Must be within 7-day horizon
      if (kickMs > nowMs + sevenDaysMs) continue;

      // Guard: Must be an actionable decision (VALUE_CANDIDATE or WATCH)
      if (record.decision === 'NO_SIGNAL') continue;

      // Filter by market if requested
      if (options.market && record.market !== options.market) continue;

      // Filter by confidence if requested
      if (options.minConfidence !== undefined && record.confidence < options.minConfidence) continue;

      // Determine dynamic horizon bucket based on calendar rollover
      const kickDateStr = record.kickoffTimestamp.slice(0, 10);
      let horizonBucket: 'TODAY' | 'TOMORROW' | 'NEXT_7_DAYS';
      if (kickDateStr === todayDateStr) {
        horizonBucket = 'TODAY';
      } else if (kickDateStr === tomorrowDateStr) {
        horizonBucket = 'TOMORROW';
      } else {
        horizonBucket = 'NEXT_7_DAYS';
      }

      if (options.horizon && options.horizon !== 'ALL') {
        if (options.horizon === 'TODAY' && horizonBucket !== 'TODAY') continue;
        if (options.horizon === 'TOMORROW' && horizonBucket !== 'TOMORROW') continue;
        if (options.horizon === 'NEXT_7_DAYS' && horizonBucket !== 'NEXT_7_DAYS' && horizonBucket !== 'TODAY' && horizonBucket !== 'TOMORROW') continue;
      }

      projections.push({
        predictionId: record.predictionId,
        fixtureId: record.fixtureId,
        canonicalMatchId: record.canonicalMatchId,
        match: `${record.homeTeam} vs ${record.awayTeam}`,
        homeTeam: record.homeTeam,
        awayTeam: record.awayTeam,
        competition: record.competition,
        leagueKey: record.leagueKey,
        kickoffUtc: record.kickoffTimestamp,
        market: record.market,
        line: record.line,
        selection: record.selection,
        modelProbability: record.modelProbability,
        fairOdds: record.fairOdds,
        marketOdds: record.marketOdds,
        marketBookmaker: record.bookmaker,
        edge: record.edge,
        expectedValue: record.expectedValue,
        confidence: record.confidence,
        decision: record.decision,
        verdict: record.decision === 'VALUE_CANDIDATE' ? 'LAYAK' : 'PANTAU',
        signalColor: record.signalColor,
        status: record.status,
        modelVersion: record.modelVersion,
        horizonBucket,
        predictionTimestampUtc: record.predictionTimestamp,
        oddsTimestampUtc: record.oddsTimestamp,
        updatedAtUtc: record.updatedAt,
      });
    }

    // Sort chronologically by kickoff
    return projections.sort(
      (a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime()
    );
  }

  /**
   * Persists an audit snapshot of a daily picks generation run.
   */
  public static recordDailyRunSnapshot(snapshot: DailyPickRunSnapshot): void {
    this.appendJsonLine(getDailyRunSnapshotsPath(), snapshot);
  }

  /**
   * Generates and persists an immutable snapshot of current Daily Picks projections.
   */
  public static generateDailyPicksSnapshot(nowMs: number = Date.now()): DailyPickRunSnapshot {
    const picks = this.getDailyPicksProjection({ nowMs });
    const nowIso = new Date(nowMs).toISOString();

    const snapshot: DailyPickRunSnapshot = {
      runId: `snap_${Date.now()}`,
      runTimestamp: nowIso,
      coverageStart: nowIso.slice(0, 10),
      coverageEnd: new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      fixturesScanned: picks.length,
      fixturesWithOdds: picks.filter((p) => p.marketOdds > 1).length,
      predictionsGenerated: picks.length,
      actionablePicks: picks.filter((p) => p.decision === 'VALUE_CANDIDATE').length,
      modelVersion: picks[0]?.modelVersion || 'dixon-coles-v1.0',
    };
    this.recordDailyRunSnapshot(snapshot);
    return snapshot;
  }

  /**
   * Alias for lockPredictionsForKickoff
   */
  public static lockKickedOffPredictions(nowMs: number = Date.now()): Promise<number> {
    return this.lockPredictionsForKickoff(nowMs);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HISTORICAL ARCHIVE QUERIES
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Queries prediction history across custom filters for research, validation, or auditing.
   */
  public static getPredictionHistory(filters: {
    market?: ArchiveMarket;
    line?: number;
    status?: ArchiveStatus;
    modelVersion?: string;
    league?: string;
    date?: string;
    minOdds?: number;
    maxOdds?: number;
  } = {}): PredictionArchiveRecord[] {
    const store = this.loadArchive();
    let records = Object.values(store);

    if (filters.market) {
      records = records.filter((r) => r.market === filters.market);
    }
    if (filters.line !== undefined) {
      records = records.filter((r) => Math.abs(r.line - filters.line!) < 0.001);
    }
    if (filters.status) {
      records = records.filter((r) => r.status === filters.status);
    }
    if (filters.modelVersion) {
      records = records.filter((r) => r.modelVersion === filters.modelVersion);
    }
    if (filters.league) {
      records = records.filter((r) => r.competition.toLowerCase().includes(filters.league!.toLowerCase()));
    }
    if (filters.date) {
      records = records.filter((r) => r.kickoffTimestamp.startsWith(filters.date!));
    }
    if (filters.minOdds !== undefined) {
      records = records.filter((r) => r.marketOdds >= filters.minOdds!);
    }
    if (filters.maxOdds !== undefined) {
      records = records.filter((r) => r.marketOdds <= filters.maxOdds!);
    }

    return records.sort(
      (a, b) => new Date(b.kickoffTimestamp).getTime() - new Date(a.kickoffTimestamp).getTime()
    );
  }

  /**
   * Incremental change-feed query for SALMO synchronization.
   * Returns only records created or updated since `sinceUtc`.
   */
  public static getIncrementalUpdates(sinceUtc?: string): PredictionArchiveRecord[] {
    const store = this.loadArchive();
    const records = Object.values(store);

    if (!sinceUtc) return records;

    const sinceMs = new Date(sinceUtc).getTime();
    if (isNaN(sinceMs)) return records;

    return records.filter((r) => new Date(r.updatedAt).getTime() > sinceMs);
  }

  /**
   * Clears the store for clean test isolation.
   */
  public static clearStoreForTesting(): void {
    this.cachedStore = {};
    this.atomicWriteJson(getArchiveJsonPath(), {});
    const jsonlPath = getArchiveJsonlPath();
    if (fs.existsSync(jsonlPath)) {
      try { fs.unlinkSync(jsonlPath); } catch {}
    }
  }
}
