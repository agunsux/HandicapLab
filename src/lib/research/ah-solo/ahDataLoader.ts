// EPIC 56 — Asian Handicap Data Loader & Inventory Engine
// Location: src/lib/research/ah-solo/ahDataLoader.ts

import * as fs from 'fs';
import * as path from 'path';
import { CanonicalMatch, AhMarketOddsRow, MergedAhObservation } from './ahTypes';

export interface DataInventorySummary {
  totalMatches: number;
  validMatches: number;
  totalMarketOddsRows: number;
  ahMarketOddsRows: number;
  ouMarketOddsRows: number;
  mlMarketOddsRows: number;
  bttsMarketOddsRows: number;
  uniqueAhFixtures: number;
  ahLineDistribution: Record<string, { openingRows: number; closingRows: number; totalRows: number }>;
  bookmakerCoverage: Record<string, number>;
  closingOddsCoveragePct: number;
  dateRange: { earliest: string; latest: string };
  leagues: Record<string, { matches: number; ahRows: number; seasons: string[] }>;
  duplicateObservations: number;
  invalidOddsCount: number;
  orphanOddsCount: number;
}

export class AhDataLoader {
  private static canonicalMatchesPath = path.resolve(process.cwd(), 'data', 'golden', 'europe', 'canonical_matches.jsonl');
  private static marketOddsPath = path.resolve(process.cwd(), 'data', 'golden', 'europe', 'market_odds.jsonl');

  public static loadCanonicalMatches(): CanonicalMatch[] {
    if (!fs.existsSync(this.canonicalMatchesPath)) {
      throw new Error(`Canonical matches file missing at: ${this.canonicalMatchesPath}`);
    }
    const content = fs.readFileSync(this.canonicalMatchesPath, 'utf8');
    const lines = content.trim().split('\n');
    const matches: CanonicalMatch[] = [];

    for (const line of lines) {
      if (!line) continue;
      const m = JSON.parse(line);
      matches.push({
        canonicalId: m.canonicalId,
        leagueId: m.leagueId,
        cluster: m.cluster,
        season: m.season,
        matchDate: m.matchDate,
        homeTeam: m.homeTeam,
        awayTeam: m.awayTeam,
        homeGoals: Number(m.homeGoals),
        awayGoals: Number(m.awayGoals),
        result: m.result,
        resultVerified: Boolean(m.resultVerified),
        totalGoals: Number(m.totalGoals),
        odds: m.odds,
      });
    }

    return matches.sort((a, b) => a.matchDate.localeCompare(b.matchDate));
  }

  public static loadMarketOdds(): AhMarketOddsRow[] {
    if (!fs.existsSync(this.marketOddsPath)) {
      throw new Error(`Market odds file missing at: ${this.marketOddsPath}`);
    }
    const content = fs.readFileSync(this.marketOddsPath, 'utf8');
    const lines = content.trim().split('\n');
    const oddsRows: AhMarketOddsRow[] = [];

    for (const line of lines) {
      if (!line) continue;
      const o = JSON.parse(line);
      oddsRows.push({
        odds_id: o.odds_id,
        canonical_id: o.canonical_id,
        league_id: o.league_id,
        cluster: o.cluster,
        season: o.season,
        match_date: o.match_date,
        market: o.market,
        observation: o.observation,
        bookmaker_source: o.bookmaker_source,
        line: Number(o.line),
        home_odds: Number(o.home_odds),
        away_odds: Number(o.away_odds),
      });
    }

    return oddsRows;
  }

