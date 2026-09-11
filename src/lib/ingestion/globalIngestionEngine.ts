// ============================================================================
// CANONICAL GLOBAL INTELLIGENT INGESTION ENGINE (CHECKPOINT C)
// ============================================================================
// Turns the global football competition universe into a provenance-safe,
// freshness-aware, quota-governed data acquisition pipeline.
//
// Invariants:
//   - Strict fail-closed: NO mock data, NO synthetic fixtures, NO fabricated odds.
//   - Quota-governed: all requests route through ProviderGateway + QuotaManagerV4.
//   - Deterministic Canonical Identity: league|season|date|homeSlug|awaySlug.
//   - Deduplication & Quarantine: duplicates rejected, ambiguities quarantined.
//   - Lineage preservation: provider -> Bronze -> Silver -> Canonical -> Persistence.
//   - Granular market readiness: RESULT_READY, AH_READY, OU_READY, BTTS_READY, ML_READY.

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { apiFootballClient, type ApiFootballFixtureResponseItemSchema } from '@/lib/apis/apifootball';
import {
  type GlobalLeague,
  type LeagueTier,
  type LeagueIngestionState,
  type MarketReadiness,
  type LeagueCoverageMatrixItem,
  buildCoverageMatrix,
} from '@/lib/config/leagueRegistry';
import { supabase } from '@/lib/supabase.server';
import { getQuotaSnapshot } from '@/lib/providers/quotaManagerV4';
import { z } from 'zod';

export type RawFixtureItem = z.infer<typeof ApiFootballFixtureResponseItemSchema>;

// ─── 1. Canonical Identity & Team Normalization ──────────────────────────────

export function teamSlug(name: string): string {
  return (name || 'unknown')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function canonicalMatchIdOf(
  leagueId: number | string,
  season: number | string,
  kickoffDateIso: string,
  homeTeam: string,
  awayTeam: string
): string {
  const dateOnly = (kickoffDateIso || '').slice(0, 10);
  return `${leagueId}|${season}|${dateOnly}|${teamSlug(homeTeam)}|${teamSlug(awayTeam)}`;
}

// ─── 2. Deterministic Scoreline Result Derivation ────────────────────────────

export type ResultOutcome = 'H' | 'D' | 'A';

export function deriveResult(homeGoals: number | null, awayGoals: number | null): ResultOutcome | null {
  if (homeGoals === null || awayGoals === null) return null;
  if (homeGoals > awayGoals) return 'H';
  if (homeGoals < awayGoals) return 'A';
  return 'D';
}

export interface DerivedScorelineMarkets {
  result: ResultOutcome | null;
  totalGoals: number | null;
  homeWin: boolean | null;
  draw: boolean | null;
  awayWin: boolean | null;
  btts: boolean | null;
  over15: boolean | null;
  over25: boolean | null;
  over35: boolean | null;
  under15: boolean | null;
  under25: boolean | null;
  under35: boolean | null;
}

export function deriveScorelineMarkets(homeGoals: number | null, awayGoals: number | null): DerivedScorelineMarkets {
  if (homeGoals === null || awayGoals === null) {
    return {
      result: null,
      totalGoals: null,
      homeWin: null,
      draw: null,
      awayWin: null,
      btts: null,
      over15: null,
      over25: null,
      over35: null,
      under15: null,
      under25: null,
      under35: null,
    };
  }

  const total = homeGoals + awayGoals;
  return {
    result: deriveResult(homeGoals, awayGoals),
    totalGoals: total,
    homeWin: homeGoals > awayGoals,
    draw: homeGoals === awayGoals,
    awayWin: homeGoals < awayGoals,
    btts: homeGoals > 0 && awayGoals > 0,
    over15: total > 1.5,
    over25: total > 2.5,
    over35: total > 3.5,
    under15: total < 1.5,
    under25: total < 2.5,
    under35: total < 3.5,
  };
}

// ─── 3. Ingestion Priority Formula ───────────────────────────────────────────

/**
 * Priority scoring formula strictly based on verified provider data:
 * 30% historical depth + 25% fixture availability + 20% odds availability + 15% market coverage potential + 10% data quality.
 * Note: Excludes ROI or predictability scores.
 */
export function calculateIngestionPriority(league: GlobalLeague): number {
  const depthScores: Record<string, number> = {
    '7_PLUS': 100,
    '5_PLUS': 80,
    '3_4_SEASONS': 50,
    '1_2_SEASONS': 25,
    '<1_SEASON': 0,
    'UNKNOWN': 0,
  };
  const depthScore = depthScores[league.historical_depth] ?? 0;

  const seasonsAvail = league.seasons_available ?? 0;
  const fixtureScore =
    seasonsAvail >= 7 ? 100 :
    seasonsAvail >= 5 ? 80 :
    seasonsAvail >= 3 ? 50 :
    seasonsAvail >= 1 ? 25 : 0;

  const oddsScore =
    league.odds_availability === 'PARTIAL' ? 100 :
    league.odds_availability === 'UNKNOWN' ? 30 : 0;

  const tierPotentialScores: Record<LeagueTier, number> = {
    CORE: 100,
    HIGH_VALUE: 80,
    RESEARCH: 50,
    LOW_LIQUIDITY: 30,
    LIMITED_DATA: 10,
    UNSUPPORTED: 0,
  };
  const marketScore = tierPotentialScores[league.tier] ?? 0;

  const qualityScore = Math.max(0, Math.min(100, league.data_quality_score ?? 0));

  return Math.round(
    0.30 * depthScore +
    0.25 * fixtureScore +
    0.20 * oddsScore +
    0.15 * marketScore +
    0.10 * qualityScore
  );
}

// ─── 4. Freshness Policy ─────────────────────────────────────────────────────

export type FixtureFreshnessCategory =
  | 'FINISHED_HISTORICAL'
  | 'UPCOMING'
  | 'NEAR_KICKOFF'
  | 'LIVE'
  | 'FINAL';

export function categorizeFixtureFreshness(status: string, kickoffIso: string): FixtureFreshnessCategory {
  const finalStatuses = new Set(['FT', 'AET', 'PEN', 'AWD', 'WO', 'CANC', 'ABD']);
  const liveStatuses = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'INT', 'LIVE']);

  if (liveStatuses.has(status)) return 'LIVE';
  if (finalStatuses.has(status)) return 'FINAL';

  const kickoffMs = new Date(kickoffIso).getTime();
  const diffMs = kickoffMs - Date.now();

  if (diffMs <= 2 * 60 * 60 * 1000 && diffMs >= 0) return 'NEAR_KICKOFF';
  return 'UPCOMING';
}

