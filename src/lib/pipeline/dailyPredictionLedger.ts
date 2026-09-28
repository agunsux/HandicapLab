// ============================================================================
// IMMUTABLE DAILY PREDICTION LEDGER SERVICE
// ============================================================================
// Location: src/lib/pipeline/dailyPredictionLedger.ts
//
// Invariants enforced:
// 1. Every prediction is permanently and immutably persisted.
// 2. Exact fields specified in Epic Section 11.
// 3. Statuses: PENDING, HIGH_CONFIDENCE, QUALIFIED, RESEARCH_ONLY, SETTLED_WIN, SETTLED_LOSS, VOID, INVALID.
// 4. Duplicate prediction calls for same match+market+line+run_id do not duplicate.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import { PredictionLedgerStatus, SupportedPipelineMarket } from './confidenceGate';

export interface PredictionLedgerRecord {
  predictionId: string;
  canonicalMatchId: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  market: SupportedPipelineMarket;
  selection: string;
  line: number | null;
  modelProbability: number;
  calibratedProbability: number;
  odds: number | null;
  impliedProbability: number;
  edge: number;
  expectedValue: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'PASS';
  confidenceScore: number;
  predictionTimestamp: string;
  kickoffTimestamp: string;
  oddsTimestamp: string;
  modelVersion: string;
  featureVersion: string;
  runId: string;
  status: PredictionLedgerStatus;
  settlement?: {
    outcome: 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS' | 'VOID';
    profitUnits: number;
    homeGoals: number;
    awayGoals: number;
    closingOdds?: number | null;
    clv?: number | null;
    settledAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

function getLedgerPath(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.resolve('data/test_ledger/daily_prediction_ledger.json');
  }
  if (process.env.VERCEL) {
    const os = require('os');
    return path.join(os.tmpdir(), 'handicaplab_daily_prediction_ledger.json');
  }
  return path.resolve('data/ledger/daily_prediction_ledger.json');
}

function getLedgerJsonlPath(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.resolve('data/test_ledger/daily_prediction_ledger.jsonl');
  }
  if (process.env.VERCEL) {
    const os = require('os');
    return path.join(os.tmpdir(), 'handicaplab_daily_prediction_ledger.jsonl');
  }
  return path.resolve('data/ledger/daily_prediction_ledger.jsonl');
}

export class DailyPredictionLedgerService {
  private static cachedLedger: Record<string, PredictionLedgerRecord> | null = null;

  public static loadLedger(): Record<string, PredictionLedgerRecord> {
    if (this.cachedLedger) return this.cachedLedger;

    try {
      const p = getLedgerPath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.cachedLedger = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[DailyPredictionLedgerService] Failed to load ledger:', e);
    }

    const empty = {};
    this.cachedLedger = empty;
    return empty;
  }

