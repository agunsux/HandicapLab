// Deterministic normalization: result, derived markets, canonical identity,
// integrity validation. Every derived value comes from the scoreline — never
// from odds — and ordering/output is fully deterministic.
// Location: src/historical/europe/normalize.ts

import type { CanonicalMatch, LeagueEntry, OddsMarkets, ResultCode } from './types';
import type { RawFootballDataRow } from './footballDataReader';
import { normalizeSeasonKey } from './footballDataReader';

export const NORMALIZATION_VERSION = 'europe-v1';
export const SCHEMA_VERSION = 'europe-match-v1';

export function teamSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function deriveResult(homeGoals: number, awayGoals: number): ResultCode {
  if (homeGoals > awayGoals) return 'H';
  if (homeGoals < awayGoals) return 'A';
  return 'D';
}

export interface DerivedMarkets {
  totalGoals: number;
  homeWin: boolean;
  draw: boolean;
  awayWin: boolean;
  btts: boolean;
  over15: boolean;
  over25: boolean;
  over35: boolean;
  under15: boolean;
  under25: boolean;
  under35: boolean;
}

export function deriveMarkets(homeGoals: number, awayGoals: number): DerivedMarkets {
  const total = homeGoals + awayGoals;
  return {
    totalGoals: total,
    homeWin: homeGoals > awayGoals,
    draw: homeGoals === awayGoals,
    awayWin: homeGoals < awayGoals,
    btts: homeGoals >= 1 && awayGoals >= 1,
    over15: total > 1.5,
    over25: total > 2.5,
    over35: total > 3.5,
    under15: total < 1.5,
    under25: total < 2.5,
    under35: total < 3.5,
  };
}

export function canonicalIdOf(leagueId: string, season: string, dateIso: string, homeTeam: string, awayTeam: string): string {
  return `${leagueId}|${season}|${dateIso}|${teamSlug(homeTeam)}|${teamSlug(awayTeam)}`;
}

export interface NormalizeResult {
  match: CanonicalMatch | null;
  rejectReason: string | null;
}

function toOdds(row: RawFootballDataRow): OddsMarkets | null {
  const hasAny =
    row.h1 !== null || row.d1 !== null || row.a1 !== null ||
    row.ch1 !== null || row.cd1 !== null || row.ca1 !== null ||
    row.ahLine !== null || row.ahHome !== null || row.ahAway !== null ||
    row.over !== null || row.under !== null || row.cover !== null || row.cunder !== null;
  // Helpers: undefined = absent (not serialized as null), but keep raw presence.
  return hasAny
    ? {
        bookmakerSource: row.bookmakerSource,
        h1: row.h1 ?? undefined, d1: row.d1 ?? undefined, a1: row.a1 ?? undefined,
        ch1: row.ch1 ?? undefined, cd1: row.cd1 ?? undefined, ca1: row.ca1 ?? undefined,
        ahLine: row.ahLine ?? undefined, ahHome: row.ahHome ?? undefined, ahAway: row.ahAway ?? undefined,
        chLine: row.chLine ?? undefined, chHome: row.chHome ?? undefined, chAway: row.chAway ?? undefined,
        ouLine: row.ouLine ?? undefined, over: row.over ?? undefined, under: row.under ?? undefined,
        couLine: row.couLine !== null ? row.couLine : undefined,
        cover: row.cover ?? undefined, cunder: row.cunder ?? undefined,
      }
    : null;
}

/**
 * Normalize a single raw row belonging to `league`. Returns a canonical match
 * or a deterministic reject reason. Data that cannot be verified is rejected —
 * it is never filled in.
 */
export function normalizeRecord(row: RawFootballDataRow, league: LeagueEntry): NormalizeResult {
  if (!league || league.status !== 'INCLUDED') {
    return { match: null, rejectReason: 'league_not_included' };
  }
  const season = normalizeSeasonKey(row.season);
  if (!season) return { match: null, rejectReason: 'invalid_season' };
  if (!row.dateIso) return { match: null, rejectReason: 'invalid_date' };
  if (!row.homeTeam || !row.awayTeam) return { match: null, rejectReason: 'missing_team' };
  if (teamSlug(row.homeTeam) === teamSlug(row.awayTeam)) return { match: null, rejectReason: 'home_equals_away' };
  if (row.homeGoals === null || row.awayGoals === null) return { match: null, rejectReason: 'missing_goals' };
  if (row.homeGoals < 0 || row.awayGoals < 0) return { match: null, rejectReason: 'negative_goals' };

  const derived = deriveResult(row.homeGoals, row.awayGoals);
  if (row.ftr && row.ftr !== derived) {
    return { match: null, rejectReason: 'result_mismatch' };
  }

  const markets = deriveMarkets(row.homeGoals, row.awayGoals);
  const match: CanonicalMatch = {
    canonicalId: canonicalIdOf(league.leagueId, season, row.dateIso, row.homeTeam, row.awayTeam),
    leagueId: league.leagueId,
    cluster: league.cluster,
    season,
    matchDate: row.dateIso,
    homeTeam: row.homeTeam,
    awayTeam: row.awayTeam,
    homeGoals: row.homeGoals,
    awayGoals: row.awayGoals,
    result: derived,
    resultVerified: row.ftr === derived,
    totalGoals: markets.totalGoals,
    homeWin: markets.homeWin,
    draw: markets.draw,
    awayWin: markets.awayWin,
    btts: markets.btts,
    over15: markets.over15,
    over25: markets.over25,
    over35: markets.over35,
    under15: markets.under15,
    under25: markets.under25,
    under35: markets.under35,
    odds: toOdds(row),
    sourceProvider: 'football-data.co.uk',
    sourceFile: row.sourceFile,
    sourceRow: row.sourceRow,
    normalizationVersion: NORMALIZATION_VERSION,
    schemaVersion: SCHEMA_VERSION,
  };
  return { match, rejectReason: null };
}
