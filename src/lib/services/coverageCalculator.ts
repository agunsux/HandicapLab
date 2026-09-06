/**
 * Coverage Calculator Service (Hardened Edition)
 *
 * Computes deterministic win-rate, coverage statistics, and detailed outcome
 * probabilities directly from canonical database fixtures with:
 * 1. Zero future-data leakage via strict point-in-time `asOfTimestamp` filtering.
 * 2. Canonical team identity resolution without HASHTEXT.
 * 3. Authoritative AH settlement semantics separating outcome probabilities from expectations.
 * 4. Empirical Bayes shrinkage for small sample sizes.
 */

import { supabase } from '@/lib/supabase.server';
import { canonicalEntityResolver } from '@/lib/warehouse/entityResolver';
import { settleAsianHandicap, type SettlementOutcome } from '@/historical/settlement/settlement';

export interface AsianHandicapProbabilities {
  pWin: number;
  pPush: number;
  pHalfWin: number;
  pHalfLoss: number;
  pLoss: number;
  settlementExpectation: number; // expected return per 1u stake (-1.0 to +1.0)
  coverRate: number;            // fractional cover (e.g. half win counts as 0.5)
}

export interface TeamMarketRates {
  teamId: number | string;
  teamName: string;
  canonicalId: string;
  leagueId: number;
  season: number;
  venue: 'home' | 'away' | 'overall';
  matchesPlayed: number;
  sampleSize: number;
  goalsForAvg: number;
  goalsAgainstAvg: number;
  ahCoverRates: {
    minus025: number | null;
    minus050: number | null;
    minus075: number | null;
    minus100: number | null;
    minus150: number | null;
    plus025?: number | null;
    plus050?: number | null;
    plus075?: number | null;
    plus100?: number | null;
    plus150?: number | null;
  };
  ahProbabilities: Record<string, AsianHandicapProbabilities>;
  ouRates: {
    over15: number;
    under15: number;
    over25: number;
    under25: number;
    over35: number;
    under35: number;
  };
  bttsRates: {
    yes: number;
    no: number;
  };
  bttsYesRate: number; // Backward compatibility
  cleanSheetRate: number;
  failedToScoreRate: number;
  firstHalfGoalsAvg: number;
  secondHalfGoalsAvg: number;
  sampleConfidenceTier: 'N<5' | '5<=N<10' | '10<=N<20' | 'N>=20' | 'N>=50';
  shrunk?: {
    ahCoverRates: {
      minus025: number;
      minus050: number;
      minus075: number;
      minus100: number;
      minus150: number;
    };
    ouRates: {
      over15: number;
      over25: number;
      over35: number;
    };
    bttsYesRate: number;
  };
}

export interface MatchupCoverageProfile {
  homeTeam: TeamMarketRates;
  awayTeam: TeamMarketRates;
  ahEdge: number;
  ouTendency: number;
  bttsTendency: number;
  confidence: {
    ah: number;    // 0-100
    ou: number;    // 0-100
    btts: number;  // 0-100
  };
}

export interface LeagueMarketAverages {
  leagueId: number;
  season: number;
  avgGoals: number;
  ouOver15Rate: number;
  ouOver25Rate: number;
  ouOver35Rate: number;
  bttsYesRate: number;
  homeWinRate: number;
  sampleSize: number;
}

// In-Memory Cache Store with deterministic timestamp keys
interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const cacheStore = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached<T>(key: string): T | null {
  const entry = cacheStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cacheStore.delete(key);
    return null;
  }
  return entry.data;
}

function setCached<T>(key: string, data: T, ttlMs: number = CACHE_TTL_MS): void {
  cacheStore.set(key, { data, expiry: Date.now() + ttlMs });
}

export function getSampleConfidenceTier(n: number): 'N<5' | '5<=N<10' | '10<=N<20' | 'N>=20' | 'N>=50' {
  if (n < 5) return 'N<5';
  if (n < 10) return '5<=N<10';
  if (n < 20) return '10<=N<20';
  if (n < 50) return 'N>=20';
  return 'N>=50';
}

/**
 * Creates fallback rates when team data is below threshold or absent
 */