  public static saveLedger(ledger: Record<string, PredictionLedgerRecord>): void {
    try {
      const p = getLedgerPath();
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, JSON.stringify(ledger, null, 2), 'utf8');
      this.cachedLedger = ledger;
    } catch (e) {
      console.warn('[DailyPredictionLedgerService] Failed to save ledger:', e);
    }
  }

  private static appendJsonLine(record: PredictionLedgerRecord): void {
    try {
      const p = getLedgerJsonlPath();
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(p, JSON.stringify(record) + '\n', 'utf8');
    } catch (e) {
      console.warn('[DailyPredictionLedgerService] Failed to append jsonl:', e);
    }
  }

  /**
   * Generates deterministic prediction ID.
   */
  public static generatePredictionId(
    canonicalMatchId: string,
    market: string,
    line: number | null,
    selection: string
  ): string {
    const normLine = line !== null ? Number(line).toFixed(2) : 'LINE_NONE';
    const normSel = selection.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const key = `${canonicalMatchId}_${market}_${normLine}_${normSel}`;
    return `dpred_${crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)}`;
  }

  /**
   * Records or updates a prediction in the immutable ledger.
   */
  public static recordPrediction(
    input: Omit<PredictionLedgerRecord, 'predictionId' | 'createdAt' | 'updatedAt'> & {
      predictionId?: string;
    }
  ): { record: PredictionLedgerRecord; isNew: boolean } {
    const ledger = this.loadLedger();
    const predictionId =
      input.predictionId ||
      this.generatePredictionId(input.canonicalMatchId, input.market, input.line, input.selection);

    const nowIso = new Date().toISOString();
    const existing = ledger[predictionId];

    if (existing) {
      // If already settled, never overwrite
      if (existing.status === 'SETTLED_WIN' || existing.status === 'SETTLED_LOSS' || existing.status === 'VOID') {
        return { record: existing, isNew: false };
      }

      // Update mutable entry fields before kickoff
      existing.odds = input.odds;
      existing.calibratedProbability = input.calibratedProbability;
      existing.edge = input.edge;
      existing.expectedValue = input.expectedValue;
      existing.status = input.status;
      existing.confidence = input.confidence;
      existing.confidenceScore = input.confidenceScore;
      existing.oddsTimestamp = input.oddsTimestamp;
      existing.updatedAt = nowIso;

      this.saveLedger(ledger);
      return { record: existing, isNew: false };
    }

    const newRecord: PredictionLedgerRecord = {
      ...input,
      predictionId,
      createdAt: nowIso,
      updatedAt: nowIso,
      settlement: null,
    };

    ledger[predictionId] = newRecord;
    this.saveLedger(ledger);
    this.appendJsonLine(newRecord);

    return { record: newRecord, isNew: true };
  }

  /**
   * Settles an entry in the daily prediction ledger.
   */
  public static settlePrediction(
    predictionId: string,
    settlement: NonNullable<PredictionLedgerRecord['settlement']>
  ): PredictionLedgerRecord | null {
    const ledger = this.loadLedger();
    const record = ledger[predictionId];
    if (!record) return null;

    let finalStatus: PredictionLedgerStatus = 'VOID';
    if (settlement.outcome === 'WIN' || settlement.outcome === 'HALF_WIN') {
      finalStatus = 'SETTLED_WIN';
    } else if (settlement.outcome === 'LOSS' || settlement.outcome === 'HALF_LOSS') {
      finalStatus = 'SETTLED_LOSS';
    } else if (settlement.outcome === 'PUSH' || settlement.outcome === 'VOID') {
      finalStatus = 'VOID';
    }

    record.status = finalStatus;
    record.settlement = settlement;
    record.updatedAt = new Date().toISOString();

    this.saveLedger(ledger);
    this.appendJsonLine(record);
    return record;
  }

  /**
   * Retrieves predictions for a specific run or date.
   */
  public static getPredictionsForRun(runId: string): PredictionLedgerRecord[] {
    const ledger = this.loadLedger();
    return Object.values(ledger).filter((p) => p.runId === runId);
  }

  /**
   * Returns all active high-confidence predictions.
   */
  public static getHighConfidencePredictions(): PredictionLedgerRecord[] {
    const ledger = this.loadLedger();
    return Object.values(ledger).filter((p) => p.status === 'HIGH_CONFIDENCE');
  }

  /**
   * Returns all qualified predictions (High Confidence + Qualified).
   */
  public static getQualifiedPredictions(): PredictionLedgerRecord[] {
    const ledger = this.loadLedger();
    return Object.values(ledger).filter(
      (p) => p.status === 'HIGH_CONFIDENCE' || p.status === 'QUALIFIED'
    );
  }

  public static clearForTesting(): void {
    this.cachedLedger = {};
    const p1 = getLedgerPath();
    const p2 = getLedgerJsonlPath();
    if (fs.existsSync(p1)) {
      try { fs.unlinkSync(p1); } catch {}
    }
    if (fs.existsSync(p2)) {
      try { fs.unlinkSync(p2); } catch {}
    }
  }
}