export function isHistoricalSeasonFinalized(seasonYear: number): boolean {
  const currentYear = new Date().getFullYear();
  return seasonYear < currentYear - 1;
}

// ─── 5. Canonical Ingested Match Data Model ──────────────────────────────────

export interface CanonicalIngestedMatch {
  canonical_match_id: string;
  provider: 'apifootball';
  provider_fixture_id: string;
  league_id: number;
  league_name: string;
  country: string;
  season: number;
  home_team: string;
  away_team: string;
  home_team_id: number;
  away_team_id: number;
  kickoff: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  markets: DerivedScorelineMarkets;
  has_odds_data: boolean;
  market_availability: {
    AH: boolean;
    OU: boolean;
    BTTS: boolean;
    ML: boolean;
  };
  provenance: {
    source_endpoint: string;
    source_timestamp: string;
    ingested_at: string;
    dataset_version: string;
    raw_checksum: string;
  };
}

export interface QuarantinedFixture {
  provider_fixture_id: string;
  league_id: number;
  season: number;
  home_team: string;
  away_team: string;
  kickoff: string;
  reason: string;
  timestamp: string;
}

export interface LeagueIngestionSummary {
  league_id: number;
  league_name: string;
  country: string;
  seasons_processed: number[];
  fixtures_ingested: number;
  historical_matches: number;
  upcoming_matches: number;
  duplicates_rejected: number;
  quarantined_count: number;
  requests_consumed: number;
  state: LeagueIngestionState;
  readiness: MarketReadiness;
  error?: string;
}

// ─── 6. Bronze & Lakehouse Storage Abstraction ───────────────────────────────