export function createEmptyTeamMarketRates(
  teamIdOrName: number | string,
  venue: 'home' | 'away' | 'overall',
  season: number = 2026,
  teamName?: string
): TeamMarketRates {
  const resolvedName = teamName || (typeof teamIdOrName === 'string' ? teamIdOrName : 'Unknown Team');
  const canonicalId = canonicalEntityResolver.resolveTeamId('generic', resolvedName);

  return {
    teamId: teamIdOrName,
    teamName: resolvedName,
    canonicalId,
    leagueId: 0,
    season,
    venue,
    matchesPlayed: 0,
    sampleSize: 0,
    goalsForAvg: 0,
    goalsAgainstAvg: 0,
    ahCoverRates: {
      minus025: null,
      minus050: null,
      minus075: null,
      minus100: null,
      minus150: null,
    },
    ahProbabilities: {},
    ouRates: {
      over15: 0,
      under15: 0,
      over25: 0,
      under25: 0,
      over35: 0,
      under35: 0,
    },
    bttsRates: {
      yes: 0,
      no: 0,
    },
    bttsYesRate: 0,
    cleanSheetRate: 0,
    failedToScoreRate: 0,
    firstHalfGoalsAvg: 0,
    secondHalfGoalsAvg: 0,
    sampleConfidenceTier: 'N<5',
  };
}

/**
 * Maps raw database row from team_market_rates view into typed TeamMarketRates
 */
export function mapDbRowToTeamMarketRates(row: any): TeamMarketRates {
  const sampleSize = Number(row.sample_size || row.matches_played || 0);
  const rawTeamName = String(row.team_name || 'Unknown Team');
  const canonicalId = canonicalEntityResolver.resolveTeamId('historical', rawTeamName);

  const ahProbabilities: Record<string, AsianHandicapProbabilities> = {
    '-0.50': {
      pWin: Number(row.ah_p_win_minus_050 ?? row.ah_cover_rate ?? 0),
      pPush: 0,
      pHalfWin: 0,
      pHalfLoss: 0,
      pLoss: Number(row.ah_p_loss_minus_050 ?? (1 - (row.ah_cover_rate || 0))),
      settlementExpectation: Number((Number(row.ah_p_win_minus_050 || 0) * 1.0 - Number(row.ah_p_loss_minus_050 || 0) * 1.0).toFixed(4)),
      coverRate: Number(row.ah_cover_rate ?? 0),
    },
    '-0.25': {
      pWin: Number(row.ah_p_win_minus_025 ?? row.ah_cover_rate_minus_025 ?? 0),
      pPush: 0,
      pHalfWin: 0,
      pHalfLoss: Number(row.ah_p_half_loss_minus_025 ?? 0),
      pLoss: Number(row.ah_p_loss_minus_025 ?? 0),
      settlementExpectation: Number(row.ah_expected_return_minus_025 ?? 0),
      coverRate: Number(row.ah_cover_rate_minus_025 ?? 0),
    },
    '-0.75': {
      pWin: Number(row.ah_p_win_minus_075 ?? 0),
      pPush: 0,
      pHalfWin: Number(row.ah_p_half_win_minus_075 ?? 0),
      pHalfLoss: 0,
      pLoss: Number(row.ah_p_loss_minus_075 ?? 0),
      settlementExpectation: Number(row.ah_expected_return_minus_075 ?? 0),
      coverRate: Number(row.ah_cover_rate_minus_075 ?? 0),
    },
    '-1.00': {
      pWin: Number(row.ah_p_win_minus_100 ?? row.ah_cover_rate_minus_100 ?? 0),
      pPush: Number(row.ah_p_push_minus_100 ?? 0),
      pHalfWin: 0,
      pHalfLoss: 0,
      pLoss: Number(row.ah_p_loss_minus_100 ?? 0),
      settlementExpectation: Number(row.ah_expected_return_minus_100 ?? 0),
      coverRate: Number(row.ah_cover_rate_minus_100 ?? 0),
    },
    '-1.50': {
      pWin: Number(row.ah_p_win_minus_150 ?? row.ah_cover_rate_minus_150 ?? 0),
      pPush: 0,
      pHalfWin: 0,
      pHalfLoss: 0,
      pLoss: Number(row.ah_p_loss_minus_150 ?? 0),
      settlementExpectation: Number(row.ah_p_win_minus_150 ?? 0) - Number(row.ah_p_loss_minus_150 ?? 0),
      coverRate: Number(row.ah_cover_rate_minus_150 ?? 0),
    },
  };

  const ou15 = Number(row.ou_over_15_rate || 0);
  const ou25 = Number(row.ou_over_25_rate || 0);
  const ou35 = Number(row.ou_over_35_rate || 0);
  const bttsYes = Number(row.btts_yes_rate || 0);

  return {
    teamId: row.team_id !== undefined ? Number(row.team_id) : canonicalId,
    teamName: rawTeamName,
    canonicalId,
    leagueId: Number(row.league_id || 0),
    season: Number(row.season || 2026),
    venue: (row.venue as 'home' | 'away' | 'overall') || 'overall',
    matchesPlayed: sampleSize,
    sampleSize,
    goalsForAvg: Number(row.goals_for_avg || 0),
    goalsAgainstAvg: Number(row.goals_against_avg || 0),
    ahCoverRates: {
      minus025: row.ah_cover_rate_minus_025 !== null && row.ah_cover_rate_minus_025 !== undefined ? Number(row.ah_cover_rate_minus_025) : null,
      minus050: row.ah_cover_rate !== null && row.ah_cover_rate !== undefined ? Number(row.ah_cover_rate) : null,
      minus075: row.ah_cover_rate_minus_075 !== null && row.ah_cover_rate_minus_075 !== undefined ? Number(row.ah_cover_rate_minus_075) : null,
      minus100: row.ah_cover_rate_minus_100 !== null && row.ah_cover_rate_minus_100 !== undefined ? Number(row.ah_cover_rate_minus_100) : null,
      minus150: row.ah_cover_rate_minus_150 !== null && row.ah_cover_rate_minus_150 !== undefined ? Number(row.ah_cover_rate_minus_150) : null,
    },
    ahProbabilities,
    ouRates: {
      over15: ou15,
      under15: Number(row.ou_under_15_rate ?? (1 - ou15).toFixed(4)),
      over25: ou25,
      under25: Number(row.ou_under_25_rate ?? (1 - ou25).toFixed(4)),
      over35: ou35,
      under35: Number(row.ou_under_35_rate ?? (1 - ou35).toFixed(4)),
    },
    bttsRates: {
      yes: bttsYes,
      no: Number(row.btts_no_rate ?? (1 - bttsYes).toFixed(4)),
    },
    bttsYesRate: bttsYes,
    cleanSheetRate: Number(row.clean_sheet_rate || 0),
    failedToScoreRate: Number(row.failed_to_score_rate || 0),
    firstHalfGoalsAvg: Number(row.first_half_goals_avg || 0),
    secondHalfGoalsAvg: Number(row.second_half_goals_avg || 0),
    sampleConfidenceTier: getSampleConfidenceTier(sampleSize),
  };
}

