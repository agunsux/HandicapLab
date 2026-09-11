// ============================================================================
// CANONICAL FIXTURE-ID MAPPING
// ============================================================================
// ONE canonical internal match identity. Provider fixture/event IDs are
// external identifiers that map to it through deterministic, auditable rules.
//
// Preferred hierarchy (Increment 2 §13):
//   1. explicit provider-ID mapping            → MAPPED (PROVIDER_ID)
//   2. team alias/normalized name + league + date → MAPPED (TEAM_ALIAS_DATE / TEAM_NORMALIZED_DATE)
//   3. no match                                → UNMAPPED
//   Multiple candidates                        → AMBIGUOUS
//   Home/away orientation or explicit-map clash → CONFLICT
//
// Never fuzzy-match. A wrong fixture is worse than an unmapped one.

import * as fs from 'fs';

export type MappingStatus = 'MAPPED' | 'UNMAPPED' | 'AMBIGUOUS' | 'CONFLICT';

export type MappingMethod =
  | 'PROVIDER_ID'
  | 'TEAM_ALIAS_DATE'
  | 'TEAM_NORMALIZED_DATE'
  | 'NONE';

export interface CanonicalFixtureRef {
  canonicalMatchId: string;
  leagueKey: string;
  homeTeam: string;
  awayTeam: string;
  /** YYYY-MM-DD — canonical dataset date precision. */
  kickoffDate: string;
  /** Precise kickoff when available (ms). Canonical historical dataset is date-only. */
  kickoffMs?: number | null;
  /** Canonical season label (e.g. 2025-2026). */
  season?: string;
  /** Canonical cluster (A/B/C) when available. */
  cluster?: string;
}

export interface ProviderFixtureRef {
  provider: string; // e.g. 'oddspapi'
  providerEventId: string;
  leagueKey: string; // resolved canonical league key
  homeTeam: string;
  awayTeam: string;
  kickoffMs: number;
}

export interface MappingDecision {
  canonicalMatchId: string | null;
  provider: string;
  providerEventId: string | null;
  status: MappingStatus;
  method: MappingMethod;
  /** 1.0 explicit id, 0.95 alias+date, 0.9 normalized+date, 0 failures. */
  confidence: number;
  homeTeam: string | null;
  awayTeam: string | null;
  kickoff: string | null; // ISO 8601
  reason: string;
}

/** leagueKey -> normalized provider name -> canonical display name. */
export type TeamAliasTable = Record<string, Record<string, string>>;

export interface MappingOptions {
  /**
   * Tolerance when BOTH sides carry precise timestamps. Canonical historical
   * rows are date-only, so the default comparison is calendar-date equality.
   */
  kickoffToleranceMs?: number;
}

export const DEFAULT_KICKOFF_TOLERANCE_MS = 90 * 60 * 1000; // 90 minutes

/**
 * Normalize a team name for comparison. Only genuine presentation differences
 * are absorbed: case, diacritics, punctuation, '&' vs 'and', whitespace.
 * Club-type suffixes are NOT stripped automatically (they can be meaningful).
 */
export function normalizeTeamName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function utcDateString(kickoffMs: number): string {
  return new Date(kickoffMs).toISOString().slice(0, 10);
}

function explicitKey(provider: string, providerEventId: string): string {
  return `${provider.toLowerCase()}:${providerEventId}`;
}

export class FixtureMappingEngine {
  private readonly canonicalById = new Map<string, CanonicalFixtureRef>();
  private readonly byLeagueDate = new Map<string, CanonicalFixtureRef[]>();
  private readonly canonicalNamesByLeague = new Map<string, Map<string, string>>();
  private readonly toleranceMs: number;

  constructor(
    canonical: CanonicalFixtureRef[],
    private readonly aliases: TeamAliasTable = {},
    options: MappingOptions = {}
  ) {
    this.toleranceMs = options.kickoffToleranceMs ?? DEFAULT_KICKOFF_TOLERANCE_MS;

    for (const ref of canonical) {
      if (!ref.canonicalMatchId || !ref.leagueKey) continue;
      this.canonicalById.set(ref.canonicalMatchId, ref);

      const key = `${ref.leagueKey}|${ref.kickoffDate}`;
      const list = this.byLeagueDate.get(key) ?? [];
      list.push(ref);
      this.byLeagueDate.set(key, list);

      const names = this.canonicalNamesByLeague.get(ref.leagueKey) ?? new Map<string, string>();
      names.set(normalizeTeamName(ref.homeTeam), ref.homeTeam);
      names.set(normalizeTeamName(ref.awayTeam), ref.awayTeam);
      this.canonicalNamesByLeague.set(ref.leagueKey, names);
    }
  }

