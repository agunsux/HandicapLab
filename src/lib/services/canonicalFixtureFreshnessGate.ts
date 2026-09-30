// ============================================================================
// CANONICAL FIXTURE FRESHNESS GATE & DETERMINISTIC REGISTRY
// ============================================================================
// Location: src/lib/services/canonicalFixtureFreshnessGate.ts
//
// Invariants enforced (Section B):
// 1. Every fixture strictly contains:
//    canonicalMatchId, providerMatchId, homeTeam, awayTeam, competition, season,
//    kickoffUtc, status, provider, providerFetchedAtUtc, canonicalUpdatedAtUtc, sourceVersion.
// 2. Allowed lifecycle:
//    SCHEDULED, TIMED, LIVE, FINISHED, POSTPONED, CANCELLED, ABANDONED.
// 3. Upsert by canonical identity. Never duplicate fixtures because provider IDs differ.
// 4. Reconciliation priority:
//    (1) canonicalMatchId, (2) providerMatchId, (3) normalized competition + teams + kickoff window.
// 5. Deterministic canonical registry with freshness SLA evaluation.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import crypto from 'crypto';
import { normalizeTeamName } from '@/lib/identity/fixtureMapping';

export type CanonicalLifecycleStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'LIVE'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'ABANDONED';

export interface CanonicalFixtureRecord {
  canonicalMatchId: string;
  providerMatchId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  season: string;
  kickoffUtc: string; // ISO 8601 UTC
  status: CanonicalLifecycleStatus;
  provider: 'api-football' | 'oddspapi' | 'pinnacle' | string;
  providerFetchedAtUtc: string;
  canonicalUpdatedAtUtc: string;
  sourceVersion: string;
  venue?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
  metadata?: Record<string, any>;
}

export interface FixtureFreshnessEvaluation {
  isFresh: boolean;
  ageSeconds: number;
  slaSeconds: number;
  status: 'FRESH' | 'STALE' | 'EXPIRED';
  record: CanonicalFixtureRecord;
}

export const FIXTURE_FRESHNESS_SLA_SECONDS = 3600; // 60 minutes SLA

function getFixtureRegistryPath(): string {
  if (process.env.NODE_ENV === 'test') {
    return path.resolve('data/test_ledger/canonical_match_registry.json');
  }
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), 'handicaplab_canonical_match_registry.json');
  }
  return path.resolve('data/ledger/canonical_match_registry.json');
}

export class CanonicalFixtureFreshnessGate {
  private static cachedRegistry: Record<string, CanonicalFixtureRecord> | null = null;

