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

/**
 * D2 — job_name contract.
 * MUST satisfy live_validation_job_runs CHECK
 *   (job_name IN ('scheduler','settlement','metrics','archive'))
 * (migration 00000000000036_live_validation_ops.sql). The daily production
 * pipeline is the scheduler job; 'daily-pipeline' violated the DDL and caused
 * startDurableRun() to fail silently, leaving live_validation_job_runs empty.
 */
export const JOB_NAME_DAILY_PIPELINE = 'scheduler';

export type DurableDataSource = 'DURABLE' | 'UNAVAILABLE';

/**
 * D3 — status contract.
 * MUST satisfy live_validation_job_runs CHECK
 *   (status IN ('running','succeeded','failed','skipped')).
 * Internal pipeline states are translated by toDurableJobRunStatus(); the DB
 * payload is always the lower-case contract, never the rich internal label.
 */
export type DurableJobRunStatus = 'running' | 'succeeded' | 'failed' | 'skipped';

export const DURABLE_JOB_RUN_STATUSES: readonly DurableJobRunStatus[] = [
  'running',
  'succeeded',
  'failed',
  'skipped',
];

/**
 * Explicit internal-state -> database-contract mapping (D3).
 * Fail-closed: an unknown or missing state maps to 'failed' so a failure can
 * never be recorded as a success.
 *
 *   RUNNING       -> running
 *   SUCCESS       -> succeeded
 *   PARTIAL       -> failed      (durable writes / odds retrieval incomplete)
 *   FAILED/ERROR  -> failed
 *   QUOTA_BLOCKED -> skipped
 *   SKIPPED       -> skipped
 */
