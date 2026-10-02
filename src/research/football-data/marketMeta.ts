// ============================================================================
// RESEARCH MARKET METADATA — line/snapshot typing + de-vigged implied prices
// ============================================================================
// Location: src/research/football-data/marketMeta.ts
//
// RESEARCH-ONLY. Turns the frozen gold market layer into an analysis-ready
// research table WITHOUT touching `data/golden/europe/`:
//   • explicit `line_type` (whole / half / quarter) and `snapshot` columns
//   • normalised `provenance` (never a mislabeled aggregate)
//   • `clv_eligible` — a veto computed from the real source era (finding D5)
//   • market margin (`raw_overround`) and de-vigged implied probabilities
//
// De-vigging reuses the existing DeVigEngine (src/lib/research/probability/deVig.ts);
// no probability math is re-implemented here.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { DeVigEngine } from '../../lib/research/probability/deVig';
import { researchFile } from './researchPaths';
import {
  classifyAhLine,
  classifyOuLine,
  eraOfSeasonMap,
  erasWhereTradeable,
  forEachGoldOddsRow,
  normalizeProvenance,
  type GoldOddsRow,
} from './sourceReality';
import type { LineType, PriceProvenance, ResearchMarketCode, SnapshotCode, SourceEra } from './types';

export const MARKET_META_VERSION = 'fd-research-market-meta-v1';

export interface ResearchOddsRecord {
  odds_id: string;
  canonical_id: string;
  league_id: string;
  season: string;
  match_date: string;
  market: ResearchMarketCode;
  snapshot: SnapshotCode;
  line: number | null;
  line_type: LineType;
  provenance: PriceProvenance;
  /**
   * TRUE only when this price is a genuine, tradeable, era-consistent bookmaker
   * price. Aggregates and era-impossible attributions are vetoed so CLV can
   * never be computed against a fake Pinnacle number (finding D5).
   */
  clv_eligible: boolean;
  /** Why a row was vetoed — empty string when eligible. */
  veto_reason: string;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  over_odds: number | null;
  under_odds: number | null;
  /** Bookmaker margin of the observation (e.g. 0.0245 → 102.45% book). */
  raw_overround: number | null;
  devig_method: 'PROPORTIONAL' | 'POWER' | 'SHIN' | null;
  implied_prob_home: number | null;
  implied_prob_draw: number | null;
  implied_prob_away: number | null;
  implied_prob_over: number | null;
  implied_prob_under: number | null;
  /** Fair (margin-free) decimal odds, the basis for edge/EV. */
  fair_odds_home: number | null;
  fair_odds_draw: number | null;
  fair_odds_away: number | null;
  fair_odds_over: number | null;
  fair_odds_under: number | null;
}

export interface MarketMetaSummary {
  generated_at: string;
  version: string;
  rows: number;
  /** Rows safe for CLV/edge work. */
  clv_eligible_rows: number;
  vetoed_rows: number;
  vetoReasons: Array<{ reason: string; rows: number }>;
  byMarket: Array<{
    market: ResearchMarketCode;
    snapshot: SnapshotCode;
    rows: number;
    clv_eligible: number;
    meanOverround: number | null;
  }>;
  byLineType: Array<{ lineType: LineType; rows: number }>;
  meanOverroundByMarket: Array<{ market: ResearchMarketCode; snapshot: SnapshotCode; meanOverround: number }>;
  notes: string[];
}

interface OddsRowShape {
  odds_id: string;
  canonical_id: string;
  league_id: string;
  season: string;
  match_date: string;
  market: ResearchMarketCode;
  observation: SnapshotCode;
  bookmaker_source: string;
  line: number | null;
  home_odds: number | null;
  draw_odds: number | null;
  away_odds: number | null;
  over_odds: number | null;
  under_odds: number | null;
}

/** Why a row was vetoed for CLV purposes — empty when eligible. */
export const VETO = {
  AGGREGATE: 'AGGREGATE_PRICE',
  UNKNOWN: 'UNKNOWN_PROVENANCE',
  ERA: 'ERA_IMPOSSIBLE_PROVENANCE',
  NO_LINE: 'MISSING_LINE',
  UNPRICEABLE: 'UNPRICEABLE_ODDS',
} as const;