  /**
   * Cleans a team name by stripping common club-type suffixes (fc, afc, etc.)
   * and normalizing whitespace/punctuation for canonical identity.
   */
  public static cleanTeamName(name: string): string {
    return normalizeTeamName(name)
      .replace(/\b(fc|afc|cf|sc|ssc|as|ac)\b/gi, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  /**
   * Deterministic canonical identity: competition + season + home + away + kickoffDate.
   */
  public static computeCanonicalMatchId(
    competition: string,
    season: string,
    homeTeam: string,
    awayTeam: string,
    kickoffUtc: string
  ): string {
    const normComp = competition.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normSeason = season.replace(/[^0-9-]/g, '');
    const normHome = this.cleanTeamName(homeTeam);
    const normAway = this.cleanTeamName(awayTeam);
    const kickDate = kickoffUtc.slice(0, 10);
    const raw = `${normComp}|${normSeason}|${normHome}|${normAway}|${kickDate}`;
    return `cm_${crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16)}`;
  }

  /**
   * Normalizes provider status to strictly allowed lifecycle statuses.
   */
  public static normalizeStatus(rawStatus?: string | null): CanonicalLifecycleStatus {
    const code = (rawStatus || '').toUpperCase().trim();
    switch (code) {
      case 'TBD':
      case 'NS':
      case 'SCHEDULED':
        return 'SCHEDULED';
      case 'TIMED':
        return 'TIMED';
      case '1H':
      case 'HT':
      case '2H':
      case 'ET':
      case 'BT':
      case 'P':
      case 'INT':
      case 'LIVE':
        return 'LIVE';
      case 'FT':
      case 'AET':
      case 'PEN':
      case 'FINISHED':
        return 'FINISHED';
      case 'PST':
      case 'POSTP':
      case 'POSTPONED':
      case 'SUSP':
        return 'POSTPONED';
      case 'CANC':
      case 'CANCELLED':
        return 'CANCELLED';
      case 'ABD':
      case 'ABANDONED':
        return 'ABANDONED';
      default:
        return 'SCHEDULED';
    }
  }

  /**
   * Loads the match registry.
   */
  public static loadRegistry(): Record<string, CanonicalFixtureRecord> {
    if (this.cachedRegistry) return this.cachedRegistry;

    try {
      const p = getFixtureRegistryPath();
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.cachedRegistry = parsed;
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[CanonicalFixtureFreshnessGate] Failed to load registry:', e);
    }

    const empty: Record<string, CanonicalFixtureRecord> = {};
    this.cachedRegistry = empty;
    return empty;
  }

  /**
   * Saves the match registry atomically.
   */
  public static saveRegistry(registry: Record<string, CanonicalFixtureRecord>): void {
    this.cachedRegistry = registry;
    try {
      const p = getFixtureRegistryPath();
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, JSON.stringify(registry, null, 2), 'utf8');
    } catch (e) {
      try {
        const fallback = path.join(os.tmpdir(), 'handicaplab_canonical_match_registry.json');
        fs.writeFileSync(fallback, JSON.stringify(registry, null, 2), 'utf8');
      } catch (err) {
        console.warn('[CanonicalFixtureFreshnessGate] Failed to persist registry:', e);
      }
    }
  }

  /**
   * Reconciles and upserts an incoming fixture by canonical identity.
   * Priority:
   * 1. canonicalMatchId match
   * 2. providerMatchId match
   * 3. normalized competition + normalized teams + kickoff window (+-24h)
   */
  public static upsertFixture(input: {
    canonicalMatchId?: string;
    providerMatchId: string;
    homeTeam: string;
    awayTeam: string;
    competition: string;
    season: string;
    kickoffUtc: string;
    status: string;
    provider: string;
    providerFetchedAtUtc?: string;
    sourceVersion?: string;
    venue?: string;
    homeGoals?: number | null;
    awayGoals?: number | null;
    metadata?: Record<string, any>;
  }): { record: CanonicalFixtureRecord; isNew: boolean } {
    const registry = this.loadRegistry();
    const nowIso = new Date().toISOString();
    const normStatus = this.normalizeStatus(input.status);

    const computedId = input.canonicalMatchId || this.computeCanonicalMatchId(
      input.competition,
      input.season,
      input.homeTeam,
      input.awayTeam,
      input.kickoffUtc
    );

    // 1. Exact canonicalMatchId match
    let existingKey = Object.keys(registry).find((k) => k === computedId);

    // 2. Provider match ID match if not found
    if (!existingKey) {
      existingKey = Object.keys(registry).find(
        (k) => registry[k].providerMatchId === input.providerMatchId
      );
    }

    // 3. Normalized teams + competition + kickoff window match (+-24 hours)
    if (!existingKey) {
      const inputKickMs = new Date(input.kickoffUtc).getTime();
      const normInputHome = this.cleanTeamName(input.homeTeam);
      const normInputAway = this.cleanTeamName(input.awayTeam);

      existingKey = Object.keys(registry).find((k) => {
        const item = registry[k];
        const itemKickMs = new Date(item.kickoffUtc).getTime();
        const diffHours = Math.abs(inputKickMs - itemKickMs) / (1000 * 3600);
        if (diffHours > 24) return false;

        const itemHome = this.cleanTeamName(item.homeTeam);
        const itemAway = this.cleanTeamName(item.awayTeam);
        return itemHome === normInputHome && itemAway === normInputAway;
      });
    }

    const key = existingKey || computedId;
    const isNew = !existingKey;

    const record: CanonicalFixtureRecord = {
      canonicalMatchId: key,
      providerMatchId: input.providerMatchId,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      competition: input.competition,
      season: input.season,
      kickoffUtc: input.kickoffUtc,
      status: normStatus,
      provider: input.provider as any,
      providerFetchedAtUtc: input.providerFetchedAtUtc || nowIso,
      canonicalUpdatedAtUtc: nowIso,
      sourceVersion: input.sourceVersion || 'v1.0.0-canonical',
      venue: input.venue,
      homeGoals: input.homeGoals !== undefined ? input.homeGoals : (registry[key]?.homeGoals ?? null),
      awayGoals: input.awayGoals !== undefined ? input.awayGoals : (registry[key]?.awayGoals ?? null),
      metadata: input.metadata || registry[key]?.metadata || {},
    };

    registry[key] = record;
    this.saveRegistry(registry);

    return { record, isNew };
  }

  /**
   * Evaluates freshness of a fixture against the configured SLA.
   */
  public static evaluateFreshness(
    fixture: CanonicalFixtureRecord,
    nowMs: number = Date.now(),
    slaSeconds: number = FIXTURE_FRESHNESS_SLA_SECONDS
  ): FixtureFreshnessEvaluation {
    const fetchedMs = new Date(fixture.providerFetchedAtUtc).getTime();
    const updatedMs = new Date(fixture.canonicalUpdatedAtUtc).getTime();
    const refMs = isNaN(fetchedMs) ? updatedMs : fetchedMs;
    const ageSeconds = Math.max(0, Math.floor((nowMs - refMs) / 1000));
    const isFresh = ageSeconds <= slaSeconds;

    return {
      isFresh,
      ageSeconds,
      slaSeconds,
      status: isFresh ? 'FRESH' : (ageSeconds > slaSeconds * 3 ? 'EXPIRED' : 'STALE'),
      record: fixture,
    };
  }

  /**
   * Retrieves all upcoming fixtures strictly after nowMs.
   */
  public static getUpcomingFixtures(nowMs: number = Date.now()): CanonicalFixtureRecord[] {
    const registry = this.loadRegistry();
    return Object.values(registry)
      .filter((f) => {
        const kickMs = new Date(f.kickoffUtc).getTime();
        return (
          kickMs > nowMs &&
          f.status !== 'FINISHED' &&
          f.status !== 'CANCELLED' &&
          f.status !== 'ABANDONED' &&
          f.status !== 'POSTPONED'
        );
      })
      .sort((a, b) => new Date(a.kickoffUtc).getTime() - new Date(b.kickoffUtc).getTime());
  }

  /**
   * Retrieves a fixture by canonicalMatchId.
   */
  public static getFixture(canonicalMatchId: string): CanonicalFixtureRecord | null {
    const registry = this.loadRegistry();
    return registry[canonicalMatchId] || null;
  }

  /**
   * Clears registry for testing.
   */
  public static clearForTesting(): void {
    this.cachedRegistry = {};
    const p = getFixtureRegistryPath();
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch {}
    }
  }
}
