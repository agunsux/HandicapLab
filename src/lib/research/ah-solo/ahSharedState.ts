// EPIC 56 — Point-in-Time Shared Football State Engine (Optimized)
// Location: src/lib/research/ah-solo/ahSharedState.ts

import { CanonicalMatch, PointInTimeFootballState } from './ahTypes';

export interface StateCalculationConfig {
  decayHalfLifeDays?: number; // default 90 days
  minMatchesForRating?: number; // default 3
  homeAdvantageFactor?: number; // baseline 1.15
}

export class AhSharedStateEngine {
  /**
   * Computes point-in-time football state strictly from historical matches occurring before matchDate.
   */
  public static computeState(
    match: CanonicalMatch,
    priorMatches: CanonicalMatch[],
    config: StateCalculationConfig = {}
  ): PointInTimeFootballState {
    const halfLife = config.decayHalfLifeDays || 90;
    const matchTime = new Date(match.matchDate).getTime();

    // League scoring baseline and team histories
    let totalHomeGoals = 0;
    let totalAwayGoals = 0;
    let totalLeagueMatches = 0;

    let homeWeightedScored = 0;
    let homeWeightedConceded = 0;
    let homeWeightSum = 0;
    let homeLastDate: string | null = null;
    let homeMatchCount = 0;

    let awayWeightedScored = 0;
    let awayWeightedConceded = 0;
    let awayWeightSum = 0;
    let awayLastDate: string | null = null;
    let awayMatchCount = 0;

    for (let i = 0; i < priorMatches.length; i++) {
      const m = priorMatches[i];
      if (m.matchDate >= match.matchDate) break; // Matches are sorted chronologically
      if (m.leagueId !== match.leagueId) continue;

      totalHomeGoals += m.homeGoals;
      totalAwayGoals += m.awayGoals;
      totalLeagueMatches++;

      const mTime = new Date(m.matchDate).getTime();
      const daysDiff = Math.max(0, (matchTime - mTime) / (1000 * 60 * 60 * 24));
      const weight = Math.exp(-Math.LN2 * (daysDiff / halfLife));

      if (m.homeTeam === match.homeTeam || m.awayTeam === match.homeTeam) {
        homeMatchCount++;
        const isHome = m.homeTeam === match.homeTeam;
        const scored = isHome ? m.homeGoals : m.awayGoals;
        const conceded = isHome ? m.awayGoals : m.homeGoals;
        homeWeightedScored += scored * weight;
        homeWeightedConceded += conceded * weight;
        homeWeightSum += weight;
        if (!homeLastDate || m.matchDate > homeLastDate) homeLastDate = m.matchDate;
      }

      if (m.homeTeam === match.awayTeam || m.awayTeam === match.awayTeam) {
        awayMatchCount++;
        const isHome = m.homeTeam === match.awayTeam;
        const scored = isHome ? m.homeGoals : m.awayGoals;
        const conceded = isHome ? m.awayGoals : m.homeGoals;
        awayWeightedScored += scored * weight;
        awayWeightedConceded += conceded * weight;
        awayWeightSum += weight;
        if (!awayLastDate || m.matchDate > awayLastDate) awayLastDate = m.matchDate;
      }
    }

    const leagueAvgHome = totalLeagueMatches >= 10 ? totalHomeGoals / totalLeagueMatches : 1.50;
    const leagueAvgAway = totalLeagueMatches >= 10 ? totalAwayGoals / totalLeagueMatches : 1.15;
    const leagueAvgGoals = leagueAvgHome + leagueAvgAway;

    const homeAvgScored = homeWeightSum > 0 ? homeWeightedScored / homeWeightSum : 1.35;
    const homeAvgConceded = homeWeightSum > 0 ? homeWeightedConceded / homeWeightSum : 1.35;
    const homeRestDays = homeLastDate
      ? Math.max(1, Math.round((matchTime - new Date(homeLastDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 7;

    const awayAvgScored = awayWeightSum > 0 ? awayWeightedScored / awayWeightSum : 1.35;
    const awayAvgConceded = awayWeightSum > 0 ? awayWeightedConceded / awayWeightSum : 1.35;
    const awayRestDays = awayLastDate
      ? Math.max(1, Math.round((matchTime - new Date(awayLastDate).getTime()) / (1000 * 60 * 60 * 24)))
      : 7;

    const homeAttack = homeMatchCount >= 3 ? Math.max(0.4, homeAvgScored / (leagueAvgHome || 1.5)) : 1.0;
    const homeDefense = homeMatchCount >= 3 ? Math.max(0.4, homeAvgConceded / (leagueAvgAway || 1.15)) : 1.0;

    const awayAttack = awayMatchCount >= 3 ? Math.max(0.4, awayAvgScored / (leagueAvgAway || 1.15)) : 1.0;
    const awayDefense = awayMatchCount >= 3 ? Math.max(0.4, awayAvgConceded / (leagueAvgHome || 1.5)) : 1.0;

    const homeAdvantage = leagueAvgAway > 0 ? Math.max(1.05, Math.min(1.30, leagueAvgHome / leagueAvgAway)) : 1.18;

    const homeRestMultiplier = homeRestDays < 4 ? 0.96 : homeRestDays > 10 ? 1.01 : 1.0;
    const awayRestMultiplier = awayRestDays < 4 ? 0.94 : awayRestDays > 10 ? 1.01 : 1.0;

    const expectedHomeGoals = Number(
      Math.max(0.2, leagueAvgHome * homeAttack * awayDefense * (homeAdvantage / 1.15) * homeRestMultiplier).toFixed(4)
    );
    const expectedAwayGoals = Number(
      Math.max(0.2, leagueAvgAway * awayAttack * homeDefense * awayRestMultiplier).toFixed(4)
    );

    return {
      matchDate: match.matchDate,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      leagueId: match.leagueId,
      homeAttack: Number(homeAttack.toFixed(4)),
      homeDefense: Number(homeDefense.toFixed(4)),
      awayAttack: Number(awayAttack.toFixed(4)),
      awayDefense: Number(awayDefense.toFixed(4)),
      homeAdvantage: Number(homeAdvantage.toFixed(4)),
      leagueAvgGoals: Number(leagueAvgGoals.toFixed(4)),
      homeRestDays,
      awayRestDays,
      expectedHomeGoals,
      expectedAwayGoals,
    };
  }
}