  /**
   * Map one provider fixture to the canonical identity.
   * @param explicitMap optional `${provider}:${eventId}` -> canonicalMatchId crosswalk
   */
  map(
    ref: ProviderFixtureRef,
    explicitMap: Record<string, string> = {}
  ): MappingDecision {
    const base = {
      provider: ref.provider,
      providerEventId: ref.providerEventId ?? null,
      homeTeam: ref.homeTeam ?? null,
      awayTeam: ref.awayTeam ?? null,
      kickoff: Number.isFinite(ref.kickoffMs) ? new Date(ref.kickoffMs).toISOString() : null,
    };

    if (!ref.providerEventId || ref.providerEventId.trim() === '') {
      return { ...base, canonicalMatchId: null, status: 'UNMAPPED', method: 'NONE', confidence: 0, reason: 'MISSING_PROVIDER_EVENT_ID' };
    }

    if (!ref.leagueKey) {
      return { ...base, canonicalMatchId: null, status: 'UNMAPPED', method: 'NONE', confidence: 0, reason: 'UNMAPPED_LEAGUE' };
    }

    if (!Number.isFinite(ref.kickoffMs)) {
      return { ...base, canonicalMatchId: null, status: 'UNMAPPED', method: 'NONE', confidence: 0, reason: 'INVALID_KICKOFF' };
    }

    // 1. Explicit provider-ID mapping.
    const mappedId = explicitMap[explicitKey(ref.provider, ref.providerEventId)];
    if (mappedId) {
      const target = this.canonicalById.get(mappedId);
      if (target) {
        return { ...base, canonicalMatchId: target.canonicalMatchId, status: 'MAPPED', method: 'PROVIDER_ID', confidence: 1.0, reason: 'EXPLICIT_PROVIDER_ID' };
      }
      return { ...base, canonicalMatchId: null, status: 'CONFLICT', method: 'NONE', confidence: 0, reason: 'EXPLICIT_MAP_TARGET_MISSING' };
    }

    // 2. Resolve team names.
    const home = this.resolveTeam(ref.leagueKey, ref.homeTeam);
    const away = this.resolveTeam(ref.leagueKey, ref.awayTeam);

    if (!home.canonical) {
      return { ...base, canonicalMatchId: null, status: 'UNMAPPED', method: 'NONE', confidence: 0, reason: 'UNRESOLVED_HOME_TEAM' };
    }
    if (!away.canonical) {
      return { ...base, canonicalMatchId: null, status: 'UNMAPPED', method: 'NONE', confidence: 0, reason: 'UNRESOLVED_AWAY_TEAM' };
    }

    // 3. Candidate search: league + date (+ timestamp tolerance when available).
    const providerDate = utcDateString(ref.kickoffMs);
    const candidates = (this.byLeagueDate.get(`${ref.leagueKey}|${providerDate}`) ?? []).filter((c) => {
      if (c.kickoffMs == null) return true; // date-precision canonical row
      return Math.abs(c.kickoffMs - ref.kickoffMs) <= this.toleranceMs;
    });

    const normalizedHome = normalizeTeamName(home.canonical);
    const normalizedAway = normalizeTeamName(away.canonical);
    const direct = candidates.filter(
      (c) =>
        normalizeTeamName(c.homeTeam) === normalizedHome &&
        normalizeTeamName(c.awayTeam) === normalizedAway
    );

    const method: MappingMethod = home.viaAlias || away.viaAlias ? 'TEAM_ALIAS_DATE' : 'TEAM_NORMALIZED_DATE';
    const confidence = method === 'TEAM_ALIAS_DATE' ? 0.95 : 0.9;

    if (direct.length === 1) {
      return { ...base, canonicalMatchId: direct[0].canonicalMatchId, status: 'MAPPED', method, confidence, reason: 'TEAM_AND_DATE_MATCH' };
    }

    if (direct.length > 1) {
      return {
        ...base,
        canonicalMatchId: null,
        status: 'AMBIGUOUS',
        method: 'NONE',
        confidence: 0,
        reason: `MULTIPLE_CANONICAL_CANDIDATES:${direct.length}`,
      };
    }

    // Orientation conflict: the same two teams exist on this date but swapped.
    const swapped = candidates.filter(
      (c) =>
        normalizeTeamName(c.homeTeam) === normalizedAway &&
        normalizeTeamName(c.awayTeam) === normalizedHome
    );
    if (swapped.length > 0) {
      return { ...base, canonicalMatchId: null, status: 'CONFLICT', method: 'NONE', confidence: 0, reason: 'HOME_AWAY_ORIENTATION_CONFLICT' };
    }

    return { ...base, canonicalMatchId: null, status: 'UNMAPPED', method: 'NONE', confidence: 0, reason: 'NO_CANONICAL_FIXTURE_ON_DATE' };
  }

