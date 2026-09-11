// AH YIELD ENGINE — Orchestrator: runs the full validation from real data.
// No network, no synthetic inputs. Every number in the returned report is
// derived from the frozen canonical dataset + market_odds.jsonl.

import type { AhProvenance, AhSnapshot, AhYieldMetrics } from './ahTypes';
import { buildAhObservations, buildBestAvailableObservations } from './ahObservations';
import { createProvenanceResolver } from './ahProvenance';
import { loadAhRawData, type AhDataPaths } from './ahLoader';
import { buildAhDataQualityReport, type AhDataQualityReport } from './ahDataQuality';
import {
  breakdownAhMetrics,
  buildAhValueRows,
  type AhBreakdownDimension,
  type AhBreakdownRow,
  type AhValueRow,
} from './ahAggregation';
import { computeAhYieldMetrics, rankAhMetrics } from './ahYield';
import { runAhWalkForward, type AhWalkForwardReport } from './ahWalkForward';
import { runSettlementInvariants, type SettlementSelfCheck } from './ahSelfCheck';

export const AH_ENGINE_VERSION = 'ah-yield-v1';

export interface AhCohortKey {
  provenance: AhProvenance;
  snapshot: AhSnapshot;
}

export interface AhCohortReport {
  cohortKey: string;
  provenance: AhProvenance;
  snapshot: AhSnapshot;
  bets: number;
  matches: number;
  leagues: number;
  seasons: string[];
  sampleStart: string;
  sampleEnd: string;
  metrics: AhYieldMetrics;
  valueStateCounts: Record<string, number>;
  valueRows: AhValueRow[];
  breakdowns: Record<AhBreakdownDimension, AhBreakdownRow[]>;
}

export interface AhBestCard {
  name: string;
  available: boolean;
  reason?: string;
  pick?: {
    line: number;
    side: string;
    snapshot: string;
    provenance: string;
    evaluatedBets: number;
    sampleSizeStatus: string;
    yieldPct: number;
    roiCi95: [number, number];
    modelEvMean: number;
    modelProbability: number;
    fairOdds: number | null;
    valueState: string;
  };
}

export interface AhEngineValidationReport {
  generatedAt: string;
  engineVersion: string;
  datasetPaths: { canonicalMatches: string; marketOdds: string };
  datasetVersion: { canonicalMatches: number; oddsRows: number; ahOddsRows: number };
  methodology: Record<string, string>;
  settlementSelfCheck: SettlementSelfCheck;
  dataQuality: AhDataQualityReport;
  cohorts: AhCohortReport[];
  headlineCohortKey: string;
  headlineSelectionReason: string;
  bestCards: AhBestCard[];
  walkForward: Record<string, AhWalkForwardReport | { skipped: string }>;
  limitations: string[];
}

export interface AhEngineOptions {
  dataPaths?: AhDataPaths;
  bootstrapIterations?: number;
  walkForwardEvThreshold?: number;
  walkForwardMinTrainSeasons?: number;
}

const BREAKDOWN_DIMENSIONS: AhBreakdownDimension[] = [
  'league',
  'season',
  'favoriteStatus',
  'side',
  'line',
  'snapshot',
  'provenance',
];

function cohortKeyOf(provenance: AhProvenance, snapshot: AhSnapshot): string {
  return `${provenance}|${snapshot}`;
}

function pickBest(
  rows: AhValueRow[],
  name: string,
  selector: (rows: AhValueRow[]) => AhValueRow | null
): AhBestCard {
  const eligible = rows.filter((r) => r.eligibleForBest);
  if (eligible.length === 0) {
    return {
      name,
      available: false,
      reason: 'NO ELIGIBLE SAMPLE — minimum 30 evaluated bets required',
    };
  }
  const pick = selector(eligible);
  if (!pick) return { name, available: false, reason: 'NO ELIGIBLE SAMPLE' };
  return {
    name,
    available: true,
    pick: {
      line: pick.line,
      side: pick.side,
      snapshot: pick.snapshot,
      provenance: pick.provenance,
      evaluatedBets: pick.evaluatedBets,
      sampleSizeStatus: pick.sampleSizeStatus,
      yieldPct: pick.yieldPct,
      roiCi95: pick.roiCi95,
      modelEvMean: pick.modelEvMean,
      modelProbability: pick.modelProbability,
      fairOdds: pick.fairOdds,
      valueState: pick.valueState,
    },
  };
}