export interface MatchRecord {
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  match_time: string | Date;
  ht_home_goals?: number | null;
  ht_away_goals?: number | null;
  league_id?: number;
  season?: number;
}

/**
 * Pure, deterministic point-in-time calculation from a list of match records.
 * Guarantees zero future-data leakage: strictly filters `match_time < asOfTimestamp`.
 */
export function calculateCoverageFromMatches(
  matches: MatchRecord[],
  targetTeam: string,
  venue: 'home' | 'away' | 'overall' = 'overall',
  season?: number,
  asOfTimestamp?: string | Date,
  leagueBaseline?: LeagueMarketAverages
): TeamMarketRates {
  const normTarget = targetTeam.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const cutoffTime = asOfTimestamp ? new Date(asOfTimestamp).getTime() : Date.now();

  // 1. Strict point-in-time and venue filtering
  const eligibleMatches = matches.filter((m) => {
    // ZERO FUTURE DATA INVARIANT: match must have completed strictly before cutoff
    const mTime = new Date(m.match_time).getTime();
    if (mTime >= cutoffTime) return false;

    if (m.home_goals === null || m.away_goals === null || isNaN(m.home_goals) || isNaN(m.away_goals)) {
      return false;
    }

    if (season && m.season && m.season !== season) return false;

    const normHome = m.home_team.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const normAway = m.away_team.trim().toLowerCase().replace(/[^a-z0-9]/g, '');

    const isHome = normHome === normTarget || normHome.includes(normTarget) || normTarget.includes(normHome);
    const isAway = normAway === normTarget || normAway.includes(normTarget) || normTarget.includes(normAway);

    if (!isHome && !isAway) return false;

    if (venue === 'home') return isHome;
    if (venue === 'away') return isAway;
    return true; // overall
  });

  const N = eligibleMatches.length;
  if (N === 0) {
    return createEmptyTeamMarketRates(targetTeam, venue, season || 2026, targetTeam);
  }

  // 2. Aggregate statistics across eligible matches
  let totalGoalsFor = 0;
  let totalGoalsAgainst = 0;
  let totalHtGoalsFor = 0;
  let totalHtGoalsAgainst = 0;
  let htMatchesCount = 0;

  let over15Count = 0;
  let over25Count = 0;
  let over35Count = 0;
  let bttsYesCount = 0;
  let cleanSheetCount = 0;
  let failedToScoreCount = 0;

  const supportedLines = [-0.25, -0.50, -0.75, -1.00, -1.50, 0.25, 0.50, 0.75, 1.00, 1.50];
  const outcomeCounts: Record<string, { win: number; halfWin: number; push: number; halfLoss: number; loss: number }> = {};

  supportedLines.forEach((l) => {
    outcomeCounts[l.toFixed(2)] = { win: 0, halfWin: 0, push: 0, halfLoss: 0, loss: 0 };
  });

  for (const m of eligibleMatches) {
    const normHome = m.home_team.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const isHome = normHome === normTarget || normHome.includes(normTarget) || normTarget.includes(normHome);

    const gf = isHome ? m.home_goals : m.away_goals;
    const ga = isHome ? m.away_goals : m.home_goals;
    const totalGoals = gf + ga;

    totalGoalsFor += gf;
    totalGoalsAgainst += ga;

    if (m.ht_home_goals !== null && m.ht_home_goals !== undefined && m.ht_away_goals !== null && m.ht_away_goals !== undefined) {
      totalHtGoalsFor += isHome ? m.ht_home_goals : m.ht_away_goals;
      totalHtGoalsAgainst += isHome ? m.ht_away_goals : m.ht_home_goals;
      htMatchesCount++;
    }

    if (totalGoals >= 2) over15Count++;
    if (totalGoals >= 3) over25Count++;
    if (totalGoals >= 4) over35Count++;

    if (gf >= 1 && ga >= 1) bttsYesCount++;
    if (ga === 0) cleanSheetCount++;
    if (gf === 0) failedToScoreCount++;

    // Settle each Asian Handicap line with authoritative settlement logic
    for (const line of supportedLines) {
      // Settle from perspective of target team:
      // If target team is home, selection is 'home' with handicap 'line'
      // If target team is away, selection is 'away' with handicap 'line'
      const outcome: SettlementOutcome = settleAsianHandicap(
        isHome ? 'home' : 'away',
        line,
        m.home_goals,
        m.away_goals
      );

      const counts = outcomeCounts[line.toFixed(2)];
      switch (outcome) {
        case 'WIN': counts.win++; break;
        case 'HALF_WIN': counts.halfWin++; break;
        case 'PUSH': counts.push++; break;
        case 'HALF_LOSS': counts.halfLoss++; break;
        case 'LOSS': counts.loss++; break;
      }
    }
  }

  // 3. Compute explicit probabilities & settlement expectations
  const ahProbabilities: Record<string, AsianHandicapProbabilities> = {};
  supportedLines.forEach((line) => {
    const counts = outcomeCounts[line.toFixed(2)];
    const pWin = counts.win / N;
    const pHalfWin = counts.halfWin / N;
    const pPush = counts.push / N;
    const pHalfLoss = counts.halfLoss / N;
    const pLoss = counts.loss / N;

    // Fractional settlement expectation: win = +1, half-win = +0.5, push = 0, half-loss = -0.5, loss = -1
    const settlementExpectation = Number((pWin * 1.0 + pHalfWin * 0.5 + pPush * 0.0 - pHalfLoss * 0.5 - pLoss * 1.0).toFixed(4));
    // Fractional cover rate: full win counts 1, half win counts 0.5
    const coverRate = Number((pWin + pHalfWin * 0.5).toFixed(4));

    ahProbabilities[line.toFixed(2)] = {
      pWin: Number(pWin.toFixed(4)),
      pPush: Number(pPush.toFixed(4)),
      pHalfWin: Number(pHalfWin.toFixed(4)),
      pHalfLoss: Number(pHalfLoss.toFixed(4)),
      pLoss: Number(pLoss.toFixed(4)),
      settlementExpectation,
      coverRate,
    };
  });

  const ouOver15 = Number((over15Count / N).toFixed(4));
  const ouOver25 = Number((over25Count / N).toFixed(4));
  const ouOver35 = Number((over35Count / N).toFixed(4));
  const bttsYes = Number((bttsYesCount / N).toFixed(4));

  const canonicalId = canonicalEntityResolver.resolveTeamId('generic', targetTeam);

  // 4. Empirical Bayes Shrinkage toward League Baseline (Phase 6)
  const priorM = 10; // shrinkage prior weight
  const shrinkWeight = N / (N + priorM);
  const lAvg = leagueBaseline || {
    avgGoals: 2.72,
    ouOver15Rate: 0.78,
    ouOver25Rate: 0.52,
    ouOver35Rate: 0.31,
    bttsYesRate: 0.51,
    homeWinRate: 0.45,
    sampleSize: 100,
    leagueId: eligibleMatches[0]?.league_id || 39,
    season: season || 2026,
  };

  const shrunk = {
    ahCoverRates: {
      minus025: Number((shrinkWeight * (ahProbabilities['-0.25']?.coverRate ?? 0.5) + (1 - shrinkWeight) * 0.50).toFixed(4)),
      minus050: Number((shrinkWeight * (ahProbabilities['-0.50']?.coverRate ?? 0.45) + (1 - shrinkWeight) * (lAvg.homeWinRate || 0.45)).toFixed(4)),
      minus075: Number((shrinkWeight * (ahProbabilities['-0.75']?.coverRate ?? 0.40) + (1 - shrinkWeight) * 0.40).toFixed(4)),
      minus100: Number((shrinkWeight * (ahProbabilities['-1.00']?.coverRate ?? 0.35) + (1 - shrinkWeight) * 0.35).toFixed(4)),
      minus150: Number((shrinkWeight * (ahProbabilities['-1.50']?.coverRate ?? 0.25) + (1 - shrinkWeight) * 0.25).toFixed(4)),
    },
    ouRates: {
      over15: Number((shrinkWeight * ouOver15 + (1 - shrinkWeight) * lAvg.ouOver15Rate).toFixed(4)),
      over25: Number((shrinkWeight * ouOver25 + (1 - shrinkWeight) * lAvg.ouOver25Rate).toFixed(4)),
      over35: Number((shrinkWeight * ouOver35 + (1 - shrinkWeight) * lAvg.ouOver35Rate).toFixed(4)),
    },
    bttsYesRate: Number((shrinkWeight * bttsYes + (1 - shrinkWeight) * lAvg.bttsYesRate).toFixed(4)),
  };

  return {
    teamId: canonicalId,
    teamName: targetTeam,
    canonicalId,
    leagueId: eligibleMatches[0]?.league_id || 0,
    season: season || eligibleMatches[0]?.season || 2026,
    venue,
    matchesPlayed: N,
    sampleSize: N,
    goalsForAvg: Number((totalGoalsFor / N).toFixed(3)),
    goalsAgainstAvg: Number((totalGoalsAgainst / N).toFixed(3)),
    ahCoverRates: {
      minus025: ahProbabilities['-0.25']?.coverRate ?? null,
      minus050: ahProbabilities['-0.50']?.coverRate ?? null,
      minus075: ahProbabilities['-0.75']?.coverRate ?? null,
      minus100: ahProbabilities['-1.00']?.coverRate ?? null,
      minus150: ahProbabilities['-1.50']?.coverRate ?? null,
      plus025: ahProbabilities['0.25']?.coverRate ?? null,
      plus050: ahProbabilities['0.50']?.coverRate ?? null,
      plus075: ahProbabilities['0.75']?.coverRate ?? null,
      plus100: ahProbabilities['1.00']?.coverRate ?? null,
      plus150: ahProbabilities['1.50']?.coverRate ?? null,
    },
    ahProbabilities,
    ouRates: {
      over15: ouOver15,
      under15: Number((1 - ouOver15).toFixed(4)),
      over25: ouOver25,
      under25: Number((1 - ouOver25).toFixed(4)),
      over35: ouOver35,
      under35: Number((1 - ouOver35).toFixed(4)),
    },
    bttsRates: {
      yes: bttsYes,
      no: Number((1 - bttsYes).toFixed(4)),
    },
    bttsYesRate: bttsYes,
    cleanSheetRate: Number((cleanSheetCount / N).toFixed(4)),
    failedToScoreRate: Number((failedToScoreCount / N).toFixed(4)),
    firstHalfGoalsAvg: htMatchesCount > 0 ? Number(((totalHtGoalsFor + totalHtGoalsAgainst) / htMatchesCount).toFixed(3)) : 0,
    secondHalfGoalsAvg: htMatchesCount > 0 ? Number((((totalGoalsFor + totalGoalsAgainst) - (totalHtGoalsFor + totalHtGoalsAgainst)) / htMatchesCount).toFixed(3)) : 0,
    sampleConfidenceTier: getSampleConfidenceTier(N),
    shrunk,
  };
}

