// ============================================================================
// PRODUCTION DURABLE STATE ADAPTER
// ============================================================================
// Location: src/lib/durability/productionDurableState.ts
//
// Purpose: SALMO Production Durable State Recovery.
//
// Closes the proven production defect:
//   Predictions were written to os.tmpdir() on Vercel (ephemeral, lost between
//   invocations) and the health read model fell back to git-committed build
//   artifacts, reporting frozen timestamps as if they were live freshness.
//
// Invariants enforced:
// 1. On Vercel (production/preview) durable Supabase state is authoritative.
// 2. /tmp is NEVER used as durable storage.
// 3. Writes are idempotent via the existing daily_picks
//    UNIQUE (fixture_id, market_type, source) constraint -> safe retries.
// 4. FAIL CLOSED: a failed durable write is reported, never silently swallowed.
// 5. No new tables (no DDL path exists) -> reuse only.
// 6. No new odds provider, no quota logic, no model/decision logic.
// 7. Test/local environments are untouched: nothing is written unless
//    isDurableStateRequired() is true.
// ============================================================================

import crypto from 'crypto';
import type { PredictionLedgerRecord } from '@/lib/pipeline/dailyPredictionLedger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Binding durable source label. MUST satisfy daily_picks CHECK (source IN ('live','backtest')). */
export const DURABLE_DAILY_PICKS_SOURCE = 'live';

/** AGENTS.md Bookmaker Hierarchy: Pinnacle is the ground-truth reference bookmaker. */
export const DURABLE_BOOKMAKER = 'Pinnacle';

/** Bind status. MUST satisfy daily_picks CHECK (status IN ('PENDING','WON','LOST','PUSH')). */
export const DURABLE_INITIAL_STATUS = 'PENDING';

export const JOB_NAME_DAILY_PIPELINE = 'daily-pipeline';

export type DurableDataSource = 'DURABLE' | 'UNAVAILABLE';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DurablePersistResult {
  /** True when a durable sink was required and attempted. */
  attempted: boolean;
  /** Number of records submitted to durable storage. */
  submitted: number;
  /** Number of records successfully persisted. */
  written: number;
  /** Number of records that failed to persist (fail-closed signal). */
  failed: number;
  errors: string[];
  /** Set when persistence was intentionally skipped (non-production). */
  skipped: boolean;
  skipReason?: string;
}

export interface DurableRunRecord {
  runId: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'QUOTA_BLOCKED';
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  itemsDiscovered?: number;
  itemsProcessed?: number;
  itemsFailed?: number;
  errorMessage?: string | null;
  jobName?: string;
}

export interface DurableStateSnapshot {
  available: boolean;
  dataSource: DurableDataSource;
  degraded: boolean;
  reason: string | null;
  capturedAtUtc: string;
  latestOddsTimestampUtc: string | null;
  latestPredictionTimestampUtc: string | null;
  predictionCount: number;
  upcomingFixtureCount: number;
  latestRun: DurableRunRecord | null;
}

// ---------------------------------------------------------------------------
// Environment gate
// ---------------------------------------------------------------------------

/**
 * Durable production state is REQUIRED when running on Vercel.
 *
 * Deliberately excludes AWS_LAMBDA_FUNCTION_NAME because production is Vercel;
 * the ephemeral-file resolvers may still treat other serverless runtimes
 * locally, but this adapter only activates where the incident was observed.
 */
export function isDurableStateRequired(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
}

/** Path prefix that MUST NEVER be used as durable storage. */
export function forbiddenEphemeralPrefix(): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const os = require('os');
  return os.tmpdir();
}

function skipped(reason: string): DurablePersistResult {
  return {
    attempted: false,
    submitted: 0,
    written: 0,
    failed: 0,
    errors: [],
    skipped: true,
    skipReason: reason,
  };
}

async function getSupabase() {
  const mod = await import('@/lib/supabase.server');
  return mod.supabase;
}

// ---------------------------------------------------------------------------
// Field mapping — daily_picks (constraint-valid by construction)
// ---------------------------------------------------------------------------

/** AH -> ASIAN_HANDICAP | OU -> OVER_UNDER | BTTS -> BTTS (allowed by migration ...054). */
export function toDailyPicksMarketType(market: string): string | null {
  switch (market) {
    case 'AH':
    case 'ASIAN_HANDICAP':
      return 'ASIAN_HANDICAP';
    case 'OU':
    case 'OVER_UNDER':
      return 'OVER_UNDER';
    case 'BTTS':
      return 'BTTS';
    case 'ML':
    case 'MONEYLINE':
      return 'MONEYLINE';
    default:
      return null;
  }
}