export function runAhYieldValidation(options: AhEngineOptions = {}): AhEngineValidationReport {
  const bootstrapIterations = options.bootstrapIterations ?? 1000;
  const resolver = createProvenanceResolver();
  const { matches, odds } = loadAhRawData(options.dataPaths);
  const build = buildAhObservations(matches, odds, { resolver });
  const bestAvailable = buildBestAvailableObservations(build.observations);
  const allObservations = [...build.observations, ...bestAvailable];
  const quality = buildAhDataQualityReport({
    matches,
    oddsRows: odds,
    build,
    layouts: resolver.listLayouts(),
  });

  const cohortKeys = new Map<string, AhCohortKey>();
  for (const o of allObservations) {
    cohortKeys.set(cohortKeyOf(o.provenance, o.snapshot), { provenance: o.provenance, snapshot: o.snapshot });
  }

  const cohorts: AhCohortReport[] = [];
  for (const [cohortKey, key] of Array.from(cohortKeys.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    const cohortObs = allObservations.filter(
      (o) => o.provenance === key.provenance && o.snapshot === key.snapshot
    );
    if (cohortObs.length === 0) continue;

    const metrics = computeAhYieldMetrics(cohortObs, { iterations: bootstrapIterations });
    const valueRows = buildAhValueRows(cohortObs, { iterations: bootstrapIterations });
    const valueStateCounts: Record<string, number> = {};
    for (const row of valueRows) {
      valueStateCounts[row.valueState] = (valueStateCounts[row.valueState] ?? 0) + 1;
    }

    const breakdowns = {} as Record<AhBreakdownDimension, AhBreakdownRow[]>;
    for (const dim of BREAKDOWN_DIMENSIONS) {
      breakdowns[dim] = breakdownAhMetrics(cohortObs, dim, { iterations: 100 });
    }

    const seasons = Array.from(new Set(cohortObs.map((o) => o.season))).sort();
    cohorts.push({
      cohortKey,
      provenance: key.provenance,
      snapshot: key.snapshot,
      bets: cohortObs.length,
      matches: new Set(cohortObs.map((o) => o.canonicalMatchId)).size,
      leagues: new Set(cohortObs.map((o) => o.leagueId)).size,
      seasons,
      sampleStart: metrics.sampleStart,
      sampleEnd: metrics.sampleEnd,
      metrics,
      valueStateCounts,
      valueRows,
      breakdowns,
    });
  }

  const pinnedKey = 'pinnacle|closing';
  const pinned = cohorts.find((c) => c.cohortKey === pinnedKey);
  let headline: AhCohortReport | undefined = pinned;
  let headlineSelectionReason = 'Pinned headline cohort: genuine Pinnacle closing odds.';
  if (!headline) {
    const genuine = cohorts.filter((c) => c.snapshot === 'opening' || c.snapshot === 'closing');
    headline = (genuine.length > 0 ? genuine : cohorts).sort((a, b) => b.metrics.evaluatedBets - a.metrics.evaluatedBets)[0];
    headlineSelectionReason = 'Pinned cohort absent — largest genuine-snapshot cohort selected explicitly.';
  }

  const bestCards: AhBestCard[] = [];
  if (headline) {
    bestCards.push(
      pickBest(headline.valueRows, 'BEST VALUE', (rows) => rankAhMetrics(rows, 'value')[0] ?? null),
      pickBest(headline.valueRows, 'BEST HISTORICAL ROI', (rows) => rankAhMetrics(rows, 'roi')[0] ?? null),
      pickBest(headline.valueRows, 'HIGHEST PROBABILITY', (rows) => rankAhMetrics(rows, 'probability')[0] ?? null),
      pickBest(headline.valueRows, 'LARGEST SAMPLE', (rows) => rankAhMetrics(rows, 'sample')[0] ?? null),
      pickBest(
        headline.valueRows,
        'MOST CONSISTENT',
        (rows) =>
          [...rows].sort(
            (a, b) =>
              b.probabilityOfPositiveRoi - a.probabilityOfPositiveRoi ||
              a.returnStdDev - b.returnStdDev ||
              b.evaluatedBets - a.evaluatedBets
          )[0] ?? null
      )
    );
  }

  const walkForward: Record<string, AhWalkForwardReport | { skipped: string }> = {};
  for (const cohort of cohorts) {
    if (cohort.seasons.length < 3) {
      walkForward[cohort.cohortKey] = {
        skipped: `INSUFFICIENT_SEASONS (${cohort.seasons.length}) — walk-forward requires at least 3 season keys`,
      };
      continue;
    }
    walkForward[cohort.cohortKey] = runAhWalkForward(allObservations, {
      snapshot: cohort.snapshot,
      provenance: cohort.provenance,
      minTrainSeasons: options.walkForwardMinTrainSeasons ?? 2,
      evThreshold: options.walkForwardEvThreshold ?? 0,
    });
  }

  const insufficientLines = headline
    ? headline.valueRows.filter((r) => r.sampleSizeStatus === 'INSUFFICIENT_SAMPLE').length
    : 0;

  const limitations: string[] = [
    'No odds timestamps exist in market_odds.jsonl (only match_date plus opening/closing/single_quote labels); T-24h/T-6h/T-1h snapshots are DATA NOT AVAILABLE.',
    'BetBrain aggregate columns (2015-16..2018-19 sources) were emitted twice by the legacy ingestion (labeled pinnacle and betbrain). The engine resolves true provenance from source headers and collapses the duplicate, but the raw dataset still contains the mislabeled rows.',
    'BetBrain quotes are consensus averages (BbAvAHH/BbAvAHA), not a single bookmaker; they are reported as a separate cohort and never mixed with Pinnacle/Bet365.',
    'Only football-data.co.uk closing/opening columns are available; exchange prices and in-play prices are DATA NOT AVAILABLE.',
    'best_available requires two genuine books quoting the same match/line/snapshot (Pinnacle + Bet365, 2019-20 onward); earlier eras cannot support a best-price methodology and are excluded from that cohort.',
    `Headline cohort contains ${insufficientLines} line/side groups below the 30-bet minimum sample; those are never ranked or promoted.`,
    'Model EV and fair odds in the value table use the pooled (in-sample) posterior for that line/side; only the walk-forward section is out-of-sample.',
  ];
  if (quality.integrityFlags.some((f) => f.startsWith('PROVENANCE_MISLABEL_DETECTED'))) {
    limitations.push('PROVENANCE_MISLABEL_DETECTED: legacy bookmaker_source labels are not trustworthy for pre-2019 sources.');
  }

  return {
    generatedAt: new Date().toISOString(),
    engineVersion: AH_ENGINE_VERSION,
    datasetPaths: {
      canonicalMatches: options.dataPaths?.canonicalMatches ?? 'data/golden/europe/canonical_matches.jsonl',
      marketOdds: options.dataPaths?.marketOdds ?? 'data/golden/europe/market_odds.jsonl',
    },
    datasetVersion: {
      canonicalMatches: matches.length,
      oddsRows: odds.length,
      ahOddsRows: odds.filter((o) => o.market === 'AH').length,
    },
    methodology: {
      stake: 'Normalized 1.0 unit per bet. VOID bets are returned flat and excluded from ROI denominators.',
      yield: 'ROI = Σpnl / Σstake (fraction); Yield% = ROI × 100. Hit rate is reported separately and is never labeled ROI.',
      settlement:
        'Quarter lines split the stake evenly across the two adjacent half-lines; P&L: FULL_WIN +(o−1), HALF_WIN +0.5(o−1), PUSH 0, HALF_LOSS −0.5, FULL_LOSS −1.',
      probability:
        'Dirichlet-multinomial posterior over the 5 settlement categories with uniform prior α=(1,1,1,1,1); binary positive-return event uses Beta(1+wins, 1+losses) with pushes excluded. 95% marginal credible intervals reported.',
      fairOdds:
        'Settlement-aware fair odds solve EV(o*)=0: o* = 1 + (0.5·pHL + pFL) / (pFW + 0.5·pHW). Binary 1/p is NOT used for AH.',
      ev: 'EV(o) = (pFW + 0.5·pHW)(o−1) − (0.5·pHL + pFL). Edge = model EV − market implied EV from proportional two-way devig (documented binary approximation).',
      sampleSize: 'INSUFFICIENT <30, LOW 30-99, MODERATE 100-299, STRONG >=300 evaluated bets.',
      ranking: 'Default ranking uses the lower bound of the 95% ROI CI (sample-size protected); raw ROI ranking is available but never the default.',
      snapshots: 'Opening and closing are computed as separate cohorts; single_quote (BetBrain) is never treated as opening or closing. Cohorts are never merged.',
      bestAvailable:
        'best_available = highest price across genuine Pinnacle/Bet365 quotes at the same match, line, snapshot and side (requires both books; 2019-20 onward). Reported as its own cohort, never blended with single-bookmaker results.',
      provenance:
        'True provenance resolved from the actual source CSV headers (AHh/PAHH vs BbAHh/BbAvAHH), not from the legacy bookmaker_source label.',
    },
    settlementSelfCheck: runSettlementInvariants(),
    dataQuality: quality,
    cohorts,
    headlineCohortKey: headline?.cohortKey ?? 'NONE',
    headlineSelectionReason,
    bestCards,
    walkForward,
    limitations,
  };
}
