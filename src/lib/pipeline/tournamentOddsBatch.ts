// ============================================================================
// TOURNAMENT-LEVEL ODDS BATCH (OddsPapi v4)
// Location: src/lib/pipeline/tournamentOddsBatch.ts
// ============================================================================
// SALMO P0 — quota architecture.
//
// BEFORE (per live-pipeline cycle, x3 services AH/OU/BTTS):
//   3 x /v4/fixtures            =  3 metered calls
//   36 x /v4/odds?fixtureId=... = 36 metered calls      (12 fixtures x 3 services)
//   ------------------------------------------------------
//   39 metered calls/cycle -> ~1,170/month at 1 cycle/day = 468% of a 250 quota
//
// AFTER (shared across the three services):
//   1 x /v4/fixtures                 (identity + participant names)
//   2 x /v4/odds-by-tournaments      (one per consumed bookmaker)
//   ------------------------------------------------------
//   3 metered calls/cycle -> 90/month at 1 cycle/day = 36% of a 250 quota
//
// Evidence (data/research/provider_audit/oddspapi_batch_parity_*.json):
//   - value parity on overlap : 234/234 price points identical, 0 changedAt drift
//   - presence parity sweep   : legacyOnly=0, batchOnly=0 (15 fixture/bookmaker pairs)
//   - AH / OU / BTTS market coverage identical between both paths
//
// INVARIANTS
//   1. OddsPapi remains the ONLY production odds authority.
//   2. Every billable call is reserved/confirmed through QuotaManagerV4 via
//      NativeOddsClient. This module NEVER issues a raw fetch and NEVER invents
//      a second quota system.
//   3. FAIL-SAFE: if the batch cannot be obtained the result is DEGRADED and
//      callers must emit DATA_UNAVAILABLE. There is NO fall back to repeated
//      per-fixture /v4/odds calls — that is the failure mode this module removes.
//   4. No market semantics are altered: the fixture objects returned are the
//      provider's own, in exactly the fields the pipelines consume
//      (bookmakerOdds -> markets -> outcomes -> players -> price/changedAt).
// ============================================================================

import { z } from 'zod';
import { createNativeOddsClient, type NativeOddsClient, OddsPapiError } from '@/lib/data/providers/odds/native';
import { NativeOddsResponseSchema } from '@/lib/data/providers/odds/native';

/** Bookmakers SALMO consumes. Pinnacle is the AGENTS.md ground truth; SBOBET is
 *  the mandated secondary comparison. Nothing else is requested (quota). */
export const MAX_TOURNAMENTS_PER_BATCH_REQUEST = 5;

export const CONSUMED_BOOKMAKERS = ['pinnacle', 'sbobet'] as const;

/** Shared cache window. The three pipelines run back-to-back in one cycle and
 *  must share a single batch fetch. */
const DEFAULT_CACHE_TTL_MS = 10 * 60 * 1000;

export type BatchStatus = 'READY' | 'EMPTY' | 'DEGRADED';

export interface BatchPrimeOptions {
  /** OddsPapi tournamentIds. Multiple ids are accepted (comma separated). */
  tournamentIds: Array<number | string>;
  bookmakers?: string[];
  cacheTtlMs?: number;
}

export interface BatchPrimeResult {
  status: BatchStatus;
  bookmakersRequested: string[];
  bookmakersWithData: string[];
  /** Fixtures with at least one consumed bookmaker present. */
  fixtureCount: number;
  /** Metered OddsPapi calls issued by this prime() (0 when served by cache). */
  meteredCalls: number;
  fromCache: boolean;
  error?: string;
  errorCode?: string;
}

export interface MergedBatchFixture {
  fixtureId: string;
  tournamentId?: number;
  startTime?: string;
  /**
   * OddsPapi participant identity (names + ids) carried through from the batch
   * response so consumers can reconcile a batch fixture against a canonical
   * fixture WITHOUT issuing another provider call.
   */
  participant1Id?: number | null;
  participant2Id?: number | null;
  participant1Name?: string | null;
  participant2Name?: string | null;
  bookmakerOdds: Record<string, any>;
}