/** MUST satisfy daily_picks CHECK (verdict IN ('LAYAK','PANTAU','LEWATI')). */
export function toDailyPicksVerdict(confidence: string): 'LAYAK' | 'PANTAU' | 'LEWATI' {
  if (confidence === 'HIGH') return 'LAYAK';
  if (confidence === 'MEDIUM') return 'PANTAU';
  return 'LEWATI';
}

function toIsoOrNull(value?: string | null): string | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return isNaN(ms) ? null : new Date(ms).toISOString();
}

function safeProbability(rec: PredictionLedgerRecord): number | null {
  const candidates = [rec.calibratedProbability, rec.modelProbability];
  for (const c of candidates) {
    if (typeof c === 'number' && isFinite(c) && c > 0 && c < 1) return c;
  }
  return null;
}

/**
 * Maps a PredictionLedgerRecord to a daily_picks row.
 * Returns null when the record cannot be represented without violating a
 * production CHECK/NOT NULL constraint (record is then counted as failed).
 */
export function toDailyPicksRow(
  rec: PredictionLedgerRecord,
  runId: string
): Record<string, unknown> | null {
  const fixtureId = String(rec.canonicalMatchId || '').trim();
  if (!UUID_RE.test(fixtureId)) return null;

  const marketType = toDailyPicksMarketType(rec.market);
  if (!marketType) return null;

  const prob = safeProbability(rec);
  if (prob === null) return null;

  const odds = typeof rec.odds === 'number' && isFinite(rec.odds) ? rec.odds : null;
  const edge = typeof rec.edge === 'number' && isFinite(rec.edge) ? rec.edge : 0;
  const confidenceScore =
    typeof rec.confidenceScore === 'number' && isFinite(rec.confidenceScore)
      ? rec.confidenceScore
      : rec.confidence === 'HIGH'
        ? 85
        : rec.confidence === 'MEDIUM'
          ? 70
          : 50;

  const predictionTs = toIsoOrNull(rec.predictionTimestamp) ?? new Date().toISOString();
  const oddsTs = toIsoOrNull(rec.oddsTimestamp);
  const kickoffTs = toIsoOrNull(rec.kickoffTimestamp);

  // Odds freshness provenance (data_age_ms) — no DDL required.
  let dataAgeMs: number | null = null;
  if (oddsTs) {
    const delta = new Date(predictionTs).getTime() - new Date(oddsTs).getTime();
    if (isFinite(delta) && delta >= 0) dataAgeMs = Math.round(delta);
  }

  // Full provenance preserved inside `reasoning` (line + odds timestamp + provider identity).
  const reasoning = JSON.stringify({
    runId,
    predictionId: rec.predictionId,
    market: rec.market,
    line: rec.line,
    oddsTimestamp: oddsTs,
    kickoffTimestamp: kickoffTs,
    bookmaker: DURABLE_BOOKMAKER,
    modelVersion: rec.modelVersion,
    featureVersion: rec.featureVersion,
    impliedProbability: rec.impliedProbability,
    expectedValue: rec.expectedValue,
    confidence: rec.confidence,
    status: rec.status,
  });

  return {
    fixture_id: fixtureId,
    league: rec.competition ?? null,
    home_team: rec.homeTeam ?? null,
    away_team: rec.awayTeam ?? null,
    kickoff_utc: kickoffTs,
    market_type: marketType,
    prediction: rec.selection ?? null,
    model_probability: prob,
    fair_odds: Number((1 / prob).toFixed(6)),
    market_odds: odds,
    market_bookmaker: DURABLE_BOOKMAKER,
    edge_pct: Number((edge * 100).toFixed(4)),
    confidence: Math.round(confidenceScore),
    verdict: toDailyPicksVerdict(rec.confidence),
    reasoning,
    status: DURABLE_INITIAL_STATUS,
    clv: null,
    source: DURABLE_DAILY_PICKS_SOURCE,
    data_age_ms: dataAgeMs,
    created_at: predictionTs,
  };
}

