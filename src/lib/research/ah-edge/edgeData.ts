// AH EDGE ENGINE — Dataset assembly from the frozen real datasets.
// Strict canonical-id joins; no team-name matching, no synthetic rows.

import {
  DEFAULT_AH_DATA_PATHS,
  loadCanonicalMatches,
  loadMarketOdds,
  type AhDataPaths,
} from '../ah-yield/ahLoader';
import { isValidHandicapLine } from '../ah-yield/ahSettlement';
import { createProvenanceResolver } from '../ah-yield/ahProvenance';
import type { MarketOddsRecord } from '../ah-yield/ahTypes';
import { devigOneXTwo, devigTwoWay } from './edgeProbability';
import { computePointInTimeFeatures, type FeatureMissingness } from './edgeFeatures';
import type { EdgeCohortConfig, EdgeMarketQuote, EdgeMatch } from './edgeTypes';

export const PINNACLE_CLOSING_COHORT: EdgeCohortConfig = {
  id: 'pinnacle_closing',
  description: 'Genuine Pinnacle closing AH quotes (EPL 2019-20..2025-26 + La Liga 2019-20)',
  ahBookmakerLabel: 'pinnacle',
  ahObservation: 'closing',
  ahRequiredProvenance: 'pinnacle',
  mlBookmakerLabel: 'pinnacle',
  mlObservation: 'closing',
  ouBookmakerLabel: 'pinnacle',
  ouObservation: 'closing',
};

export const PINNACLE_OPENING_COHORT: EdgeCohortConfig = {
  id: 'pinnacle_opening',
  description: 'Genuine Pinnacle opening AH quotes (EPL 2019-20..2025-26 + La Liga 2019-20)',
  ahBookmakerLabel: 'pinnacle',
  ahObservation: 'opening',
  ahRequiredProvenance: 'pinnacle',
  mlBookmakerLabel: 'pinnacle',
  mlObservation: 'opening',
  ouBookmakerLabel: 'pinnacle',
  ouObservation: 'opening',
};

export const BETBRAIN_CONSENSUS_COHORT: EdgeCohortConfig = {
  id: 'betbrain_single',
  description: 'BetBrain consensus aggregate AH quotes (top-5 leagues 2015-16..2019-20)',
  ahBookmakerLabel: 'betbrain',
  ahObservation: 'opening',
  ahRequiredProvenance: 'betbrain_avg',
  mlBookmakerLabel: 'pinnacle',
  mlObservation: 'closing',
  ouBookmakerLabel: 'pinnacle',
  ouObservation: 'closing',
};

export interface EdgeCoverage {
  canonicalMatches: number;
  eligibleMatches: number;
  withMlClosing: number;
  withMlOpening: number;
  withOuClosing: number;
  withAhOpening: number;
  seasons: string[];
  leagues: string[];
}

export interface EdgeDataset {
  cohort: EdgeCohortConfig;
  matches: EdgeMatch[];
  coverage: EdgeCoverage;
  missingness: FeatureMissingness;
}

function oddsKey(row: MarketOddsRecord): string {
  return `${row.canonicalId}|${row.market}|${row.observation}|${row.bookmakerSource}`;
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

function quoteOf(row: MarketOddsRecord): EdgeMarketQuote {
  return { line: row.line as number, homeOdds: row.homeOdds as number, awayOdds: row.awayOdds as number };
}

export function buildEdgeDataset(
  config: EdgeCohortConfig,
  paths: AhDataPaths = DEFAULT_AH_DATA_PATHS
): EdgeDataset {
  const canonical = loadCanonicalMatches(paths.canonicalMatches).filter((m) => m.resultVerified);
  const oddsRows = loadMarketOdds(paths.marketOdds);
  const resolver = createProvenanceResolver();

  const index = new Map<string, MarketOddsRecord>();
  for (const row of oddsRows) index.set(oddsKey(row), row);

  const get = (canonicalId: string, market: string, observation: string, bookmaker: string) =>
    index.get(`${canonicalId}|${market}|${observation}|${bookmaker}`);

  const matches: EdgeMatch[] = [];
  const coverage: EdgeCoverage = {
    canonicalMatches: canonical.length,
    eligibleMatches: 0,
    withMlClosing: 0,
    withMlOpening: 0,
    withOuClosing: 0,
    withAhOpening: 0,
    seasons: [],
    leagues: [],
  };

  for (const m of canonical) {
    const ah = get(m.canonicalId, 'AH', config.ahObservation, config.ahBookmakerLabel);
    if (!validQuote(ah)) continue;
    // True provenance check: never accept the legacy mislabeled rows.
    if (resolver.resolve(ah.sourceFile, ah.observation, ah.bookmakerSource) !== config.ahRequiredProvenance) {
      continue;
    }
    coverage.eligibleMatches += 1;

    // Movement uses the EARLIER snapshot only; when evaluating at opening there
    // is no earlier snapshot, so the field must stay null (no look-ahead).
    const ahOpen =
      config.ahObservation === 'closing'
        ? get(m.canonicalId, 'AH', 'opening', config.ahBookmakerLabel)
        : undefined;

    const mlClose = get(m.canonicalId, 'ML', config.mlObservation, config.mlBookmakerLabel);
    // Earlier snapshot only; never read a later market state.
    const mlOpen =
      config.mlObservation === 'closing' ? get(m.canonicalId, 'ML', 'opening', config.mlBookmakerLabel) : undefined;

    const ouClose = get(m.canonicalId, 'OU', config.ouObservation, config.ouBookmakerLabel);

    const parseMl = (row: MarketOddsRecord | undefined) => {
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
    };

    const mlClosing = parseMl(mlClose);
    const mlOpening = parseMl(mlOpen);
    if (mlClosing) coverage.withMlClosing += 1;
    if (mlOpening) coverage.withMlOpening += 1;

    let ouClosingOver25: number | null = null;
    if (ouClose && typeof ouClose.overOdds === 'number' && ouClose.overOdds > 1 && typeof ouClose.underOdds === 'number' && ouClose.underOdds > 1) {
      ouClosingOver25 = devigTwoWay(ouClose.overOdds, ouClose.underOdds).pA;
      coverage.withOuClosing += 1;
    }

    if (validQuote(ahOpen)) coverage.withAhOpening += 1;

    matches.push({
      canonicalId: m.canonicalId,
      leagueId: m.leagueId,
      season: m.season,
      matchDate: m.matchDate,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homeGoals: m.homeGoals,
      awayGoals: m.awayGoals,
      ah: quoteOf(ah),
      ahOpening: validQuote(ahOpen) ? quoteOf(ahOpen) : null,
      mlClosing,
      mlOpening,
      ouClosingOver25,
      features: {
        eloHome: 0,
        eloAway: 0,
        eloDiff: 0,
        homePpg5: 0,
        awayPpg5: 0,
        homeGf5: 0,
        homeGa5: 0,
        awayGf5: 0,
        awayGa5: 0,
        homeRestDays: 0,
        awayRestDays: 0,
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
      },
    });
  }

  matches.sort((a, b) => a.matchDate.localeCompare(b.matchDate) || a.canonicalId.localeCompare(b.canonicalId));

  const missingness = computePointInTimeFeatures(matches);

  coverage.seasons = Array.from(new Set(matches.map((m) => m.season))).sort();
  coverage.leagues = Array.from(new Set(matches.map((m) => m.leagueId))).sort();

  return { cohort: config, matches, coverage, missingness };
}