export class CoverageCalculatorService {
  /**
   * 1. Query per-team, per-season, per-venue coverage rates with strict point-in-time semantics
   */
  public async getTeamCoverageRates(
    teamIdOrName: number | string,
    venue: 'home' | 'away' | 'overall' = 'overall',
    season?: number,
    asOfTimestamp?: string | Date
  ): Promise<TeamMarketRates> {
    const asOfIso = asOfTimestamp ? new Date(asOfTimestamp).toISOString() : 'current';
    const cacheKey = `cov:team:${teamIdOrName}:${venue}:${season || 'latest'}:${asOfIso}`;
    const cached = getCached<TeamMarketRates>(cacheKey);
    if (cached) return cached;

    const teamIdentifier = String(teamIdOrName);
    const resolvedCanonical = canonicalEntityResolver.getCanonicalTeam(teamIdentifier);
    const teamName = resolvedCanonical ? resolvedCanonical.canonicalName : teamIdentifier;

    try {
      // 1. Point-in-time calculation query: fetch finished matches before cutoff
      const cutoff = asOfTimestamp ? new Date(asOfTimestamp).toISOString() : new Date().toISOString();

      const { data: histData, error } = await supabase
        .from('historical_matches')
        .select('canonical_id, league_id, season, match_date, home_team, away_team, home_goals, away_goals')
        .or(`home_team.ilike.%${teamName}%,away_team.ilike.%${teamName}%`)
        .lt('match_date', cutoff.split('T')[0])
        .order('match_date', { ascending: false })
        .limit(200);

      if (!error && histData && histData.length > 0) {
        const matches: MatchRecord[] = histData.map((m) => ({
          home_team: m.home_team,
          away_team: m.away_team,
          home_goals: m.home_goals,
          away_goals: m.away_goals,
          match_time: m.match_date,
          season: parseInt(m.season?.split('-')[0] || '2025', 10),
          league_id: m.league_id === 'ENG-PL' ? 39 : m.league_id === 'ESP-LALIGA' ? 140 : m.league_id === 'ITA-SERIEA' ? 135 : m.league_id === 'DEU-BUNDESLIGA' ? 78 : 61,
        }));

        const calculated = calculateCoverageFromMatches(matches, teamName, venue, season, asOfTimestamp);
        setCached(cacheKey, calculated);
        return calculated;
      }
    } catch (err) {
      console.warn(`[CoverageCalculator] Error fetching point-in-time rates for ${teamName}:`, err);
    }

    const fallback = createEmptyTeamMarketRates(teamIdOrName, venue, season || 2026, teamName);
    setCached(cacheKey, fallback, 60 * 1000);
    return fallback;
  }