let cache: { key: string; expiresAt: number; index: Map<string, MergedBatchFixture>; result: BatchPrimeResult } | null = null;
let lastResult: BatchPrimeResult | null = null;
let clientOverride: NativeOddsClient | null = null;

/** Test seam — inject a fake transport; pass null to restore the real client. */
export function __setBatchClientForTests(c: NativeOddsClient | null): void {
  clientOverride = c;
}

/** Test seam — clear the shared cache. */
export function __resetTournamentOddsBatch(): void {
  cache = null;
  lastResult = null;
}

function client(): NativeOddsClient {
  return clientOverride ?? createNativeOddsClient();
}

function cacheKey(tournamentIds: Array<number | string>, bookmakers: string[]): string {
  return `${[...tournamentIds].map(String).sort().join(',')}|${[...bookmakers].sort().join(',')}`;
}

/**
 * Fetch (or reuse) tournament-level odds for every consumed bookmaker.
 * Never throws for provider/quota failures — inspect `status` instead.
 */
export async function primeTournamentOdds(options: BatchPrimeOptions): Promise<BatchPrimeResult> {
  const bookmakers = (options.bookmakers ?? [...CONSUMED_BOOKMAKERS]).map((b) => b.toLowerCase());
  const ttl = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const rawIds = options.tournamentIds ?? [];
  const ids = Array.from(
    new Set(
      rawIds
        .map((v) => String(v).trim())
        .filter((v) => v.length > 0 && v !== 'null' && v !== 'undefined')
    )
  ).sort((a, b) => (Number(a) || 0) - (Number(b) || 0) || a.localeCompare(b));

  if (ids.length === 0) {
    lastResult = {
      status: 'DEGRADED',
      bookmakersRequested: bookmakers,
      bookmakersWithData: [],
      fixtureCount: 0,
      meteredCalls: 0,
      fromCache: false,
      error: 'No tournamentIds supplied',
      errorCode: 'NO_TOURNAMENTS',
    };
    return lastResult;
  }

  const key = cacheKey(ids, bookmakers);
  const now = Date.now();
  if (cache && cache.key === key && cache.expiresAt > now) {
    const cached: BatchPrimeResult = { ...cache.result, fromCache: true, meteredCalls: 0 };
    lastResult = cached;
    return cached;
  }

  // Chunk tournament IDs into slices of MAX_TOURNAMENTS_PER_BATCH_REQUEST (5)
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += MAX_TOURNAMENTS_PER_BATCH_REQUEST) {
    chunks.push(ids.slice(i, i + MAX_TOURNAMENTS_PER_BATCH_REQUEST));
  }

  const index = new Map<string, MergedBatchFixture>();
  const bookmakersWithData = new Set<string>();
  const failures: Array<{ bookmaker: string; chunk?: string; error: string; code?: string }> = [];
  let meteredCalls = 0;
  let cycleAborted = false;

  for (const slug of bookmakers) {
    if (cycleAborted) break;
    for (const chunk of chunks) {
      const tournamentIds = chunk.join(',');
      try {
        const res = await client().get(
          '/odds-by-tournaments',
          { tournamentIds, bookmaker: slug, oddsFormat: 'decimal', language: 'en' },
          NativeOddsResponseSchema,
          'odds-by-tournaments'
        );
        meteredCalls += 1;
        const arr = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
        if (arr.length === 0) {
          failures.push({ bookmaker: slug, chunk: tournamentIds, error: 'empty response' });
          continue;
        }
        bookmakersWithData.add(slug);
        for (const fx of arr as any[]) {
          if (!fx?.fixtureId) continue;
          const id = String(fx.fixtureId);
          const incoming = fx.bookmakerOdds ?? {};
          const existing = index.get(id);
          if (existing) {
            existing.bookmakerOdds = { ...existing.bookmakerOdds, ...incoming };
          } else {
            index.set(id, {
              fixtureId: id,
              tournamentId: fx.tournamentId,
              startTime: fx.startTime,
              participant1Id: fx.participant1Id ?? null,
              participant2Id: fx.participant2Id ?? null,
              participant1Name: fx.participant1Name ?? null,
              participant2Name: fx.participant2Name ?? null,
              bookmakerOdds: { ...incoming },
            });
          }
        }
      } catch (err) {
        if (err instanceof OddsPapiError) {
          if (err.errorCode === 'FIXTURE_NOT_FOUND' || err.httpStatus === 404) {
            failures.push({ bookmaker: slug, chunk: tournamentIds, error: 'no odds for tournaments', code: 'FIXTURE_NOT_FOUND' });
            continue;
          }
          failures.push({ bookmaker: slug, chunk: tournamentIds, error: err.message, code: err.kind });
          if (err.kind === 'QUOTA' || err.kind === 'INVALID_KEY') {
            cycleAborted = true;
            break;
          }
        } else {
          failures.push({ bookmaker: slug, chunk: tournamentIds, error: err instanceof Error ? err.message : String(err) });
        }
      }
    }
  }

  // A terminal error (QUOTA / INVALID_KEY) aborts the cycle early: that is a
  // degradation, not an "empty market". EMPTY is reserved for a completed cycle
  // in which the provider legitimately returned no eligible fixtures.
  const terminal = failures.some((f) => f.code === 'QUOTA' || f.code === 'INVALID_KEY');
  const status: BatchStatus =
    index.size > 0
      ? 'READY'
      : terminal || bookmakers.length === 0 || failures.length >= bookmakers.length
        ? 'DEGRADED'
        : 'EMPTY';

  const result: BatchPrimeResult = {
    status,
    bookmakersRequested: bookmakers,
    bookmakersWithData: Array.from(bookmakersWithData),
    fixtureCount: index.size,
    meteredCalls,
    fromCache: false,
    error: failures.length ? failures.map((f) => `${f.bookmaker}:${f.error}`).join('; ') : undefined,
    errorCode: failures.find((f) => f.code && f.code !== 'FIXTURE_NOT_FOUND')?.code,
  };

  // Only cache usable results: a DEGRADED cycle must not be cached or it would
  // pin the pipeline in a degraded state for the whole TTL.
  if (status === 'READY') {
    cache = { key, expiresAt: now + ttl, index, result };
  }
  lastResult = result;
  return result;
}

