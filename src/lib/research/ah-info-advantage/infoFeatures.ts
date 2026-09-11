// AH INFORMATION ADVANTAGE RESEARCH — Point-in-Time Features & Snapshot Assembly.
// Strict Temporal Ordering: features computed from matches with strictly earlier calendar date.
// Date-group processing prevents same-day contamination. Zero future leakage.

import {
  DEFAULT_AH_DATA_PATHS,
  loadCanonicalMatches,
  loadMarketOdds,
  type AhDataPaths,
} from '../ah-yield/ahLoader';
import { isValidHandicapLine } from '../ah-yield/ahSettlement';
import { createProvenanceResolver } from '../ah-yield/ahProvenance';
import type { MarketOddsRecord } from '../ah-yield/ahTypes';
import { devigOneXTwo, devigTwoWay } from '../ah-edge/edgeProbability';
import type {
  Devigged1X2,
  InfoMarketQuote,
  InfoMatch,
  InfoPointInTimeFeatures,
  MovementPattern,
} from './infoTypes';

const ELO_START = 1500;
const ELO_K = 20;
const ELO_HOME_ADVANTAGE = 60;
const REST_CAP_DAYS = 30;

interface MatchHistoryEntry {
  date: string;
  isHome: boolean;
  points: number;
  gf: number;
  ga: number;
  oppElo: number;
}

interface TeamSeasonAccumulator {
  season: string;
  matches: number;
  points: number;
  gf: number;
  ga: number;
}

interface ExpandingLeagueAccumulator {
  matches: number;
  homeGoals: number;
  awayGoals: number;
}

function emptyFeatures(): InfoPointInTimeFeatures {
  return {
    formPpg3Home: 0,
    formPpg3Away: 0,
    formGf3Home: 0,
    formGf3Away: 0,
    formGa3Home: 0,
    formGa3Away: 0,
    formGd3Home: 0,
    formGd3Away: 0,

    formPpg5Home: 0,
    formPpg5Away: 0,
    formGf5Home: 0,
    formGf5Away: 0,
    formGa5Home: 0,
    formGa5Away: 0,
    formGd5Home: 0,
    formGd5Away: 0,

    formPpg10Home: 0,
    formPpg10Away: 0,
    formGf10Home: 0,
    formGf10Away: 0,
    formGa10Home: 0,
    formGa10Away: 0,
    formGd10Home: 0,
    formGd10Away: 0,

    homeFormPpg: 0,
    homeFormGf: 0,
    homeFormGa: 0,
    awayFormPpg: 0,
    awayFormGf: 0,
    awayFormGa: 0,

    ppmHome: 0,
    ppmAway: 0,

    eloHome: ELO_START,
    eloAway: ELO_START,
    eloDiff: ELO_HOME_ADVANTAGE,
    rollingStrengthHome: 0,
    rollingStrengthAway: 0,
    oppAdjustedStrengthHome: 0,
    oppAdjustedStrengthAway: 0,

    restDaysHome: REST_CAP_DAYS,
    restDaysAway: REST_CAP_DAYS,
    restDiff: 0,
    homeAdvantageGoals: 0.35,
    seasonProgressionHome: 0,
    seasonProgressionAway: 0,
    scheduleDensity14dHome: 0,
    scheduleDensity14dAway: 0,

    leagueGoalsPerMatch: 2.65,
    teamSeasonGfHome: 0,
    teamSeasonGaHome: 0,
    teamSeasonGfAway: 0,
    teamSeasonGaAway: 0,
  };
}