  private resolveTeam(leagueKey: string, rawName: string): { canonical: string | null; viaAlias: boolean } {
    if (!rawName) return { canonical: null, viaAlias: false };
    const normalized = normalizeTeamName(rawName);

    const leagueAliases = this.aliases[leagueKey] ?? {};
    const alias = leagueAliases[normalized] ?? this.aliases['*']?.[normalized];
    if (alias) {
      const names = this.canonicalNamesByLeague.get(leagueKey);
      const canonicalDisplay = names?.get(normalizeTeamName(alias));
      if (canonicalDisplay) return { canonical: canonicalDisplay, viaAlias: true };
      return { canonical: null, viaAlias: true };
    }

    const names = this.canonicalNamesByLeague.get(leagueKey);
    const canonicalDisplay = names?.get(normalized);
    if (canonicalDisplay) return { canonical: canonicalDisplay, viaAlias: false };

    return { canonical: null, viaAlias: false };
  }
}

// ─── Loaders (real, persisted files only) ─────────────────────────────

export function loadTeamAliases(filePath: string): TeamAliasTable {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  const table: TeamAliasTable = {};
  for (const [leagueKey, value] of Object.entries(raw)) {
    if (leagueKey.startsWith('_')) continue;
    if (value && typeof value === 'object') {
      table[leagueKey] = value as Record<string, string>;
    }
  }
  return table;
}

/** provider -> external tournament id -> canonical league key */
export function loadLeagueMap(filePath: string): Record<string, Record<string, string>> {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  const map: Record<string, Record<string, string>> = {};
  for (const [provider, value] of Object.entries(raw)) {
    if (provider.startsWith('_')) continue;
    if (value && typeof value === 'object') {
      map[provider.toLowerCase()] = value as Record<string, string>;
    }
  }
  return map;
}

/**
 * Build the canonical fixture index from the persisted canonical dataset
 * (JSONL). This is the same real dataset used by the gold layer.
 */
export function loadCanonicalFixturesFromJsonl(
  filePath: string,
  options: { leagueIds?: string[] } = {}
): CanonicalFixtureRef[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const refs: CanonicalFixtureRef[] = [];
  const leagueFilter = options.leagueIds ? new Set(options.leagueIds) : null;

  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(line);
    } catch {
      continue; // malformed line: skip, never guess
    }
    const leagueKey = String(row.leagueId ?? '');
    if (!leagueKey) continue;
    if (leagueFilter && !leagueFilter.has(leagueKey)) continue;
    const canonicalMatchId = String(row.canonicalId ?? '');
    const matchDate = String(row.matchDate ?? '');
    if (!canonicalMatchId || !/^\d{4}-\d{2}-\d{2}$/.test(matchDate)) continue;

    refs.push({
      canonicalMatchId,
      leagueKey,
      homeTeam: String(row.homeTeam ?? ''),
      awayTeam: String(row.awayTeam ?? ''),
      kickoffDate: matchDate,
      kickoffMs: null, // canonical historical dataset is date-precision
      season: row.season != null ? String(row.season) : undefined,
      cluster: row.cluster != null ? String(row.cluster) : undefined,
    });
  }

  return refs;
}

/** Convert a decision into a row for the provider_fixture_map audit table. */
export function decisionToMappingRow(decision: MappingDecision): Record<string, unknown> {
  return {
    provider: decision.provider,
    provider_event_id: decision.providerEventId ?? 'UNKNOWN',
    canonical_match_id: decision.canonicalMatchId,
    mapping_status: decision.status,
    mapping_method: decision.method,
    confidence: decision.confidence,
    home_team: decision.homeTeam,
    away_team: decision.awayTeam,
    kickoff: decision.kickoff,
    reason: decision.reason,
  };
}

/**
 * Detect the same provider event mapping to different canonical fixtures within
 * one batch. Returns CONFLICT decisions for the offending duplicates — never
 * silently keeps the first or last one.
 */
export function detectDuplicateProviderEvents(decisions: MappingDecision[]): MappingDecision[] {
  const seen = new Map<string, MappingDecision>();
  const conflicts: MappingDecision[] = [];

  for (const decision of decisions) {
    if (!decision.providerEventId) continue;
    const key = `${decision.provider.toLowerCase()}:${decision.providerEventId}`;
    const prior = seen.get(key);
    if (!prior) {
      seen.set(key, decision);
      continue;
    }
    if (prior.canonicalMatchId !== decision.canonicalMatchId) {
      conflicts.push({
        ...decision,
        canonicalMatchId: null,
        status: 'CONFLICT',
        method: 'NONE',
        confidence: 0,
        reason: `DUPLICATE_PROVIDER_EVENT:${prior.canonicalMatchId ?? 'NULL'}`,
      });
    }
  }

  return conflicts;
}