/**
 * Resolve the odds payload for one fixture from the primed batch.
 * Returns null when the fixture has no consumed bookmaker in the batch —
 * callers must then emit DATA_UNAVAILABLE. NEVER triggers a provider call.
 */
export function getBatchedFixtureOdds(fixtureId: string | number): MergedBatchFixture | null {
  if (!cache) return null;
  return cache.index.get(String(fixtureId)) ?? null;
}

/**
 * Every fixture currently held in the primed batch index.
 * Pure read of the shared cache — NEVER triggers a provider call. Returns an
 * empty array when no batch has been primed (or the last prime degraded).
 */
export function getBatchedFixtures(): MergedBatchFixture[] {
  return cache ? Array.from(cache.index.values()) : [];
}

/** The result of the most recent prime() call (null before the first call). */
export function getLastBatchResult(): BatchPrimeResult | null {
  return lastResult;
}

/** True when the last prime() produced usable odds. */
export function isBatchReady(): boolean {
  return lastResult?.status === 'READY';
}

// ─── QUOTA-ACCOUNTED DISCOVERY (replaces the raw /v4/fixtures fetch) ─────────

/** Lenient fixture-list schema: discovery only needs identity + names, and a
 *  strict schema must never be able to break the whole pipeline cycle. */
const FixtureListSchema = z.array(
  z.object({
    fixtureId: z.union([z.string(), z.number()]),
    participant1Name: z.string().nullable().optional(),
    participant2Name: z.string().nullable().optional(),
    tournamentId: z.number().nullable().optional(),
    tournamentName: z.string().nullable().optional(),
    startTime: z.string().nullable().optional(),
    hasOdds: z.boolean().optional(),
    sportId: z.number().optional(),
  })
);

export interface FixtureIndexEntry {
  fixtureId: string;
  participant1Name: string | null;
  participant2Name: string | null;
  tournamentId: number | null;
  tournamentName: string | null;
  startTime: string | null;
  hasOdds: boolean;
}

export interface FixtureIndexResult {
  status: 'READY' | 'DEGRADED';
  fixtures: FixtureIndexEntry[];
  meteredCalls: number;
  error?: string;
  errorCode?: string;
}