function daysBetween(earlier: string, later: string): number {
  const a = Date.parse(`${earlier}T00:00:00Z`);
  const b = Date.parse(`${later}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return REST_CAP_DAYS;
  return Math.max(0, Math.min(REST_CAP_DAYS, Math.round((b - a) / 86400000)));
}

function classifyMovementPattern(
  earlyAh: InfoMarketQuote | null,
  closingAh: InfoMarketQuote | null
): MovementPattern {
  if (!earlyAh || !closingAh) return 'NO_MOVEMENT';

  const lineDiff = closingAh.line - earlyAh.line;
  const priceDiffHome = closingAh.homeOdds - earlyAh.homeOdds;
  const isFavoriteHome = earlyAh.line < 0 || (earlyAh.line === 0 && earlyAh.homeOdds < earlyAh.awayOdds);

  // Significant line shift (> 0.125)
  if (Math.abs(lineDiff) > 0.125) {
    if (Math.abs(priceDiffHome) < 0.03) {
      return 'PRICE_UNCHANGED_LINE_CHANGES';
    }
    if (isFavoriteHome) {
      return lineDiff < 0 ? 'LINE_MOVES_TOWARD_FAVORITE' : 'LINE_MOVES_TOWARD_UNDERDOG';
    } else {
      return lineDiff > 0 ? 'LINE_MOVES_TOWARD_FAVORITE' : 'LINE_MOVES_TOWARD_UNDERDOG';
    }
  }

  // Line unchanged (Math.abs(lineDiff) <= 0.125)
  if (Math.abs(priceDiffHome) >= 0.05) {
    // Check compression vs expansion
    if (isFavoriteHome) {
      return priceDiffHome < 0 ? 'PRICE_COMPRESSION' : 'PRICE_EXPANSION';
    } else {
      return priceDiffHome > 0 ? 'PRICE_EXPANSION' : 'PRICE_COMPRESSION';
    }
  }

  if (Math.abs(priceDiffHome) > 0.015) {
    return 'LINE_UNCHANGED_PRICE_CHANGES';
  }

  return 'NO_MOVEMENT';
}

function validQuote(row: MarketOddsRecord | undefined): row is MarketOddsRecord {
  return (
    !!row &&
    typeof row.line === 'number' &&
    isValidHandicapLine(row.line) &&
    typeof row.homeOdds === 'number' &&
    row.homeOdds > 1 &&
    typeof row.awayOdds === 'number' &&
    row.awayOdds > 1
  );
}

function parseMl(row: MarketOddsRecord | undefined): Devigged1X2 | null {
  if (!row) return null;
  const { homeOdds, drawOdds, awayOdds } = row;
  if (
    typeof homeOdds !== 'number' || homeOdds <= 1 ||
    typeof drawOdds !== 'number' || drawOdds <= 1 ||
    typeof awayOdds !== 'number' || awayOdds <= 1
  ) {
    return null;
  }
  try {
    return devigOneXTwo(homeOdds, drawOdds, awayOdds);
  } catch {
    return null;
  }
}

export function buildInfoDataset(paths: AhDataPaths = DEFAULT_AH_DATA_PATHS): InfoMatch[] {
  const canonical = loadCanonicalMatches(paths.canonicalMatches).filter((m) => m.resultVerified);
  const oddsRows = loadMarketOdds(paths.marketOdds);
  const resolver = createProvenanceResolver();

  const index = new Map<string, MarketOddsRecord>();
  for (const row of oddsRows) {
    index.set(`${row.canonicalId}|${row.market}|${row.observation}|${row.bookmakerSource}`, row);
  }

  const get = (canonicalId: string, market: string, observation: string, bookmaker: string) =>
    index.get(`${canonicalId}|${market}|${observation}|${bookmaker}`);

  const rawMatches: InfoMatch[] = [];

  for (const m of canonical) {
    // Early quotes: Pinnacle opening if available, else BetBrain opening
    let earlyAhRow = get(m.canonicalId, 'AH', 'opening', 'pinnacle');
    let earlyBookmaker = 'pinnacle';
    if (!validQuote(earlyAhRow) || resolver.resolve(earlyAhRow.sourceFile, 'opening', 'pinnacle') !== 'pinnacle') {
      earlyAhRow = get(m.canonicalId, 'AH', 'opening', 'betbrain');
      earlyBookmaker = 'betbrain';
    }

    // Closing quotes: Pinnacle closing
    const closingAhRow = get(m.canonicalId, 'AH', 'closing', 'pinnacle');

    const earlyAh: InfoMarketQuote | null = validQuote(earlyAhRow)
      ? { line: earlyAhRow.line!, homeOdds: earlyAhRow.homeOdds!, awayOdds: earlyAhRow.awayOdds! }
      : null;

    const closingAh: InfoMarketQuote | null = validQuote(closingAhRow) &&
      resolver.resolve(closingAhRow.sourceFile, 'closing', 'pinnacle') === 'pinnacle'
      ? { line: closingAhRow.line!, homeOdds: closingAhRow.homeOdds!, awayOdds: closingAhRow.awayOdds! }
      : null;

    // At least one valid quote needed
    if (!earlyAh && !closingAh) continue;

    // ML Early & Closing
    const earlyMlRow = get(m.canonicalId, 'ML', 'opening', earlyBookmaker);
    const closingMlRow = get(m.canonicalId, 'ML', 'closing', 'pinnacle');
    const earlyMl = parseMl(earlyMlRow);
    const closingMl = parseMl(closingMlRow);

    // OU Early & Closing
    const earlyOuRow = get(m.canonicalId, 'OU', 'opening', earlyBookmaker);
    const closingOuRow = get(m.canonicalId, 'OU', 'closing', 'pinnacle');
    let earlyOuOver25: number | null = null;
    if (earlyOuRow && typeof earlyOuRow.overOdds === 'number' && earlyOuRow.overOdds > 1 && typeof earlyOuRow.underOdds === 'number' && earlyOuRow.underOdds > 1) {
      earlyOuOver25 = devigTwoWay(earlyOuRow.overOdds, earlyOuRow.underOdds).pA;
    }
    let closingOuOver25: number | null = null;
    if (closingOuRow && typeof closingOuRow.overOdds === 'number' && closingOuRow.overOdds > 1 && typeof closingOuRow.underOdds === 'number' && closingOuRow.underOdds > 1) {
      closingOuOver25 = devigTwoWay(closingOuRow.overOdds, closingOuRow.underOdds).pA;
    }

    const movementPattern = classifyMovementPattern(earlyAh, closingAh);
    const lineMovementHome = earlyAh && closingAh ? closingAh.line - earlyAh.line : 0;
    const priceMovementHome = earlyAh && closingAh ? closingAh.homeOdds - earlyAh.homeOdds : 0;
    const earlyProb = earlyAh ? devigTwoWay(earlyAh.homeOdds, earlyAh.awayOdds).pA : 0.5;
    const closingProb = closingAh ? devigTwoWay(closingAh.homeOdds, closingAh.awayOdds).pA : 0.5;
    const probMovementHome = earlyAh && closingAh ? closingProb - earlyProb : 0;

    rawMatches.push({
      canonicalId: m.canonicalId,
      leagueId: m.leagueId,
      season: m.season,
      matchDate: m.matchDate,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
      earlyAh,
      earlyMl,
      earlyOuOver25,
      closingAh,
      closingMl,
      closingOuOver25,
      movementPattern,
      lineMovementHome,
      priceMovementHome,
      probMovementHome,
      features: emptyFeatures(),
    });
  }

  // Strict chronological sort
  rawMatches.sort((a, b) => a.matchDate.localeCompare(b.matchDate) || a.canonicalId.localeCompare(b.canonicalId));

  // State accumulators
  const elo = new Map<string, number>();
  const history = new Map<string, MatchHistoryEntry[]>();
  const seasons = new Map<string, TeamSeasonAccumulator>();
  const rest = new Map<string, string[]>(); // list of previous dates
  const leagueStats = new Map<string, ExpandingLeagueAccumulator>();
  const globalStats: ExpandingLeagueAccumulator = { matches: 0, homeGoals: 0, awayGoals: 0 };

  const teamKey = (leagueId: string, team: string) => `${leagueId}|${team}`;

  // Process date groups: evaluate features before updating state with same-day results
  let i = 0;
  while (i < rawMatches.length) {
    let j = i;
    while (j < rawMatches.length && rawMatches[j].matchDate === rawMatches[i].matchDate) {
      j += 1;
    }

    // Pass 1: Compute point-in-time features for all matches in date group
    for (let k = i; k < j; k++) {
      const m = rawMatches[k];
      const f = emptyFeatures();
      const hk = teamKey(m.leagueId, m.homeTeam);
      const ak = teamKey(m.leagueId, m.awayTeam);

      // ELO (pre-match)
      const eh = elo.get(hk) ?? ELO_START;
      const ea = elo.get(ak) ?? ELO_START;
      f.eloHome = eh;
      f.eloAway = ea;
      f.eloDiff = eh + ELO_HOME_ADVANTAGE - ea;

      // FORM (strictly prior matches)
      const hh = history.get(hk) ?? [];
      const ah = history.get(ak) ?? [];

      const calcForm = (entries: MatchHistoryEntry[], window: number) => {
        const slice = entries.slice(-window);
        if (slice.length === 0) return { ppg: 0, gf: 0, ga: 0, gd: 0 };
        const pts = slice.reduce((s, e) => s + e.points, 0) / slice.length;
        const gf = slice.reduce((s, e) => s + e.gf, 0) / slice.length;
        const ga = slice.reduce((s, e) => s + e.ga, 0) / slice.length;
        return { ppg: pts, gf, ga, gd: gf - ga };
      };

      const h3 = calcForm(hh, 3);
      const a3 = calcForm(ah, 3);
      f.formPpg3Home = h3.ppg; f.formPpg3Away = a3.ppg;
      f.formGf3Home = h3.gf; f.formGf3Away = a3.gf;
      f.formGa3Home = h3.ga; f.formGa3Away = a3.ga;
      f.formGd3Home = h3.gd; f.formGd3Away = a3.gd;

      const h5 = calcForm(hh, 5);
      const a5 = calcForm(ah, 5);
      f.formPpg5Home = h5.ppg; f.formPpg5Away = a5.ppg;
      f.formGf5Home = h5.gf; f.formGf5Away = a5.gf;
      f.formGa5Home = h5.ga; f.formGa5Away = a5.ga;
      f.formGd5Home = h5.gd; f.formGd5Away = a5.gd;

      const h10 = calcForm(hh, 10);
      const a10 = calcForm(ah, 10);
      f.formPpg10Home = h10.ppg; f.formPpg10Away = a10.ppg;
      f.formGf10Home = h10.gf; f.formGf10Away = a10.gf;
      f.formGa10Home = h10.ga; f.formGa10Away = a10.ga;
      f.formGd10Home = h10.gd; f.formGd10Away = a10.gd;

      // Venue specific form
      const hHomeOnly = hh.filter((e) => e.isHome).slice(-5);
      if (hHomeOnly.length > 0) {
        f.homeFormPpg = hHomeOnly.reduce((s, e) => s + e.points, 0) / hHomeOnly.length;
        f.homeFormGf = hHomeOnly.reduce((s, e) => s + e.gf, 0) / hHomeOnly.length;
        f.homeFormGa = hHomeOnly.reduce((s, e) => s + e.ga, 0) / hHomeOnly.length;
      }
      const aAwayOnly = ah.filter((e) => !e.isHome).slice(-5);
      if (aAwayOnly.length > 0) {
        f.awayFormPpg = aAwayOnly.reduce((s, e) => s + e.points, 0) / aAwayOnly.length;
        f.awayFormGf = aAwayOnly.reduce((s, e) => s + e.gf, 0) / aAwayOnly.length;
        f.awayFormGa = aAwayOnly.reduce((s, e) => s + e.ga, 0) / aAwayOnly.length;
      }

      f.ppmHome = hh.length > 0 ? hh.reduce((s, e) => s + e.points, 0) / hh.length : 0;
      f.ppmAway = ah.length > 0 ? ah.reduce((s, e) => s + e.points, 0) / ah.length : 0;

      // Rolling Strength & Opponent-adjusted Strength
      if (hh.length > 0) {
        const gf = hh.reduce((s, e) => s + e.gf, 0) / hh.length;
        const ga = hh.reduce((s, e) => s + e.ga, 0) / hh.length;
        f.rollingStrengthHome = gf - ga;
        const avgOppElo = hh.reduce((s, e) => s + e.oppElo, 0) / hh.length;
        f.oppAdjustedStrengthHome = (gf - ga) * (avgOppElo / ELO_START);
      }
      if (ah.length > 0) {
        const gf = ah.reduce((s, e) => s + e.gf, 0) / ah.length;
        const ga = ah.reduce((s, e) => s + e.ga, 0) / ah.length;
        f.rollingStrengthAway = gf - ga;
        const avgOppElo = ah.reduce((s, e) => s + e.oppElo, 0) / ah.length;
        f.oppAdjustedStrengthAway = (gf - ga) * (avgOppElo / ELO_START);
      }

      // Rest & Schedule density
      const hDates = rest.get(hk) ?? [];
      const aDates = rest.get(ak) ?? [];
      const lastHDate = hDates[hDates.length - 1];
      const lastADate = aDates[aDates.length - 1];
      f.restDaysHome = lastHDate ? daysBetween(lastHDate, m.matchDate) : REST_CAP_DAYS;
      f.restDaysAway = lastADate ? daysBetween(lastADate, m.matchDate) : REST_CAP_DAYS;
      f.restDiff = f.restDaysHome - f.restDaysAway;

      const density14 = (dates: string[]) =>
        dates.filter((d) => daysBetween(d, m.matchDate) <= 14).length;
      f.scheduleDensity14dHome = density14(hDates);
      f.scheduleDensity14dAway = density14(aDates);

      // Season progression & goals
      const hs = seasons.get(hk);
      const as = seasons.get(ak);
      if (hs && hs.season === m.season && hs.matches > 0) {
        f.seasonProgressionHome = hs.matches;
        f.teamSeasonGfHome = hs.gf / hs.matches;
        f.teamSeasonGaHome = hs.ga / hs.matches;
      }
      if (as && as.season === m.season && as.matches > 0) {
        f.seasonProgressionAway = as.matches;
        f.teamSeasonGfAway = as.gf / as.matches;
        f.teamSeasonGaAway = as.ga / as.matches;
      }

      // League expanding context
      const ls = leagueStats.get(m.leagueId);
      if (ls && ls.matches > 0) {
        f.leagueGoalsPerMatch = (ls.homeGoals + ls.awayGoals) / ls.matches;
        f.homeAdvantageGoals = (ls.homeGoals - ls.awayGoals) / ls.matches;
      } else if (globalStats.matches > 0) {
        f.leagueGoalsPerMatch = (globalStats.homeGoals + globalStats.awayGoals) / globalStats.matches;
        f.homeAdvantageGoals = (globalStats.homeGoals - globalStats.awayGoals) / globalStats.matches;
      }

      m.features = f;
    }

    // Pass 2: Update state with all results in date group
    for (let k = i; k < j; k++) {
      const m = rawMatches[k];
      const hk = teamKey(m.leagueId, m.homeTeam);
      const ak = teamKey(m.leagueId, m.awayTeam);

      const hWin = m.homeGoals > m.awayGoals;
      const aWin = m.awayGoals > m.homeGoals;
      const hPts = hWin ? 3 : aWin ? 0 : 1;
      const aPts = aWin ? 3 : hWin ? 0 : 1;

      // Update Elo
      const hElo = elo.get(hk) ?? ELO_START;
      const aElo = elo.get(ak) ?? ELO_START;
      const expectedHome = 1 / (1 + 10 ** (-(hElo + ELO_HOME_ADVANTAGE - aElo) / 400));
      const scoreHome = hWin ? 1 : aWin ? 0 : 0.5;
      const delta = ELO_K * (scoreHome - expectedHome);
      elo.set(hk, hElo + delta);
      elo.set(ak, aElo - delta);

      // Update History
      const pushHist = (key: string, entry: MatchHistoryEntry) => {
        const list = history.get(key) ?? [];
        list.push(entry);
        if (list.length > 20) list.splice(0, list.length - 20);
        history.set(key, list);
      };
      pushHist(hk, { date: m.matchDate, isHome: true, points: hPts, gf: m.homeGoals, ga: m.awayGoals, oppElo: aElo });
      pushHist(ak, { date: m.matchDate, isHome: false, points: aPts, gf: m.awayGoals, ga: m.homeGoals, oppElo: hElo });

      // Update Season
      const updateSeason = (key: string, pts: number, gf: number, ga: number) => {
        const prev = seasons.get(key);
        const stat: TeamSeasonAccumulator =
          prev && prev.season === m.season ? prev : { season: m.season, matches: 0, points: 0, gf: 0, ga: 0 };
        stat.matches += 1;
        stat.points += pts;
        stat.gf += gf;
        stat.ga += ga;
        seasons.set(key, stat);
      };
      updateSeason(hk, hPts, m.homeGoals, m.awayGoals);
      updateSeason(ak, aPts, m.awayGoals, m.homeGoals);

      // Update Rest / Schedule dates
      const pushDate = (key: string) => {
        const list = rest.get(key) ?? [];
        list.push(m.matchDate);
        rest.set(key, list);
      };
      pushDate(hk);
      pushDate(ak);

      // Update Expanding League
      const ls = leagueStats.get(m.leagueId) ?? { matches: 0, homeGoals: 0, awayGoals: 0 };
      ls.matches += 1;
      ls.homeGoals += m.homeGoals;
      ls.awayGoals += m.awayGoals;
      leagueStats.set(m.leagueId, ls);

      globalStats.matches += 1;
      globalStats.homeGoals += m.homeGoals;
      globalStats.awayGoals += m.awayGoals;
    }

    i = j;
  }

  return rawMatches;
}
