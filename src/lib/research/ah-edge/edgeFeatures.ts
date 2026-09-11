// AH EDGE ENGINE — Point-in-time feature construction.
//
// TEMPORAL INTEGRITY: features for a match are computed from matches with a
// STRICTLY EARLIER calendar date. Matches on the same date are computed first
// for the whole date group, then state is updated, so no same-day result can
// leak into another same-day prediction. No future aggregate is ever used.
//
// Feature inventory (all derived from the frozen canonical dataset only):
//  elo            sequential Elo rating (K=20, home advantage 60) before kickoff
//  form           points / goals for / goals against per match, last 5 matches
//  rest           days since the team's previous match (cap 30)
//  season         season-to-date points and goals per match (prior matches only)
//  league         expanding league home/away goals per match + home advantage

import type { EdgeMatch, PointInTimeFeatures } from './edgeTypes';

const ELO_START = 1500;
const ELO_K = 20;
const ELO_HOME_ADVANTAGE = 60;
const REST_CAP_DAYS = 30;
const FORM_WINDOW = 5;

interface TeamHistoryEntry {
  date: string;
  points: number;
  gf: number;
  ga: number;
}

interface SeasonStat {
  season: string;
  matches: number;
  points: number;
  gf: number;
  ga: number;
}

interface ExpandingStat {
  matches: number;
  homeGoals: number;
  awayGoals: number;
  points: number;
}

export interface FeatureMissingness {
  totalMatches: number;
  eloFallbackHome: number;
  eloFallbackAway: number;
  formFallbackHome: number;
  formFallbackAway: number;
  leagueFallback: number;
  restFallback: number;
}

function emptyFeatures(): PointInTimeFeatures {
  return {
    eloHome: ELO_START,
    eloAway: ELO_START,
    eloDiff: 0,
    homePpg5: 0,
    awayPpg5: 0,
    homeGf5: 0,
    homeGa5: 0,
    awayGf5: 0,
    awayGa5: 0,
    homeRestDays: REST_CAP_DAYS,
    awayRestDays: REST_CAP_DAYS,
    homeSeasonMatches: 0,
    awaySeasonMatches: 0,
    homeSeasonPpg: 0,
    awaySeasonPpg: 0,
    homeSeasonGfPerMatch: 0,
    homeSeasonGaPerMatch: 0,
    awaySeasonGfPerMatch: 0,
    awaySeasonGaPerMatch: 0,
    leagueHomeGoalsPerMatch: 0,
    leagueAwayGoalsPerMatch: 0,
    homeAdvantageGoals: 0,
  };
}