/** Deterministic content hash used for prediction identity / audit. */
export function computePredictionHash(rec: PredictionLedgerRecord): string {
  const canonical = [
    rec.canonicalMatchId,
    rec.market,
    rec.line ?? 'null',
    rec.selection,
    rec.modelVersion,
  ].join('|');
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

// ---------------------------------------------------------------------------
// WRITE — durable prediction persistence
// ---------------------------------------------------------------------------

/**
 * Persists prediction records to the durable `daily_picks` table.
 *
 * Idempotent: relies on the existing
 *   UNIQUE (fixture_id, market_type, source)
 * constraint, so re-running the same cron run upserts rather than duplicates.
 *
 * FAIL CLOSED: returns `failed > 0` when records could not be persisted.
 * It never silently redirects to os.tmpdir().
 */
export async function persistDailyPredictions(
  records: PredictionLedgerRecord[],
  runId: string
): Promise<DurablePersistResult> {
  if (!isDurableStateRequired()) {
    return skipped('Durable state not required (non-Vercel environment).');
  }

  const list = Array.isArray(records) ? records : [];
  const rows: Record<string, unknown>[] = [];
  const errors: string[] = [];
  let invalid = 0;

  for (const rec of list) {
    const row = toDailyPicksRow(rec, runId);
    if (!row) {
      invalid++;
      errors.push(
        `Unrepresentable record skipped: predictionId=${rec?.predictionId ?? 'unknown'} market=${rec?.market ?? 'unknown'}`
      );
      continue;
    }
    rows.push(row);
  }

  if (rows.length === 0) {
    return {
      attempted: true,
      submitted: 0,
      written: 0,
      failed: invalid,
      errors,
      skipped: false,
    };
  }

  try {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('daily_picks')
      .upsert(rows, { onConflict: 'fixture_id,market_type,source' });

    if (error) {
      errors.push(`daily_picks upsert failed: ${error.message}`);
      return {
        attempted: true,
        submitted: rows.length,
        written: 0,
        failed: rows.length + invalid,
        errors,
        skipped: false,
      };
    }

    return {
      attempted: true,
      submitted: rows.length,
      written: rows.length,
      failed: invalid,
      errors,
      skipped: false,
    };
  } catch (err: any) {
    errors.push(`daily_picks upsert threw: ${err?.message || String(err)}`);
    return {
      attempted: true,
      submitted: rows.length,
      written: 0,
      failed: rows.length + invalid,
      errors,
      skipped: false,
    };
  }
}

// ---------------------------------------------------------------------------
// WRITE — run identity / cron observability
// ---------------------------------------------------------------------------

/**
 * Records a job-run row in the existing `live_validation_job_runs` table.
 * Returns the inserted row id, or null when persistence is unavailable.
 */
export async function startDurableRun(
  runId: string,
  jobName: string = JOB_NAME_DAILY_PIPELINE,
  startedAt?: string
): Promise<string | null> {
  if (!isDurableStateRequired()) return null;
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('live_validation_job_runs')
      .insert({
        job_name: jobName,
        status: 'RUNNING',
        started_at: startedAt ?? new Date().toISOString(),
        correlation_id: runId,
        items_discovered: 0,
        items_processed: 0,
        items_failed: 0,
      })
      .select('id')
      .single();

    if (error) {
      console.error(`[ProductionDurableState] startDurableRun failed: ${error.message}`);
      return null;
    }
    return (data as { id?: string } | null)?.id ?? null;
  } catch (err: any) {
    console.error('[ProductionDurableState] startDurableRun threw:', err?.message || err);
    return null;
  }
}