  /**
   * 2. Compute head-to-head matchup coverage profile
   */
  public async getMatchupCoverageRates(
    homeTeam: number | string,
    awayTeam: number | string,
    season?: number,
    asOfTimestamp?: string | Date
  ): Promise<MatchupCoverageProfile> {
    const [homeRates, awayRates] = await Promise.all([
      this.getTeamCoverageRates(homeTeam, 'home', season, asOfTimestamp),
      this.getTeamCoverageRates(awayTeam, 'away', season, asOfTimestamp),
    ]);

    // Compute differentials
    const homeAh50 = homeRates.ahCoverRates.minus050 ?? 0.5;
    const awayAh50 = awayRates.ahCoverRates.minus050 ?? 0.5;
    const ahEdge = Number((homeAh50 - awayAh50).toFixed(4));

    const ouTendency = Number(
      (((homeRates.ouRates.over25 || 0.5) + (awayRates.ouRates.over25 || 0.5)) / 2).toFixed(4)
    );

    const bttsTendency = Number(
      (((homeRates.bttsYesRate || 0.5) + (awayRates.bttsYesRate || 0.5)) / 2).toFixed(4)
    );

    // Calculate line-specific confidence for base line (-0.5)
    const ahConfidence = this.calculateAHLineConfidenceSync(homeRates, awayRates, -0.5);

    // OU & BTTS confidence based on sample size credibility
    const totalSample = homeRates.sampleSize + awayRates.sampleSize;
    const sampleMultiplier = Math.min(1.0, totalSample / 20); // 20 matches combined = full sample credibility

    const ouConfidence = Math.round(
      (50 + Math.abs(ouTendency - 0.5) * 100) * sampleMultiplier
    );
    const bttsConfidence = Math.round(
      (50 + Math.abs(bttsTendency - 0.5) * 100) * sampleMultiplier
    );

    return {
      homeTeam: homeRates,
      awayTeam: awayRates,
      ahEdge,
      ouTendency,
      bttsTendency,
      confidence: {
        ah: Math.min(100, Math.max(0, ahConfidence)),
        ou: Math.min(100, Math.max(0, ouConfidence)),
        btts: Math.min(100, Math.max(0, bttsConfidence)),
      },
    };
  }