export function toDurableJobRunStatus(status: string | null | undefined): DurableJobRunStatus {
  switch (String(status ?? '').trim().toUpperCase()) {
    case 'RUNNING':
      return 'running';
    case 'SUCCESS':
    case 'SUCCEEDED':
    case 'SYNCED':
      return 'succeeded';
    case 'SKIPPED':
    case 'QUOTA_BLOCKED':
    case 'NO_PICKS':
      return 'skipped';
    case 'PARTIAL':
    case 'FAILED':
    case 'ERROR':
      return 'failed';
    default:
      return 'failed';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * D1 — canonical fixture identity space.
 * CanonicalFixtureRegistry.generateCanonicalFixtureId() returns
 *   sha256(`${competitionId}:${season}:${home}:${away}:${date}`).slice(0,16)
 * i.e. exactly 16 lower-case hex characters (optionally `cm_` prefixed in the
 * bundled fixture data). This is NOT a UUID.
 *
 * VERIFIED SCHEMA REALITY: public.daily_picks.fixture_id is `UUID NOT NULL`
 * with NO foreign key to public.matches (migration 00000000000053 declares no
 * REFERENCES; PostgREST confirms "no relationship between 'daily_picks' and
 * 'matches'"). It is therefore a *fixture identity key*, not a relational
 * pointer, and the only invariants that matter are:
 *   1. the column type must be uuid (satisfied by derivation), and
 *   2. the SAME real fixture must always map to the SAME uuid, because
 *      daily_picks_UNIQUE (fixture_id, market_type, source) makes writes idempotent.
 *
 * Resolving through the `matches` table was rejected as the primary path: that
 * table is incomplete/stale and volatile, so the same fixture would resolve to
 * different ids over time and silently duplicate rows, breaking idempotency.
 * A pure function of the canonical identity is the only time-stable option.
 */
const CANONICAL_ID_RE = /^(?:cm_)?[0-9a-f]{16}$/i;

/**
 * Fixed RFC 4122 namespace for the canonical-fixture -> daily_picks identity
 * derivation. CONSTANT BY CONTRACT: changing it re-keys every durable row.
 */
export const CANONICAL_FIXTURE_UUID_NAMESPACE = '7a6f2b1c-9d4e-5a37-8b21-c4f0d9e63a55';

/** Deterministic RFC 4122 UUIDv5 (SHA-1, namespaced) of a canonical fixture id. */
export function canonicalFixtureIdToUuid(canonicalId: string): string {
  const nsBytes = Buffer.from(CANONICAL_FIXTURE_UUID_NAMESPACE.replace(/-/g, ''), 'hex');
  const nameBytes = Buffer.from(String(canonicalId).trim().toLowerCase(), 'utf8');
  const digest = crypto.createHash('sha1').update(Buffer.concat([nsBytes, nameBytes])).digest();
  const b = Buffer.from(digest.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50; // version 5
  b[8] = (b[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = b.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface DurableFixtureIdentity {
  /** uuid written to daily_picks.fixture_id. */
  fixtureId: string;
  /** How the uuid was obtained — carried into provenance for audit. */
  source: 'uuid' | 'canonical-derived';
  /** The authoritative canonical fixture id the row was generated from. */
  canonicalId: string;
}

/**
 * Explicit, deterministic, auditable fixture identity resolution (D1).
 * Returns null (fail closed) when the record carries no resolvable identity.
 * Never fabricates an id from team names or fuzzy matching.
 */
export function resolveDurableFixtureId(
  rec: Pick<PredictionLedgerRecord, 'canonicalMatchId'>
): DurableFixtureIdentity | null {
  const raw = String(rec?.canonicalMatchId ?? '').trim();
  if (!raw) return null;

  // Already a UUID (e.g. a record enriched from public.matches) — use verbatim.
  if (UUID_RE.test(raw)) {
    return { fixtureId: raw.toLowerCase(), source: 'uuid', canonicalId: raw };
  }

  // Canonical 16-hex identity (with or without the `cm_` prefix).
  if (CANONICAL_ID_RE.test(raw)) {
    const canonicalId = raw.replace(/^cm_/i, '').toLowerCase();
    return {
      fixtureId: canonicalFixtureIdToUuid(canonicalId),
      source: 'canonical-derived',
      canonicalId,
    };
  }

  return null;
}

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
  /**
   * Records folded into an existing (fixture, market) row because
   * daily_picks_UNIQUE (fixture_id, market_type, source) permits exactly ONE
   * pick per fixture per market. Informational, never counted as a failure —
   * but always reported so the collapse is observable, never silent.
   */
  collapsed: number;
  errors: string[];
  /** Set when persistence was intentionally skipped (non-production). */
  skipped: boolean;
  skipReason?: string;
}

export interface DurableRunRecord {
  runId: string;
  /** Always the database contract (D3), never the rich internal label. */
  status: DurableJobRunStatus;
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
    collapsed: 0,
    errors: [],
    skipped: true,
    skipReason: reason,
  };
}

/** The upsert key enforced by daily_picks_UNIQUE (fixture_id, market_type, source). */
function durableUpsertKey(row: Record<string, unknown>): string {
  return `${String(row.fixture_id)}|${String(row.market_type)}|${String(row.source)}`;
}

/**
 * Deterministic representative selection for records that share one
 * daily_picks upsert key. PostgREST/Postgres rejects a single INSERT/upsert
 * statement that hits the same conflict target twice
 * ("ON CONFLICT DO UPDATE command cannot affect row a second time"), so the
 * batch MUST be collapsed first.
 *
 * Selection order (fully deterministic, no randomness):
 *   1. higher confidence
 *   2. higher edge_pct
 *   3. higher model_probability
 *   4. lexicographically smaller prediction (stable tie-break)
 */
function isBetterRepresentative(candidate: Record<string, unknown>, incumbent: Record<string, unknown>): boolean {
  const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : -Infinity);
  const str = (v: unknown) => (v === null || v === undefined ? '\uffff' : String(v));
  const byConfidence = num(candidate.confidence) - num(incumbent.confidence);
  if (byConfidence !== 0) return byConfidence > 0;
  const byEdge = num(candidate.edge_pct) - num(incumbent.edge_pct);
  if (byEdge !== 0) return byEdge > 0;
  const byProb = num(candidate.model_probability) - num(incumbent.model_probability);
  if (byProb !== 0) return byProb > 0;
  return str(candidate.prediction) < str(incumbent.prediction);
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
  // D1 — deterministic canonical -> uuid fixture identity resolution.
  // Fails closed (null) when the record carries no resolvable identity; it never
  // fabricates an id and never silently drops a 16-hex canonical id.
  const identity = resolveDurableFixtureId(rec);
  if (!identity) return null;
  const fixtureId = identity.fixtureId;

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
    canonicalMatchId: identity.canonicalId,
    fixtureIdSource: identity.source,
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
        `Unrepresentable record skipped: predictionId=${rec?.predictionId ?? 'unknown'} ` +
          `canonicalMatchId=${rec?.canonicalMatchId ?? 'none'} market=${rec?.market ?? 'unknown'}`
      );
      continue;
    }
    rows.push(row);
  }

  // Collapse records that share the daily_picks unique key. The ledger emits a
  // LINE FAMILY per market (OU 1.0/1.5/.../4.0), while the schema — by design,
  // per migration 53 — stores ONE pick per fixture per market per source.
  // A single upsert statement cannot touch the same conflict target twice, so
  // without this collapse Postgres rejects the entire batch.
  const byKey = new Map<string, Record<string, unknown>>();
  const order: string[] = [];
  let collapsed = 0;
  for (const row of rows) {
    const key = durableUpsertKey(row);
    const incumbent = byKey.get(key);
    if (!incumbent) {
      byKey.set(key, row);
      order.push(key);
      continue;
    }
    collapsed++;
    if (isBetterRepresentative(row, incumbent)) byKey.set(key, row);
  }
  const deduped = order.map((k) => byKey.get(k)!);

  if (deduped.length === 0) {
    return {
      attempted: true,
      submitted: 0,
      written: 0,
      failed: invalid,
      collapsed: 0,
      errors,
      skipped: false,
    };
  }

  try {
    const supabase = await getSupabase();
    const { error } = await supabase
      .from('daily_picks')
      .upsert(deduped, { onConflict: 'fixture_id,market_type,source' });

    if (error) {
      errors.push(`daily_picks upsert failed: ${error.message}`);
      return {
        attempted: true,
        submitted: deduped.length,
        written: 0,
        failed: deduped.length + invalid,
        collapsed,
        errors,
        skipped: false,
      };
    }

    return {
      attempted: true,
      submitted: deduped.length,
      written: deduped.length,
      failed: invalid,
      collapsed,
      errors,
      skipped: false,
    };
  } catch (err: any) {
    errors.push(`daily_picks upsert threw: ${err?.message || String(err)}`);
    return {
      attempted: true,
      submitted: deduped.length,
      written: 0,
      failed: deduped.length + invalid,
      collapsed,
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
        // D3 — contract value, never 'RUNNING'.
        status: toDurableJobRunStatus('RUNNING'),
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
  result: Omit<DurableRunRecord, 'runId' | 'startedAt' | 'status'> & {
    /** Internal pipeline label (SUCCESS/PARTIAL/QUOTA_BLOCKED/...) or contract value. */
    status: DurableJobRunStatus | string;
  }
): Promise<boolean> {
  if (!isDurableStateRequired() || !id) return false;
  try {
    const supabase = await getSupabase();
    const finishedAt = result.finishedAt ?? new Date().toISOString();
    const { error } = await supabase
      .from('live_validation_job_runs')
      .update({
        // D3 — translate internal state into the live_validation_job_runs CHECK contract.
        status: toDurableJobRunStatus(result.status),
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
          status: toDurableJobRunStatus(r.status),
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