function daysBetween(earlier: string, later: string): number {
  const a = Date.parse(`${earlier}T00:00:00Z`);
  const b = Date.parse(`${later}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return REST_CAP_DAYS;
  return Math.max(0, Math.min(REST_CAP_DAYS, Math.round((b - a) / 86400000)));
}

export function computePointInTimeFeatures(matches: EdgeMatch[]): FeatureMissingness {
  const elo = new Map<string, number>();
  const history = new Map<string, TeamHistoryEntry[]>();
  const seasons = new Map<string, SeasonStat>();
  const rest = new Map<string, string>();
  const leagueStats = new Map<string, ExpandingStat>();
  const globalStats: ExpandingStat = { matches: 0, homeGoals: 0, awayGoals: 0, points: 0 };

  const missingness: FeatureMissingness = {
    totalMatches: matches.length,
    eloFallbackHome: 0,
    eloFallbackAway: 0,
    formFallbackHome: 0,
    formFallbackAway: 0,
    leagueFallback: 0,
    restFallback: 0,
  };

  const teamKey = (m: EdgeMatch, side: 'home' | 'away') =>
    `${m.leagueId}|${side === 'home' ? m.homeTeam : m.awayTeam}`;

  // Process date groups: compute all features, then update state.
  let i = 0;
  while (i < matches.length) {
    let j = i;
    while (j < matches.length && matches[j].matchDate === matches[i].matchDate) j += 1;

    for (let k = i; k < j; k++) {
      const m = matches[k];
      const f = emptyFeatures();

      const hk = teamKey(m, 'home');
      const ak = teamKey(m, 'away');

      // ELO (before update)
      const eh = elo.get(hk);
      const ea = elo.get(ak);
      if (eh === undefined) missingness.eloFallbackHome += 1;
      if (ea === undefined) missingness.eloFallbackAway += 1;
      f.eloHome = eh ?? ELO_START;
      f.eloAway = ea ?? ELO_START;
      f.eloDiff = f.eloHome + ELO_HOME_ADVANTAGE - f.eloAway;

      // Form (strictly earlier matches)
      const hh = history.get(hk) ?? [];
      const ah = history.get(ak) ?? [];
      if (hh.length === 0) missingness.formFallbackHome += 1;
      if (ah.length === 0) missingness.formFallbackAway += 1;

      const lastN = (entries: TeamHistoryEntry[], n: number) => entries.slice(-n);
      const ppg = (entries: TeamHistoryEntry[]) =>
        entries.length > 0 ? entries.reduce((s, e) => s + e.points, 0) / entries.length : 0;
      const gf = (entries: TeamHistoryEntry[]) =>
        entries.length > 0 ? entries.reduce((s, e) => s + e.gf, 0) / entries.length : 0;
      const ga = (entries: TeamHistoryEntry[]) =>
        entries.length > 0 ? entries.reduce((s, e) => s + e.ga, 0) / entries.length : 0;

      const h5 = lastN(hh, FORM_WINDOW);
      const a5 = lastN(ah, FORM_WINDOW);
      f.homePpg5 = ppg(h5);
      f.awayPpg5 = ppg(a5);
      f.homeGf5 = gf(h5);
      f.homeGa5 = ga(h5);
      f.awayGf5 = gf(a5);
      f.awayGa5 = ga(a5);

      // Rest days
      const hr = rest.get(hk);
      const ar = rest.get(ak);
      if (hr === undefined) missingness.restFallback += 1;
      if (ar === undefined) missingness.restFallback += 1;
      f.homeRestDays = hr === undefined ? REST_CAP_DAYS : daysBetween(hr, m.matchDate);
      f.awayRestDays = ar === undefined ? REST_CAP_DAYS : daysBetween(ar, m.matchDate);

      // Season-to-date (same season, prior matches only)
      const hs = seasons.get(hk);
      const as = seasons.get(ak);
      if (hs && hs.season === m.season && hs.matches > 0) {
        f.homeSeasonMatches = hs.matches;
        f.homeSeasonPpg = hs.points / hs.matches;
        f.homeSeasonGfPerMatch = hs.gf / hs.matches;
        f.homeSeasonGaPerMatch = hs.ga / hs.matches;
      }
      if (as && as.season === m.season && as.matches > 0) {
        f.awaySeasonMatches = as.matches;
        f.awaySeasonPpg = as.points / as.matches;
        f.awaySeasonGfPerMatch = as.gf / as.matches;
        f.awaySeasonGaPerMatch = as.ga / as.matches;
      }

      // League expanding context with global fallback, then static fallback.
      const ls = leagueStats.get(m.leagueId);
      if (!ls || ls.matches === 0) {
        missingness.leagueFallback += 1;
        if (globalStats.matches > 0) {
          f.leagueHomeGoalsPerMatch = globalStats.homeGoals / globalStats.matches;
          f.leagueAwayGoalsPerMatch = globalStats.awayGoals / globalStats.matches;
          f.homeAdvantageGoals = f.leagueHomeGoalsPerMatch - f.leagueAwayGoalsPerMatch;
        } else {
          f.leagueHomeGoalsPerMatch = 1.5;
          f.leagueAwayGoalsPerMatch = 1.15;
          f.homeAdvantageGoals = 0.35;
        }
      } else {
        f.leagueHomeGoalsPerMatch = ls.homeGoals / ls.matches;
        f.leagueAwayGoalsPerMatch = ls.awayGoals / ls.matches;
        f.homeAdvantageGoals = f.leagueHomeGoalsPerMatch - f.leagueAwayGoalsPerMatch;
      }

      m.features = f;
    }

    // Update state with the whole date group.
    for (let k = i; k < j; k++) {
      const m = matches[k];
      const hk = teamKey(m, 'home');
      const ak = teamKey(m, 'away');

      const hWin = m.homeGoals > m.awayGoals;
      const aWin = m.awayGoals > m.homeGoals;
      const hPts = hWin ? 3 : aWin ? 0 : 1;
      const aPts = aWin ? 3 : hWin ? 0 : 1;

      const hElo = elo.get(hk) ?? ELO_START;
      const aElo = elo.get(ak) ?? ELO_START;
      const expectedHome = 1 / (1 + 10 ** (-(hElo + ELO_HOME_ADVANTAGE - aElo) / 400));
      const scoreHome = hWin ? 1 : aWin ? 0 : 0.5;
      const delta = ELO_K * (scoreHome - expectedHome);
      elo.set(hk, hElo + delta);
      elo.set(ak, aElo - delta);

      const pushHistory = (key: string, entry: TeamHistoryEntry) => {
        const list = history.get(key) ?? [];
        list.push(entry);
        if (list.length > 10) list.splice(0, list.length - 10);
        history.set(key, list);
      };
      pushHistory(hk, { date: m.matchDate, points: hPts, gf: m.homeGoals, ga: m.awayGoals });
      pushHistory(ak, { date: m.matchDate, points: aPts, gf: m.awayGoals, ga: m.homeGoals });

      const updateSeason = (key: string, pts: number, gf: number, ga: number) => {
        const prev = seasons.get(key);
        const stat: SeasonStat =
          prev && prev.season === m.season ? prev : { season: m.season, matches: 0, points: 0, gf: 0, ga: 0 };
        stat.matches += 1;
        stat.points += pts;
        stat.gf += gf;
        stat.ga += ga;
        seasons.set(key, stat);
      };
      updateSeason(hk, hPts, m.homeGoals, m.awayGoals);
      updateSeason(ak, aPts, m.awayGoals, m.homeGoals);

      const updateExpanding = (stat: ExpandingStat) => {
        stat.matches += 1;
        stat.homeGoals += m.homeGoals;
        stat.awayGoals += m.awayGoals;
        stat.points += hPts + aPts;
      };
      const ls = leagueStats.get(m.leagueId) ?? { matches: 0, homeGoals: 0, awayGoals: 0, points: 0 };
      updateExpanding(ls);
      leagueStats.set(m.leagueId, ls);
      updateExpanding(globalStats);

      rest.set(hk, m.matchDate);
      rest.set(ak, m.matchDate);
    }

    i = j;
  }

  return missingness;
}