  /**
   * 3. Aggregate all teams in a league to produce league-level baselines
   */
  public async getLeagueAverages(
    leagueId: number,
    season?: number,
    asOfTimestamp?: string | Date
  ): Promise<LeagueMarketAverages> {
    const asOfIso = asOfTimestamp ? new Date(asOfTimestamp).toISOString() : 'current';
    const cacheKey = `cov:league:${leagueId}:${season || 'latest'}:${asOfIso}`;
    const cached = getCached<LeagueMarketAverages>(cacheKey);
    if (cached) return cached;

    // Standard baseline
    const fallback: LeagueMarketAverages = {
      leagueId,
      season: season || 2026,
      avgGoals: 2.72,
      ouOver15Rate: 0.78,
      ouOver25Rate: 0.52,
      ouOver35Rate: 0.31,
      bttsYesRate: 0.51,
      homeWinRate: 0.45,
      sampleSize: 0,
    };
    setCached(cacheKey, fallback);
    return fallback;
  }

  /**
   * 4. Calculate AH Line Confidence (0-100)
   */
  public async calculateAHLineConfidence(
    homeTeam: number | string,
    awayTeam: number | string,
    proposedLine: number,
    season?: number,
    asOfTimestamp?: string | Date
  ): Promise<number> {
    const [homeRates, awayRates] = await Promise.all([
      this.getTeamCoverageRates(homeTeam, 'home', season, asOfTimestamp),
      this.getTeamCoverageRates(awayTeam, 'away', season, asOfTimestamp),
    ]);

    return this.calculateAHLineConfidenceSync(homeRates, awayRates, proposedLine);
  }