export class IngestionLakehouse {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || path.join(process.cwd(), 'data', 'lakehouse');
  }

  public saveBronzePayload(params: {
    provider: string;
    leagueId: number;
    season: number;
    endpoint: string;
    payload: any;
  }): { path: string; checksum: string; skipped: boolean } {
    const { provider, leagueId, season, endpoint, payload } = params;
    const rawString = JSON.stringify(payload);
    const checksum = crypto.createHash('sha256').update(rawString).digest('hex');

    const bronzeDir = path.join(this.baseDir, 'bronze', provider, String(leagueId), String(season));
    fs.mkdirSync(bronzeDir, { recursive: true });

    const rawPath = path.join(bronzeDir, `${endpoint}_${checksum.slice(0, 12)}.json`);
    if (fs.existsSync(rawPath)) {
      return { path: rawPath, checksum, skipped: true };
    }

    fs.writeFileSync(rawPath, rawString, 'utf-8');
    return { path: rawPath, checksum, skipped: false };
  }

  public saveSilverMatches(params: {
    leagueId: number;
    season: number;
    matches: CanonicalIngestedMatch[];
  }): { path: string; count: number } {
    const { leagueId, season, matches } = params;
    const silverDir = path.join(this.baseDir, 'silver', 'apifootball', String(leagueId), String(season));
    fs.mkdirSync(silverDir, { recursive: true });

    const silverPath = path.join(silverDir, 'canonical_matches.jsonl');
    const lines = matches.map((m) => JSON.stringify(m)).join('\n');
    fs.writeFileSync(silverPath, lines + (matches.length > 0 ? '\n' : ''), 'utf-8');

    return { path: silverPath, count: matches.length };
  }
}

// ─── 7. Global Intelligent Ingestion Engine ──────────────────────────────────

export class GlobalIngestionEngine {
  private lakehouse: IngestionLakehouse;
  private readonly quarantined: QuarantinedFixture[] = [];
  private totalRequestsConsumed = 0;
  private totalProviderErrors = 0;

  constructor(customLakehouse?: IngestionLakehouse) {
    this.lakehouse = customLakehouse || new IngestionLakehouse();
  }

  /**
   * Evaluates eligibility of a discovered competition for ingestion.
   */
  public evaluateEligibility(league: GlobalLeague): { eligible: boolean; reason: string } {
    if (league.type === 'cup') {
      return { eligible: false, reason: 'CUP_COMPETITION_EXCLUDED' };
    }
    if (league.tier === 'UNSUPPORTED') {
      return { eligible: false, reason: 'TIER_UNSUPPORTED' };
    }
    if (league.seasons_available < 1) {
      return { eligible: false, reason: 'NO_SEASONS_AVAILABLE' };
    }
    return { eligible: true, reason: 'ELIGIBLE_CONTINUOUS_LEAGUE' };
  }

  /**
   * Normalizes a raw API-Football fixture into a canonical ingested match.
   */
  public normalizeFixture(
    raw: RawFixtureItem,
    league: GlobalLeague,
    season: number,
    rawChecksum: string
  ): { match: CanonicalIngestedMatch | null; quarantineReason?: string } {
    const f = raw.fixture;
    if (!f || !f.id) {
      return { match: null, quarantineReason: 'MISSING_FIXTURE_ID' };
    }

    const homeTeam = raw.teams?.home?.name;
    const awayTeam = raw.teams?.away?.name;
    if (!homeTeam || !awayTeam) {
      return { match: null, quarantineReason: 'MISSING_TEAM_NAMES' };
    }

    const kickoffIso = f.date || new Date(f.timestamp * 1000).toISOString();
    const dateOnly = kickoffIso.slice(0, 10);
    if (!dateOnly || isNaN(new Date(kickoffIso).getTime())) {
      return { match: null, quarantineReason: 'INVALID_KICKOFF_DATE' };
    }

    const canonicalId = canonicalMatchIdOf(league.league_id, season, dateOnly, homeTeam, awayTeam);
    const homeScore = raw.goals?.home ?? null;
    const awayScore = raw.goals?.away ?? null;
    const markets = deriveScorelineMarkets(homeScore, awayScore);

    // Odds presence check on fixture object
    // API-Football fixtures endpoint does not bundle closing odds; odds availability is cataloged separately
    const hasOdds = false;

    return {
      match: {
        canonical_match_id: canonicalId,
        provider: 'apifootball',
        provider_fixture_id: String(f.id),
        league_id: league.league_id,
        league_name: league.name,
        country: league.country,
        season,
        home_team: homeTeam,
        away_team: awayTeam,
        home_team_id: raw.teams?.home?.id ?? 0,
        away_team_id: raw.teams?.away?.id ?? 0,
        kickoff: kickoffIso,
        status: f.status?.short || 'UNKNOWN',
        home_score: homeScore,
        away_score: awayScore,
        markets,
        has_odds_data: hasOdds,
        market_availability: {
          AH: false,
          OU: false,
          BTTS: false,
          ML: false,
        },
        provenance: {
          source_endpoint: 'fixtures',
          source_timestamp: new Date().toISOString(),
          ingested_at: new Date().toISOString(),
          dataset_version: 'handicaplab-v2-checkpoint-c',
          raw_checksum: rawChecksum,
        },
      },
    };
  }

