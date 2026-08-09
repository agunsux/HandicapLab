import type { FeatureSnapshot, LeakageAuditEntry, NormalizedMatch, TeamFeatures, H2hFeatures } from '../types';

export const FEATURE_VERSION = 'historical-v1';

interface TeamLog {
  entries: { date: string; gf: number; ga: number; isHome: boolean }[];
  elo: number | null;
  eloGames: number;
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function pointsOf(gf: number, ga: number, isHome: boolean): number {
  if (gf === ga) return 1;
  if (gf > ga) return 3;
  return 0;
}

function lastN<T>(arr: T[], n: number): T[] {
  return arr.slice(-n);
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Number((nums.reduce((s, v) => s + v, 0) / nums.length).toFixed(4));
}

function winRate(wins: number, total: number): number | null {
  if (total === 0) return null;
  return Number((wins / total).toFixed(4));
}

function buildTeamFeatures(team: string, log: TeamLog, nowDate: string): TeamFeatures {
  const prior = log.entries.filter((e) => e.date < nowDate);
  const last5 = lastN(prior, 5);
  const homeMatches = prior.filter((e) => e.isHome);
  const awayMatches = prior.filter((e) => !e.isHome);
  const homeWins = homeMatches.filter((e) => e.gf > e.ga).length;
  const awayWins = awayMatches.filter((e) => e.gf > e.ga).length;
  const lastEntry = prior[prior.length - 1] ?? null;

  return {
    team,
    has_history: prior.length > 0,
    last5_goals_for: last5.map((e) => e.gf),
    last5_goals_against: last5.map((e) => e.ga),
    last5_points: last5.map((e) => pointsOf(e.gf, e.ga, e.isHome)),
    form_points_last5: last5.length > 0 ? last5.reduce((s, e) => s + pointsOf(e.gf, e.ga, e.isHome), 0) : null,
    avg_goals_for: avg(prior.map((e) => e.gf)),
    avg_goals_against: avg(prior.map((e) => e.ga)),
    home_avg_goals_for: avg(homeMatches.map((e) => e.gf)),
    home_avg_goals_against: avg(homeMatches.map((e) => e.ga)),
    away_avg_goals_for: avg(awayMatches.map((e) => e.gf)),
    away_avg_goals_against: avg(awayMatches.map((e) => e.ga)),
    home_win_rate: winRate(homeWins, homeMatches.length),
    away_win_rate: winRate(awayWins, awayMatches.length),
    elo: log.elo,
    elo_games: log.eloGames,
    rest_days: lastEntry ? daysBetween(lastEntry.date, nowDate) : null,
  };
}

function buildH2h(homeTeam: string, awayTeam: string, prior: NormalizedMatch[], nowDate: string): H2hFeatures {
  const meetings = prior.filter(
    (m) => m.match_date < nowDate && ((m.home_team === homeTeam && m.away_team === awayTeam) || (m.home_team === awayTeam && m.away_team === homeTeam))
  );
  if (meetings.length === 0) return { has_history: false, meetings_count: 0, home_win_rate: null };
  const homeWins = meetings.filter((m) => m.home_team === homeTeam && m.result === 'H').length;
  return { has_history: true, meetings_count: meetings.length, home_win_rate: Number((homeWins / meetings.length).toFixed(4)) };
}

export interface GoldComputeOutput {
  snapshots: FeatureSnapshot[];
  leakage: LeakageAuditEntry[];
  violations: number;
}

export function computeFeatureSnapshots(matches: NormalizedMatch[]): GoldComputeOutput {
  const logs = new Map<string, TeamLog>();
  const priorMatches: NormalizedMatch[] = [];
  const snapshots: FeatureSnapshot[] = [];
  const leakage: LeakageAuditEntry[] = [];
  let violations = 0;

  const getLog = (team: string): TeamLog => {
    let log = logs.get(team);
    if (!log) {
      log = { entries: [], elo: null, eloGames: 0 };
      logs.set(team, log);
    }
    return log;
  };

  for (const match of matches) {
    const homeLog = getLog(match.home_team);
    const awayLog = getLog(match.away_team);
    const priorStrict = priorMatches.filter((m) => m.match_date < match.match_date);

    const homeFeatures = buildTeamFeatures(match.home_team, homeLog, match.match_date);
    const awayFeatures = buildTeamFeatures(match.away_team, awayLog, match.match_date);
    const h2h = buildH2h(match.home_team, match.away_team, priorStrict, match.match_date);

    const leagueAvgGoals = priorStrict.length >= 10
      ? Number((priorStrict.reduce((s, m) => s + m.home_goals + m.away_goals, 0) / priorStrict.length).toFixed(4))
      : null;

    const sourceDates = [
      ...homeLog.entries.filter((e) => e.date < match.match_date).map((e) => e.date),
      ...awayLog.entries.filter((e) => e.date < match.match_date).map((e) => e.date),
      ...priorStrict.map((m) => m.match_date),
    ];
    const minSourceDate = sourceDates.length > 0 ? sourceDates.reduce((a, b) => (a < b ? a : b)) : null;
    const leakFree = minSourceDate === null || minSourceDate < match.match_date;

    const presence: Record<string, 'REAL' | 'MISSING'> = {
      home_form_points_last5: homeFeatures.form_points_last5 !== null ? 'REAL' : 'MISSING',
      home_avg_goals_for: homeFeatures.avg_goals_for !== null ? 'REAL' : 'MISSING',
      home_avg_goals_against: homeFeatures.avg_goals_against !== null ? 'REAL' : 'MISSING',
      home_home_win_rate: homeFeatures.home_win_rate !== null ? 'REAL' : 'MISSING',
      home_away_win_rate: homeFeatures.away_win_rate !== null ? 'REAL' : 'MISSING',
      home_elo: homeFeatures.elo !== null ? 'REAL' : 'MISSING',
      home_rest_days: homeFeatures.rest_days !== null ? 'REAL' : 'MISSING',
      away_form_points_last5: awayFeatures.form_points_last5 !== null ? 'REAL' : 'MISSING',
      away_avg_goals_for: awayFeatures.avg_goals_for !== null ? 'REAL' : 'MISSING',
      away_avg_goals_against: awayFeatures.avg_goals_against !== null ? 'REAL' : 'MISSING',
      away_home_win_rate: awayFeatures.home_win_rate !== null ? 'REAL' : 'MISSING',
      away_away_win_rate: awayFeatures.away_win_rate !== null ? 'REAL' : 'MISSING',
      away_elo: awayFeatures.elo !== null ? 'REAL' : 'MISSING',
      away_rest_days: awayFeatures.rest_days !== null ? 'REAL' : 'MISSING',
      h2h: h2h.has_history ? 'REAL' : 'MISSING',
      league_avg_goals: leagueAvgGoals !== null ? 'REAL' : 'MISSING',
    };

    snapshots.push({
      match_id: match.canonical_id,
      league: match.league,
      season: match.season,
      match_date: match.match_date,
      prediction_timestamp: `${match.match_date}T00:00:00Z`,
      feature_version: FEATURE_VERSION,
      home: homeFeatures,
      away: awayFeatures,
      h2h,
      league_avg_goals: leagueAvgGoals,
      league_has_history: priorStrict.length >= 10,
      feature_presence: presence,
      computation: { method: 'rolling-windows-and-elo, chronological, strict date boundary (same-day matches excluded due to date-only granularity)', boundary: 'match_date', source: 'raw_matches' },
    });

    if (!leakFree) violations += 1;
    leakage.push({ match_id: match.canonical_id, match_date: match.match_date, min_source_date: minSourceDate, leak_free: leakFree });

    priorMatches.push(match);

    const homeResult = pointsOf(match.home_goals, match.away_goals, true);
    const awayResult = pointsOf(match.home_goals, match.away_goals, false);
    const homeScore = homeResult === 3 ? 1 : homeResult === 1 ? 0.5 : 0;
    const awayScore = awayResult === 3 ? 1 : awayResult === 1 ? 0.5 : 0;
    const expectedHome = homeLog.elo !== null && awayLog.elo !== null ? 1 / (1 + Math.pow(10, ((awayLog.elo ?? 1500) - (homeLog.elo ?? 1500)) / 400)) : 0.5;
    const expectedAway = 1 - expectedHome;
    const K = 32;

    if (homeLog.elo === null) homeLog.elo = 1500;
    if (awayLog.elo === null) awayLog.elo = 1500;
    homeLog.elo = Number((homeLog.elo + K * (homeScore - expectedHome)).toFixed(1));
    awayLog.elo = Number((awayLog.elo + K * (awayScore - expectedAway)).toFixed(1));
    homeLog.eloGames += 1;
    awayLog.eloGames += 1;
    homeLog.entries.push({ date: match.match_date, gf: match.home_goals, ga: match.away_goals, isHome: true });
    awayLog.entries.push({ date: match.match_date, gf: match.away_goals, ga: match.home_goals, isHome: false });
  }

  return { snapshots, leakage, violations };
}