  public static computeDataInventory(): {
    matches: CanonicalMatch[];
    inventory: DataInventorySummary;
    mergedAhObservations: MergedAhObservation[];
  } {
    const matches = this.loadCanonicalMatches();
    const marketOdds = this.loadMarketOdds();

    const matchMap = new Map<string, CanonicalMatch>();
    for (const m of matches) {
      matchMap.set(m.canonicalId, m);
    }

    let ahCount = 0;
    let ouCount = 0;
    let mlCount = 0;
    let bttsCount = 0;
    let orphanOdds = 0;
    let invalidOdds = 0;
    let duplicateObs = 0;

    const uniqueAhFixtures = new Set<string>();
    const lineDist: Record<string, { openingRows: number; closingRows: number; totalRows: number }> = {};
    const bookmakers: Record<string, number> = {};
    const leagues: Record<string, { matches: number; ahRows: number; seasons: Set<string> }> = {};

    let closingAhCount = 0;
    let openingAhCount = 0;

    // Track opening and closing pairs per fixture + line + bookmaker
    const ahPairMap = new Map<string, { opening?: AhMarketOddsRow; closing?: AhMarketOddsRow }>();

    for (const row of marketOdds) {
      const match = matchMap.get(row.canonical_id);
      if (!match) {
        orphanOdds++;
        continue;
      }

      if (row.market === 'ML') mlCount++;
      else if (row.market === 'OU') ouCount++;
      else if (row.market === 'AH') {
        ahCount++;
        uniqueAhFixtures.add(row.canonical_id);

        if (isNaN(row.home_odds) || isNaN(row.away_odds) || row.home_odds <= 1.0 || row.away_odds <= 1.0) {
          invalidOdds++;
        }

        const lineKey = row.line >= 0 ? `+${row.line.toFixed(2)}` : row.line.toFixed(2);
        if (!lineDist[lineKey]) {
          lineDist[lineKey] = { openingRows: 0, closingRows: 0, totalRows: 0 };
        }
        lineDist[lineKey].totalRows++;
        if (row.observation === 'opening') {
          lineDist[lineKey].openingRows++;
          openingAhCount++;
        } else if (row.observation === 'closing') {
          lineDist[lineKey].closingRows++;
          closingAhCount++;
        }

        const bk = row.bookmaker_source || 'unknown';
        bookmakers[bk] = (bookmakers[bk] || 0) + 1;

        if (!leagues[row.league_id]) {
          leagues[row.league_id] = { matches: 0, ahRows: 0, seasons: new Set<string>() };
        }
        leagues[row.league_id].ahRows++;
        leagues[row.league_id].seasons.add(row.season);

        // Pair opening & closing
        const pairKey = `${row.canonical_id}|${row.line}|${row.bookmaker_source}`;
        const existing = ahPairMap.get(pairKey) || {};
        if (row.observation === 'opening') {
          if (existing.opening) duplicateObs++;
          existing.opening = row;
        } else {
          if (existing.closing) duplicateObs++;
          existing.closing = row;
        }
        ahPairMap.set(pairKey, existing);
      }
    }

    for (const m of matches) {
      if (!leagues[m.leagueId]) {
        leagues[m.leagueId] = { matches: 0, ahRows: 0, seasons: new Set<string>() };
      }
      leagues[m.leagueId].matches++;
      leagues[m.leagueId].seasons.add(m.season);
    }

    const mergedObservations: MergedAhObservation[] = [];

    for (const [pairKey, pair] of ahPairMap.entries()) {
      const row = pair.opening || pair.closing;
      if (!row) continue;
      const match = matchMap.get(row.canonical_id);
      if (!match) continue;

      const takenHomeOdds = pair.opening ? pair.opening.home_odds : pair.closing!.home_odds;
      const takenAwayOdds = pair.opening ? pair.opening.away_odds : pair.closing!.away_odds;
      const closingHomeOdds = pair.closing ? pair.closing.home_odds : undefined;
      const closingAwayOdds = pair.closing ? pair.closing.away_odds : undefined;

      if (takenHomeOdds > 1.0) {
        mergedObservations.push({
          canonicalId: match.canonicalId,
          leagueId: match.leagueId,
          season: match.season,
          matchDate: match.matchDate,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeGoals: match.homeGoals,
          awayGoals: match.awayGoals,
          line: row.line,
          side: 'home',
          takenOdds: takenHomeOdds,
          closingOdds: closingHomeOdds,
          bookmaker: row.bookmaker_source,
          isOpening: !!pair.opening,
        });
      }

      if (takenAwayOdds > 1.0) {
        // Away handicap line is opposite of home line
        const awayLine = -row.line;
        mergedObservations.push({
          canonicalId: match.canonicalId,
          leagueId: match.leagueId,
          season: match.season,
          matchDate: match.matchDate,
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          homeGoals: match.homeGoals,
          awayGoals: match.awayGoals,
          line: awayLine,
          side: 'away',
          takenOdds: takenAwayOdds,
          closingOdds: closingAwayOdds,
          bookmaker: row.bookmaker_source,
          isOpening: !!pair.opening,
        });
      }
    }

    const sortedMerged = mergedObservations.sort((a, b) => a.matchDate.localeCompare(b.matchDate));

    const leagueSummary: Record<string, { matches: number; ahRows: number; seasons: string[] }> = {};
    for (const [k, v] of Object.entries(leagues)) {
      leagueSummary[k] = {
        matches: v.matches,
        ahRows: v.ahRows,
        seasons: Array.from(v.seasons).sort(),
      };
    }

    const inventory: DataInventorySummary = {
      totalMatches: matches.length,
      validMatches: matches.filter((m) => m.resultVerified).length,
      totalMarketOddsRows: marketOdds.length,
      ahMarketOddsRows: ahCount,
      ouMarketOddsRows: ouCount,
      mlMarketOddsRows: mlCount,
      bttsMarketOddsRows: bttsCount,
      uniqueAhFixtures: uniqueAhFixtures.size,
      ahLineDistribution: lineDist,
      bookmakerCoverage: bookmakers,
      closingOddsCoveragePct: openingAhCount > 0 ? Number(((closingAhCount / openingAhCount) * 100).toFixed(2)) : 0,
      dateRange: {
        earliest: matches.length > 0 ? matches[0].matchDate : '',
        latest: matches.length > 0 ? matches[matches.length - 1].matchDate : '',
      },
      leagues: leagueSummary,
      duplicateObservations: duplicateObs,
      invalidOddsCount: invalidOdds,
      orphanOddsCount: orphanOdds,
    };

    return {
      matches,
      inventory,
      mergedAhObservations: sortedMerged,
    };
  }
}