  /**
   * Ingests real fixtures for a specific league and season.
   * Preserves QuotaManagerV4, ProviderGateway, Bronze, Silver, and Supabase.
   */
  public async ingestLeagueSeason(
    league: GlobalLeague,
    season: number,
    options: {
      skipDatabaseSync?: boolean;
      priorityLevel?: number; // 0-100
    } = {}
  ): Promise<{
    matches: CanonicalIngestedMatch[];
    duplicatesRejected: number;
    quarantined: number;
    historicalCount: number;
    upcomingCount: number;
    requestsUsed: number;
  }> {
    const priorityLevel = options.priorityLevel ?? (isHistoricalSeasonFinalized(season) ? 50 : 90);

    // Call API-Football via canonical client (routes through globalGateway + QuotaManagerV4)
    let envelope;
    try {
      envelope = await apiFootballClient.getFixtures(league.league_id, season);
      this.totalRequestsConsumed += 1;
    } catch (err: any) {
      this.totalProviderErrors += 1;
      console.error(`[IngestionEngine] API-Football fetch failed for league ${league.league_id} season ${season}:`, err.message);
      throw err; // Fail closed
    }

    const rawList: RawFixtureItem[] = envelope.response ?? [];

    // Save to Bronze Layer
    const bronze = this.lakehouse.saveBronzePayload({
      provider: 'apifootball',
      leagueId: league.league_id,
      season,
      endpoint: 'fixtures',
      payload: rawList,
    });

    const matches: CanonicalIngestedMatch[] = [];
    const seenProviderIds = new Set<string>();
    const seenCanonicalIds = new Map<string, CanonicalIngestedMatch>();
    let duplicatesRejected = 0;
    let quarantinedCount = 0;
    let historicalCount = 0;
    let upcomingCount = 0;

    for (const raw of rawList) {
      const { match, quarantineReason } = this.normalizeFixture(raw, league, season, bronze.checksum);

      if (quarantineReason || !match) {
        quarantinedCount += 1;
        this.quarantined.push({
          provider_fixture_id: String(raw.fixture?.id ?? 'unknown'),
          league_id: league.league_id,
          season,
          home_team: raw.teams?.home?.name ?? 'unknown',
          away_team: raw.teams?.away?.name ?? 'unknown',
          kickoff: raw.fixture?.date ?? new Date().toISOString(),
          reason: quarantineReason || 'NORMALIZATION_FAILED',
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      // Check Provider ID Duplicate
      if (seenProviderIds.has(match.provider_fixture_id)) {
        duplicatesRejected += 1;
        continue;
      }
      seenProviderIds.add(match.provider_fixture_id);

      // Check Canonical ID Duplicate / Conflict
      const existingCanonical = seenCanonicalIds.get(match.canonical_match_id);
      if (existingCanonical) {
        // Conflicting scoreline or different provider ID for same canonical identity
        if (
          existingCanonical.home_score !== match.home_score ||
          existingCanonical.away_score !== match.away_score
        ) {
          quarantinedCount += 1;
          this.quarantined.push({
            provider_fixture_id: match.provider_fixture_id,
            league_id: league.league_id,
            season,
            home_team: match.home_team,
            away_team: match.away_team,
            kickoff: match.kickoff,
            reason: `CANONICAL_CONFLICT_WITH_${existingCanonical.provider_fixture_id}`,
            timestamp: new Date().toISOString(),
          });
          continue;
        }
        duplicatesRejected += 1;
        continue;
      }

      seenCanonicalIds.set(match.canonical_match_id, match);
      matches.push(match);

      const freshness = categorizeFixtureFreshness(match.status, match.kickoff);
      if (freshness === 'FINAL' || freshness === 'FINISHED_HISTORICAL') {
        historicalCount += 1;
      } else {
        upcomingCount += 1;
      }
    }

    // Save to Silver Layer
    this.lakehouse.saveSilverMatches({
      leagueId: league.league_id,
      season,
      matches,
    });

    // Optional Database Persistence into matches table
    if (!options.skipDatabaseSync && matches.length > 0) {
      try {
        const rowsToInsert = matches.map((m) => ({
          fixture_id: m.provider_fixture_id,
          league: m.league_name,
          league_id: m.league_id,
          season: m.season,
          home_team: m.home_team,
          away_team: m.away_team,
          kickoff: m.kickoff,
          status: m.status,
          home_score: m.home_score,
          away_score: m.away_score,
          data_status: 'REAL',
        }));

        await supabase.from('matches').upsert(rowsToInsert as any, {
          onConflict: 'fixture_id',
          ignoreDuplicates: false,
        });
      } catch (dbErr: any) {
        // Log database failure but do not break Lakehouse persistence
        console.warn(`[IngestionEngine] Supabase matches upsert notice: ${dbErr.message}`);
      }
    }

    return {
      matches,
      duplicatesRejected,
      quarantined: quarantinedCount,
      historicalCount,
      upcomingCount,
      requestsUsed: 1,
    };
  }

  /**
   * Ingests a complete league across its active and historical seasons.
   */
  public async ingestLeague(
    league: GlobalLeague,
    options: {
      targetSeasons?: number[];
      skipDatabaseSync?: boolean;
    } = {}
  ): Promise<LeagueIngestionSummary> {
    const eligibility = this.evaluateEligibility(league);
    if (!eligibility.eligible) {
      return {
        league_id: league.league_id,
        league_name: league.name,
        country: league.country,
        seasons_processed: [],
        fixtures_ingested: 0,
        historical_matches: 0,
        upcoming_matches: 0,
        duplicates_rejected: 0,
        quarantined_count: 0,
        requests_consumed: 0,
        state: 'UNAVAILABLE',
        readiness: {
          RESULT_READY: false,
          AH_READY: false,
          OU_READY: false,
          BTTS_READY: false,
          ML_READY: false,
        },
        error: eligibility.reason,
      };
    }

    const seasonsToProcess = options.targetSeasons && options.targetSeasons.length > 0
      ? options.targetSeasons
      : league.all_seasons.length > 0
        ? [league.season] // Default to current season for controlled step
        : [league.season];

    let totalIngested = 0;
    let totalHistorical = 0;
    let totalUpcoming = 0;
    let totalDuplicates = 0;
    let totalQuarantined = 0;
    let totalRequests = 0;
    const processedSeasons: number[] = [];

    league.ingestion_status = 'INGESTING';

    try {
      for (const season of seasonsToProcess) {
        const res = await this.ingestLeagueSeason(league, season, {
          skipDatabaseSync: options.skipDatabaseSync,
        });

        processedSeasons.push(season);
        totalIngested += res.matches.length;
        totalHistorical += res.historicalCount;
        totalUpcoming += res.upcomingCount;
        totalDuplicates += res.duplicatesRejected;
        totalQuarantined += res.quarantined;
        totalRequests += res.requestsUsed;
      }

      const hasRealResults = totalHistorical > 0;
      const readiness: MarketReadiness = {
        RESULT_READY: hasRealResults && totalIngested > 0 && totalQuarantined === 0,
        AH_READY: false, // Set to true only upon verified AH odds ingestion
        OU_READY: false, // Set to true only upon verified OU odds ingestion
        BTTS_READY: false, // Set to true only upon verified BTTS odds ingestion
        ML_READY: false, // Set to true only upon verified 1X2 odds ingestion
      };

      const finalState: LeagueIngestionState =
        readiness.RESULT_READY ? 'RESEARCH_READY' : totalIngested > 0 ? 'PARTIAL' : 'FAILED';

      league.ingestion_status = finalState;
      league.last_ingested = new Date().toISOString();
      league.fixture_count = totalIngested;
      league.market_readiness = readiness;

      return {
        league_id: league.league_id,
        league_name: league.name,
        country: league.country,
        seasons_processed: processedSeasons,
        fixtures_ingested: totalIngested,
        historical_matches: totalHistorical,
        upcoming_matches: totalUpcoming,
        duplicates_rejected: totalDuplicates,
        quarantined_count: totalQuarantined,
        requests_consumed: totalRequests,
        state: finalState,
        readiness,
      };
    } catch (err: any) {
      league.ingestion_status = 'FAILED';
      return {
        league_id: league.league_id,
        league_name: league.name,
        country: league.country,
        seasons_processed: processedSeasons,
        fixtures_ingested: totalIngested,
        historical_matches: totalHistorical,
        upcoming_matches: totalUpcoming,
        duplicates_rejected: totalDuplicates,
        quarantined_count: totalQuarantined,
        requests_consumed: totalRequests,
        state: 'FAILED',
        readiness: {
          RESULT_READY: false,
          AH_READY: false,
          OU_READY: false,
          BTTS_READY: false,
          ML_READY: false,
        },
        error: err.message,
      };
    }
  }

  /**
   * Runs the controlled live pilot over 10-20 representative leagues.
   */
  public async runControlledPilot(
    candidateLeagues: GlobalLeague[],
    options: {
      maxLeagues?: number;
      skipDatabaseSync?: boolean;
    } = {}
  ): Promise<{
    summaries: LeagueIngestionSummary[];
    totalLeaguesProcessed: number;
    successfulLeagues: number;
    partialLeagues: number;
    failedLeagues: number;
    fixturesIngested: number;
    historicalMatches: number;
    upcomingMatches: number;
    requestsConsumed: number;
    quarantinedCount: number;
    researchReadyCount: number;
    ahReadyCount: number;
    ouReadyCount: number;
    bttsReadyCount: number;
    mlReadyCount: number;
  }> {
    const maxLeagues = options.maxLeagues ?? 15;
    const selected = candidateLeagues.slice(0, maxLeagues);

    const summaries: LeagueIngestionSummary[] = [];
    let fixturesIngested = 0;
    let historicalMatches = 0;
    let upcomingMatches = 0;
    let successfulLeagues = 0;
    let partialLeagues = 0;
    let failedLeagues = 0;
    let quarantinedCount = 0;
    let researchReadyCount = 0;

    for (const league of selected) {
      console.log(`[Pilot Ingestion] Ingesting league ${league.name} (ID: ${league.league_id}, Country: ${league.country}, Tier: ${league.tier})...`);
      const summary = await this.ingestLeague(league, {
        targetSeasons: [league.season],
        skipDatabaseSync: options.skipDatabaseSync,
      });

      summaries.push(summary);
      fixturesIngested += summary.fixtures_ingested;
      historicalMatches += summary.historical_matches;
      upcomingMatches += summary.upcoming_matches;
      quarantinedCount += summary.quarantined_count;

      if (summary.state === 'RESEARCH_READY') {
        successfulLeagues += 1;
        researchReadyCount += 1;
      } else if (summary.state === 'PARTIAL') {
        partialLeagues += 1;
      } else {
        failedLeagues += 1;
      }
    }

    return {
      summaries,
      totalLeaguesProcessed: selected.length,
      successfulLeagues,
      partialLeagues,
      failedLeagues,
      fixturesIngested,
      historicalMatches,
      upcomingMatches,
      requestsConsumed: this.totalRequestsConsumed,
      quarantinedCount,
      researchReadyCount,
      ahReadyCount: 0,
      ouReadyCount: 0,
      bttsReadyCount: 0,
      mlReadyCount: 0,
    };
  }

  public getQuarantined(): QuarantinedFixture[] {
    return [...this.quarantined];
  }

  public getObservabilityMetrics(allLeagues: GlobalLeague[] = []) {
    const states: Record<LeagueIngestionState, number> = {
      DISCOVERED: 0,
      ELIGIBLE: 0,
      QUEUED: 0,
      INGESTING: 0,
      PARTIAL: 0,
      RESEARCH_READY: 0,
      STALE: 0,
      FAILED: 0,
      UNAVAILABLE: 0,
    };

    let totalFixtures = 0;
    for (const l of allLeagues) {
      const st = l.ingestion_status || 'DISCOVERED';
      states[st] = (states[st] || 0) + 1;
      if (typeof l.fixture_count === 'number') {
        totalFixtures += l.fixture_count;
      }
    }

    return {
      totalLeagues: allLeagues.length,
      states,
      totalFixturesIngested: totalFixtures,
      quarantinedCount: this.quarantined.length,
      requestsConsumed: this.totalRequestsConsumed,
      providerErrors: this.totalProviderErrors,
    };
  }
}
