import { RawFootyStatsMatch, NormalizedProxyOddsRecord } from './types';
import { parseOddsValue } from './footystatsClient';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function generateFixtureKey(season: string, matchDate: string, homeTeam: string, awayTeam: string): string {
  return `EPL|${season}|${matchDate}|${slugify(homeTeam)}|${slugify(awayTeam)}`;
}

export function normalizeMatchOdds(
  match: RawFootyStatsMatch,
  season: string,
  sourceFile: string,
  sourceRow: number
): NormalizedProxyOddsRecord[] {
  const records: NormalizedProxyOddsRecord[] = [];
  const matchDate = new Date(match.date_unix * 1000).toISOString().split('T')[0];
  const fixtureKey = generateFixtureKey(season, matchDate, match.home_name, match.away_name);

  const baseRecord = {
    fixtureKey,
    season,
    date_unix: match.date_unix,
    matchDate,
    homeTeam: match.home_name,
    awayTeam: match.away_name,
    provenance: 'footystats_proxy' as const,
    oddsTimestamp: null,
    bookmaker: null,
    sourceFile,
    sourceRow,
  };

  // 1. 1X2 Market
  const hOdds = parseOddsValue(match.odds_ft_1);
  if (hOdds !== null) {
    records.push({ ...baseRecord, market: '1X2', line: null, side: 'home', odds: hOdds });
  }
  const dOdds = parseOddsValue(match.odds_ft_x);
  if (dOdds !== null) {
    records.push({ ...baseRecord, market: '1X2', line: null, side: 'draw', odds: dOdds });
  }
  const aOdds = parseOddsValue(match.odds_ft_2);
  if (aOdds !== null) {
    records.push({ ...baseRecord, market: '1X2', line: null, side: 'away', odds: aOdds });
  }

  // 2. Both Teams To Score (BTTS)
  const bttsYes = parseOddsValue(match.odds_btts_yes);
  if (bttsYes !== null) {
    records.push({ ...baseRecord, market: 'BTTS', line: null, side: 'yes', odds: bttsYes });
  }
  const bttsNo = parseOddsValue(match.odds_btts_no);
  if (bttsNo !== null) {
    records.push({ ...baseRecord, market: 'BTTS', line: null, side: 'no', odds: bttsNo });
  }

  // 3. Over / Under Lines (0.5, 1.5, 2.5, 3.5, 4.5)
  const ouLines = [
    { line: 0.5, over: match.odds_ft_over05, under: match.odds_ft_under05 },
    { line: 1.5, over: match.odds_ft_over15, under: match.odds_ft_under15 },
    { line: 2.5, over: match.odds_ft_over25, under: match.odds_ft_under25 },
    { line: 3.5, over: match.odds_ft_over35, under: match.odds_ft_under35 },
    { line: 4.5, over: match.odds_ft_over45, under: match.odds_ft_under45 },
  ];

  for (const ou of ouLines) {
    const overOdds = parseOddsValue(ou.over);
    if (overOdds !== null) {
      records.push({ ...baseRecord, market: 'OU', line: ou.line, side: 'over', odds: overOdds });
    }
    const underOdds = parseOddsValue(ou.under);
    if (underOdds !== null) {
      records.push({ ...baseRecord, market: 'OU', line: ou.line, side: 'under', odds: underOdds });
    }
  }

  // 4. Clean Sheet Markets (CS_A: Team A clean sheet, CS_B: Team B clean sheet)
  const csAYes = parseOddsValue(match.odds_team_a_cs_yes);
  if (csAYes !== null) {
    records.push({ ...baseRecord, market: 'CS_A', line: null, side: 'yes', odds: csAYes });
  }
  const csANo = parseOddsValue(match.odds_team_a_cs_no);
  if (csANo !== null) {
    records.push({ ...baseRecord, market: 'CS_A', line: null, side: 'no', odds: csANo });
  }

  const csBYes = parseOddsValue(match.odds_team_b_cs_yes);
  if (csBYes !== null) {
    records.push({ ...baseRecord, market: 'CS_B', line: null, side: 'yes', odds: csBYes });
  }
  const csBNo = parseOddsValue(match.odds_team_b_cs_no);
  if (csBNo !== null) {
    records.push({ ...baseRecord, market: 'CS_B', line: null, side: 'no', odds: csBNo });
  }

  return records;
}