/** Enrich one gold odds row into an analysis-ready research record. */
export function enrichOddsRow(row: GoldOddsRow, eraOfSeason: Map<string, SourceEra>): ResearchOddsRecord {
  const provenance = normalizeProvenance(row.bookmaker_source);
  const snapshot = row.observation;
  const market = row.market;
  const season = String(row.season);
  const era = eraOfSeason.get(season) ?? null;

  const lineType: LineType =
    market === 'ML' ? 'ML' : market === 'AH' ? classifyAhLine(row.line ?? 0) : classifyOuLine(row.line ?? 0);

  // ── CLV eligibility veto (finding D5) ────────────────────────────────────
  let clvEligible = true;
  let vetoReason = '';
  if (provenance === 'betbrain_average') {
    clvEligible = false;
    vetoReason = VETO.AGGREGATE;
  } else if (provenance === 'unknown') {
    clvEligible = false;
    vetoReason = VETO.UNKNOWN;
  } else if (era && !erasWhereTradeable(market, snapshot, provenance).includes(era)) {
    clvEligible = false;
    vetoReason = VETO.ERA;
  } else if (market !== 'ML' && row.line === null) {
    clvEligible = false;
    vetoReason = VETO.NO_LINE;
  }

  const rec: ResearchOddsRecord = {
    odds_id: row.odds_id,
    canonical_id: row.canonical_id,
    league_id: row.league_id,
    season,
    match_date: row.match_date,
    market,
    snapshot,
    line: row.line,
    line_type: lineType,
    provenance,
    clv_eligible: clvEligible,
    veto_reason: vetoReason,
    home_odds: row.home_odds,
    draw_odds: row.draw_odds,
    away_odds: row.away_odds,
    over_odds: row.over_odds,
    under_odds: row.under_odds,
    raw_overround: null,
    devig_method: null,
    implied_prob_home: null,
    implied_prob_draw: null,
    implied_prob_away: null,
    implied_prob_over: null,
    implied_prob_under: null,
    fair_odds_home: null,
    fair_odds_draw: null,
    fair_odds_away: null,
    fair_odds_over: null,
    fair_odds_under: null,
  };

  // ── De-vig (reuses DeVigEngine; probability math is never re-implemented) ─
  try {
    if (market === 'ML' && row.home_odds && row.draw_odds && row.away_odds) {
      const r = DeVigEngine.deVigThreeWay(row.home_odds, row.draw_odds, row.away_odds, true);
      rec.raw_overround = r.rawOverround;
      rec.devig_method = r.method;
      rec.implied_prob_home = r.impliedProbHome;
      rec.implied_prob_draw = r.impliedProbDraw;
      rec.implied_prob_away = r.impliedProbAway;
      rec.fair_odds_home = r.fairOddsHome;
      rec.fair_odds_draw = r.fairOddsDraw;
      rec.fair_odds_away = r.fairOddsAway;
    } else if (market === 'OU' && row.over_odds && row.under_odds) {
      const r = DeVigEngine.deVigTwoWay(row.over_odds, row.under_odds, 'PROPORTIONAL');
      rec.raw_overround = r.rawOverround;
      rec.devig_method = r.method;
      rec.implied_prob_over = r.impliedProbA;
      rec.implied_prob_under = r.impliedProbB;
      rec.fair_odds_over = r.fairOddsA;
      rec.fair_odds_under = r.fairOddsB;
    } else if (market === 'AH' && row.home_odds && row.away_odds) {
      const r = DeVigEngine.deVigTwoWay(row.home_odds, row.away_odds, 'PROPORTIONAL');
      rec.raw_overround = r.rawOverround;
      rec.devig_method = r.method;
      rec.implied_prob_home = r.impliedProbA;
      rec.implied_prob_away = r.impliedProbB;
      rec.fair_odds_home = r.fairOddsA;
      rec.fair_odds_away = r.fairOddsB;
    }
  } catch {
    // Partial/absurd source price: keep the row (observations are preserved
    // verbatim) but mark it unpriceable so it can never enter EV/CLV math.
    rec.clv_eligible = false;
    rec.veto_reason = rec.veto_reason || VETO.UNPRICEABLE;
  }

  return rec;
}

export interface BuildMarketMetaOptions {
  /** Persist artifacts into the isolated research namespace. Default true. */
  write?: boolean;
  /** Include CLV-vetoed rows in the emitted records. Default true (full audit trail). */
  includeIneligible?: boolean;
  /** Output directory override (must be inside the research root). Default research root. */
  outputDir?: string;
}