/**
 * GET /v4/fixtures — quota-accounted discovery.
 * Returns an empty index (status DEGRADED) on failure; never throws and never
 * falls back to an unmetered raw fetch.
 */
export async function fetchOddsPapiFixtureIndex(params: {
  from: string;
  to: string;
  sportId?: number;
}): Promise<FixtureIndexResult> {
  try {
    const res = await client().get(
      '/fixtures',
      {
        sportId: params.sportId ?? 10,
        from: params.from,
        to: params.to,
        hasOdds: 'true',
      },
      FixtureListSchema,
      'fixtures'
    );
    const rows = (Array.isArray(res.data) ? res.data : []) as any[];
    return {
      status: 'READY',
      meteredCalls: 1,
      fixtures: rows.map((r) => ({
        fixtureId: String(r.fixtureId),
        participant1Name: r.participant1Name ?? null,
        participant2Name: r.participant2Name ?? null,
        tournamentId: r.tournamentId ?? null,
        tournamentName: r.tournamentName ?? null,
        startTime: r.startTime ?? null,
        hasOdds: r.hasOdds ?? true,
      })),
    };
  } catch (err) {
    if (err instanceof OddsPapiError) {
      return { status: 'DEGRADED', fixtures: [], meteredCalls: 0, error: err.message, errorCode: err.kind };
    }
    return {
      status: 'DEGRADED',
      fixtures: [],
      meteredCalls: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}


export interface QuotaModelInput {
  /** Live-pipeline cycles per day (one cycle = AH + OU + BTTS back-to-back). */
  cyclesPerDay: number;
  /** Fixtures probed per service per cycle (current default: 12). */
  fixturesPerService?: number;
  /** Number of live pipeline services sharing the batch. */
  services?: number;
  /** Bookmakers fetched per cycle (batch accepts exactly one per request). */
  bookmakers?: number;
}

export interface QuotaModelRow {
  fixturesCalls: number;
  oddsCalls: number;
  total: number;
  pctOfHard: number;
  pctOfSoft: number;
}

export interface QuotaModel {
  hardLimit: number;
  softLimit: number;
  current: QuotaModelRow;
  proposed: QuotaModelRow;
  /** Peak concurrency irrelevant (sequential) — kept explicit for the report. */
  note: string;
}

/**
 * Deterministic OddsPapi quota estimator.
 *  - CURRENT: per-service /v4/fixtures + N x /v4/odds  (no sharing)
 *  - PROPOSED: 1 shared /v4/fixtures + M x /v4/odds-by-tournaments per cycle
 * /v4/account is unmetered (empirically verified: 2 account calls in a 13-call
 * probe produced 0 quota delta) and is therefore excluded from both models.
 */
export function estimateQuota(options: QuotaModelInput): QuotaModel {
  const cycles = Math.max(0, options.cyclesPerDay) * 30; // per month
  const perService = Math.max(0, options.fixturesPerService ?? 12);
  const services = Math.max(1, options.services ?? 3);
  const bookmakers = Math.max(1, options.bookmakers ?? 2);
  const hardLimit = 250;
  const softLimit = 200;

  const currentFixtures = cycles * services;
  const currentOdds = cycles * services * perService;
  const currentTotal = currentFixtures + currentOdds;

  const proposedFixtures = cycles; // one shared discovery call per cycle
  const proposedOdds = cycles * bookmakers; // one shared batch call per bookmaker
  const proposedTotal = proposedFixtures + proposedOdds;

  const row = (f: number, o: number): QuotaModelRow => {
    const total = f + o;
    return {
      fixturesCalls: f,
      oddsCalls: o,
      total,
      pctOfHard: Number(((total / hardLimit) * 100).toFixed(1)),
      pctOfSoft: Number(((total / softLimit) * 100).toFixed(1)),
    };
  };

  return {
    hardLimit,
    softLimit,
    current: row(currentFixtures, currentOdds),
    proposed: row(proposedFixtures, proposedOdds),
    note:
      'PROPOSED assumes the three services share one primed batch per cycle ' +
      '(cache TTL 10 min). It does NOT include /v4/account (unmetered).',
  };
}