/** Completes a previously started durable run record. */
export async function completeDurableRun(
  id: string | null,
  result: Omit<DurableRunRecord, 'runId' | 'startedAt'>
): Promise<boolean> {
  if (!isDurableStateRequired() || !id) return false;
  try {
    const supabase = await getSupabase();
    const finishedAt = result.finishedAt ?? new Date().toISOString();
    const { error } = await supabase
      .from('live_validation_job_runs')
      .update({
        status: result.status,
        finished_at: finishedAt,
        duration_ms: result.durationMs ?? null,
        items_discovered: result.itemsDiscovered ?? 0,
        items_processed: result.itemsProcessed ?? 0,
        items_failed: result.itemsFailed ?? 0,
        error_message: result.errorMessage ?? null,
      })
      .eq('id', id);

    if (error) {
      console.error(`[ProductionDurableState] completeDurableRun failed: ${error.message}`);
      return false;
    }
    return true;
  } catch (err: any) {
    console.error('[ProductionDurableState] completeDurableRun threw:', err?.message || err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// READ — durable production state (authoritative read model)
// ---------------------------------------------------------------------------

async function safeCount(
  supabase: any,
  table: string,
  build?: (q: any) => any
): Promise<number | null> {
  try {
    let q = supabase.from(table).select('id', { count: 'exact', head: true });
    if (build) q = build(q);
    const { count, error } = await q;
    if (error) return null;
    return typeof count === 'number' ? count : null;
  } catch {
    return null;
  }
}

async function safeLatest(
  supabase: any,
  table: string,
  column: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .order(column, { ascending: false, nullsFirst: false })
      .limit(1);
    if (error || !data || data.length === 0) return null;
    const value = (data[0] as Record<string, unknown>)[column];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

/**
 * Reads the authoritative durable production state.
 *
 * This is the read model that MUST back production health endpoints.
 * It never falls back to build-time bundles; on failure it returns
 * `available=false` / `degraded=true`, which callers surface explicitly.
 */
export async function readLatestDurableState(
  nowMs: number = Date.now()
): Promise<DurableStateSnapshot> {
  const capturedAtUtc = new Date(nowMs).toISOString();

  if (!isDurableStateRequired()) {
    return {
      available: false,
      dataSource: 'UNAVAILABLE',
      degraded: true,
      reason: 'Durable production state is only authoritative on Vercel.',
      capturedAtUtc,
      latestOddsTimestampUtc: null,
      latestPredictionTimestampUtc: null,
      predictionCount: 0,
      upcomingFixtureCount: 0,
      latestRun: null,
    };
  }

  try {
    const supabase = await getSupabase();

    const [
      latestOddsTimestampUtc,
      latestPredictionTimestampUtc,
      predictionCount,
      upcomingFixtureCount,
    ] = await Promise.all([
      safeLatest(supabase, 'odds_snapshots', 'captured_at'),
      safeLatest(supabase, 'daily_picks', 'created_at'),
      safeCount(supabase, 'daily_picks'),
      // NOTE: must use capturedAtUtc (not the destructuring target) — the
      // closure runs before destructuring assignment completes.
      safeCount(supabase, 'matches', (q: any) => q.gt('kickoff', capturedAtUtc)),
    ]);

    let latestRun: DurableRunRecord | null = null;
    try {
      const { data, error } = await supabase
        .from('live_validation_job_runs')
        .select('*')
        .eq('job_name', JOB_NAME_DAILY_PIPELINE)
        .order('started_at', { ascending: false })
        .limit(1);
      if (!error && data && data.length > 0) {
        const r = data[0] as Record<string, any>;
        latestRun = {
          runId: String(r.correlation_id ?? r.id ?? ''),
          status: (r.status ?? 'RUNNING') as DurableRunRecord['status'],
          startedAt: r.started_at ?? capturedAtUtc,
          finishedAt: r.finished_at ?? null,
          durationMs: r.duration_ms ?? null,
          itemsDiscovered: r.items_discovered ?? 0,
          itemsProcessed: r.items_processed ?? 0,
          itemsFailed: r.items_failed ?? 0,
          errorMessage: r.error_message ?? null,
          jobName: r.job_name ?? JOB_NAME_DAILY_PIPELINE,
        };
      }
    } catch {
      /* run observability is optional for availability */
    }

    const anyReadSucceeded =
      latestOddsTimestampUtc !== null ||
      latestPredictionTimestampUtc !== null ||
      predictionCount !== null;

    return {
      available: anyReadSucceeded,
      dataSource: anyReadSucceeded ? 'DURABLE' : 'UNAVAILABLE',
      degraded: !anyReadSucceeded,
      reason: anyReadSucceeded ? null : 'All durable reads failed.',
      capturedAtUtc,
      latestOddsTimestampUtc,
      latestPredictionTimestampUtc,
      predictionCount: predictionCount ?? 0,
      upcomingFixtureCount: upcomingFixtureCount ?? 0,
      latestRun,
    };
  } catch (err: any) {
    return {
      available: false,
      dataSource: 'UNAVAILABLE',
      degraded: true,
      reason: `Durable read threw: ${err?.message || String(err)}`,
      capturedAtUtc,
      latestOddsTimestampUtc: null,
      latestPredictionTimestampUtc: null,
      predictionCount: 0,
      upcomingFixtureCount: 0,
      latestRun: null,
    };
  }
}

/** Persistence availability summary for health reporting. */
export async function getDurableStateHealth(): Promise<{
  required: boolean;
  available: boolean;
  degraded: boolean;
  reason: string | null;
}> {
  const required = isDurableStateRequired();
  if (!required) {
    return { required: false, available: false, degraded: false, reason: null };
  }
  const snapshot = await readLatestDurableState();
  return {
    required: true,
    available: snapshot.available,
    degraded: snapshot.degraded,
    reason: snapshot.reason,
  };
}