export interface MarketMetaResult {
  records: ResearchOddsRecord[];
  summary: MarketMetaSummary;
}

/** Build the research market-metadata table from the frozen gold odds layer. */
export async function buildResearchMarketMeta(
  options: BuildMarketMetaOptions = {}
): Promise<MarketMetaResult> {
  const eraOfSeason = eraOfSeasonMap();
  const includeIneligible = options.includeIneligible !== false;

  const all: ResearchOddsRecord[] = [];
  const byKey = new Map<string, { rows: number; eligible: number; overroundSum: number; priced: number }>();
  const byLineType = new Map<string, number>();
  const vetoReasons = new Map<string, number>();
  let vetoed = 0;

  await forEachGoldOddsRow((row) => {
    const rec = enrichOddsRow(row, eraOfSeason);
    if (!rec.clv_eligible) {
      vetoed++;
      const reason = rec.veto_reason || 'UNSPECIFIED';
      vetoReasons.set(reason, (vetoReasons.get(reason) ?? 0) + 1);
    }
    byLineType.set(rec.line_type, (byLineType.get(rec.line_type) ?? 0) + 1);

    const key = `${rec.market}|${rec.snapshot}`;
    const agg = byKey.get(key) ?? { rows: 0, eligible: 0, overroundSum: 0, priced: 0 };
    agg.rows++;
    if (rec.clv_eligible) agg.eligible++;
    if (rec.raw_overround !== null) {
      agg.overroundSum += rec.raw_overround;
      agg.priced++;
    }
    byKey.set(key, agg);

    if (includeIneligible || rec.clv_eligible) all.push(rec);
  });

  const byMarket = [...byKey.entries()]
    .map(([key, v]) => {
      const [market, snapshot] = key.split('|');
      return {
        market: market as ResearchMarketCode,
        snapshot: snapshot as SnapshotCode,
        rows: v.rows,
        clv_eligible: v.eligible,
        meanOverround: v.priced > 0 ? Number((v.overroundSum / v.priced).toFixed(5)) : null,
      };
    })
    .sort((a, b) => a.market.localeCompare(b.market) || a.snapshot.localeCompare(b.snapshot));

  const summary: MarketMetaSummary = {
    generated_at: new Date().toISOString(),
    version: MARKET_META_VERSION,
    rows: all.length,
    clv_eligible_rows: all.filter((r) => r.clv_eligible).length,
    vetoed_rows: vetoed,
    vetoReasons: [...vetoReasons.entries()]
      .map(([reason, rows]) => ({ reason, rows }))
      .sort((a, b) => b.rows - a.rows),
    byMarket,
    byLineType: [...byLineType.entries()]
      .map(([lineType, rows]) => ({ lineType: lineType as LineType, rows }))
      .sort((a, b) => b.rows - a.rows),
    meanOverroundByMarket: byMarket
      .filter((m) => m.meanOverround !== null)
      .map((m) => ({ market: m.market, snapshot: m.snapshot, meanOverround: m.meanOverround as number })),
    notes: [
      'raw_overround is the bookmaker margin of the observation; fair_odds_* are margin-free.',
      'ML uses Shin (1993) with proportional fallback; AH/OU use proportional two-way de-vig.',
      'clv_eligible=false rows are preserved but MUST NOT enter CLV/EV aggregation (finding D5).',
      'Only two snapshots exist in the source: opening and closing. No T-minus horizon grid.',
    ],
  };

  if (options.write !== false) writeMarketMetaArtifacts(all, summary, options.outputDir);
  return { records: all, summary };
}

/** Serialise the research marketplace artifacts (research namespace only). */
export function writeMarketMetaArtifacts(
  records: ResearchOddsRecord[],
  summary: MarketMetaSummary,
  outputDir?: string
): { jsonl: string; summaryJson: string } {
  const dir = outputDir ?? path.dirname(researchFile('MARKET_METADATA.jsonl'));
  fs.mkdirSync(dir, { recursive: true });
  const jsonl = path.join(dir, 'MARKET_METADATA.jsonl');
  const summaryJson = path.join(dir, 'MARKET_METADATA_SUMMARY.json');
  fs.writeFileSync(jsonl, records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''), 'utf-8');
  fs.writeFileSync(summaryJson, JSON.stringify(summary, null, 2), 'utf-8');
  return { jsonl, summaryJson };
}