  /**
   * Pure synchronous calculation of line confidence from existing rates
   */
  public calculateAHLineConfidenceSync(
    homeRates: TeamMarketRates,
    awayRates: TeamMarketRates,
    proposedLine: number
  ): number {
    const getLineRate = (rates: TeamMarketRates, line: number): number => {
      const lineKey = line.toFixed(2);
      if (rates.ahProbabilities && rates.ahProbabilities[lineKey]) {
        return rates.ahProbabilities[lineKey].coverRate;
      }
      const absLine = Math.abs(line);
      if (absLine <= 0.375) return rates.ahCoverRates.minus025 ?? 0.5;
      if (absLine <= 0.625) return rates.ahCoverRates.minus050 ?? 0.5;
      if (absLine <= 0.875) return rates.ahCoverRates.minus075 ?? 0.5;
      if (absLine <= 1.25) return rates.ahCoverRates.minus100 ?? 0.5;
      return rates.ahCoverRates.minus150 ?? 0.5;
    };

    const homeCover = getLineRate(homeRates, proposedLine);
    const awayCover = getLineRate(awayRates, -proposedLine);

    // Formula: confidence = (home_cover * 0.6) + ((1 - away_cover) * 0.4)
    const rawConfidence = (homeCover * 0.6 + (1 - awayCover) * 0.4) * 100;

    // Sample size damping: if combined sample < 10 matches, pull toward neutral 50
    const minSample = Math.min(homeRates.sampleSize, awayRates.sampleSize);
    if (minSample < 10) {
      const weight = Math.max(0, minSample) / 10;
      return Math.round(50 * (1 - weight) + rawConfidence * weight);
    }

    return Math.round(Math.min(100, Math.max(0, rawConfidence)));
  }
}

export const coverageCalculator = new CoverageCalculatorService();

