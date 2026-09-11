// ============================================================================
// SHARP CONSENSUS ENGINE
// ============================================================================
// Implements the Sharp Market Reference Policy:
//   - S1 sources (Pinnacle, SBOBet, Betfair Exchange) carry more authority
//     than S2 sources (Singbet/IBC, Marathonbet).
//   - Sources are treated as distinct; no blind averaging.
//   - Every source is individually de-vigged through the canonical de-vig
//     layer (src/lib/settlement-core/devig.ts).
//   - Lines are never combined: AH -0.5, AH -0.75, OU 2.5 are separate books.
//   - Exchange prices are commission/spread/liquidity adjusted before use.
//   - Missing sources are reported, never fabricated.
//
// Weights come from sharpBooks config (SHARP_SOURCE_WEIGHTS) and are
// provisional until empirically evaluated on sufficient historical data.

import { removeVig, type DeVigMethod } from '@/lib/settlement-core/devig';
import {
  EXCHANGE_COMMISSION_DEFAULT,
  EXCHANGE_MIN_LIQUIDITY,
  EXCHANGE_WIDE_SPREAD_PCT,
  getSharpBookConfig,
  getSharpBookWeights,
  type SharpTier,
} from '@/lib/config/sharpBooks';
import type { MarketType } from '@/lib/data/providers/types';
import { deriveDataState, type DataState } from '@/lib/data/dataState';

export interface ExchangeQuoteMeta {
  back?: number | null;
  lay?: number | null;
  spread?: number | null;
  liquidity?: number | null;
  commission?: number | null;
}

export interface SharpQuote {
  source: string; // bookmaker slug / key
  market: MarketType;
  line: number;
  selection: string; // 'home' | 'away' | 'draw' | 'over' | 'under' | 'yes' | 'no'
  odds: number; // decimal odds (back price for exchanges)
  timestamp: string; // ISO 8601
  limit?: number | null; // available stake (liquidity proxy)
  exchange?: ExchangeQuoteMeta | null;
}

export interface SharpConsensusOptions {
  method?: DeVigMethod;
  now?: Date;
  maxQuoteAgeMs?: number;
  /** Dispersion (in probability points) at/below which quality can be HIGH. */
  highQualityDispersion?: number;
}

export interface SharpSourceContribution {
  source: string;
  tier: SharpTier;
  weight: number;
  overround: number | null;
  margin: number | null;
  fair: Record<string, number>;
  stale: boolean;
  exchangeAdjusted: boolean;
}

export type SourceQuality = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';

export interface SharpConsensusResult {
  market: MarketType;
  line: number;
  selections: string[];
  sharp_consensus_probability: Record<string, number>;
  sharp_consensus_fair_odds: Record<string, number>;
  market_dispersion: number | null;
  source_count: number;
  source_quality: SourceQuality;
  s1_available: number;
  s1_total: number;
  s2_available: number;
  s2_total: number;
  sources: SharpSourceContribution[];
  warnings: string[];
  timestamp: string;
  dataState: DataState;
}

export class SharpConsensusError extends Error {
  public readonly code: 'LINE_PRESERVATION_VIOLATION' | 'EMPTY_INPUT' | 'INCOMPLETE_BOOK';

  constructor(code: SharpConsensusError['code'], message: string) {
    super(message);
    this.name = 'SharpConsensusError';
    this.code = code;
  }
}

const DEFAULT_MAX_QUOTE_AGE_MS = 6 * 60 * 60 * 1000;

/**
 * Derive an exchange reference price that accounts for commission and, when
 * both sides are available, spread. Returns null when no usable price exists.
 *
 * Back at B: effective decimal odds = 1 + (B - 1) * (1 - commission).
 * Lay at L : back-equivalent = 1 + (L - 1) / (1 - commission).
 * Both     : midpoint of the two effective prices (spread accounted for).
 */
export function deriveExchangeReferencePrice(quote: SharpQuote): {
  price: number | null;
  adjusted: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const ex = quote.exchange ?? {};
  const commission = ex.commission ?? EXCHANGE_COMMISSION_DEFAULT;
  const back = ex.back ?? quote.odds;

  if (back == null || back <= 1) return { price: null, adjusted: false, warnings: ['EXCHANGE_NO_BACK_PRICE'] };

  const backEff = 1 + (back - 1) * (1 - commission);
  let price = backEff;
  let adjusted = commission > 0;

  if (ex.lay != null && ex.lay > 1) {
    const layBackEquivalent = 1 + (ex.lay - 1) / (1 - commission);
    price = (backEff + layBackEquivalent) / 2;
    adjusted = true;
    const spread = ex.spread ?? Math.abs(back - ex.lay);
    const spreadPct = back > 0 ? spread / back : 0;
    if (spreadPct > EXCHANGE_WIDE_SPREAD_PCT + 1e-9) {
      warnings.push('WIDE_EXCHANGE_SPREAD');
    }
  }

  if (ex.liquidity != null && ex.liquidity < EXCHANGE_MIN_LIQUIDITY) {
    warnings.push('THIN_EXCHANGE_LIQUIDITY');
  }

  return { price: price > 1 ? price : null, adjusted, warnings };
}

export class SharpConsensusEngine {
  /**
   * Compute a sharp consensus for one market + line from per-source quotes.
   * Throws LINE_PRESERVATION_VIOLATION if quotes span different lines.
   */
  static compute(quotes: SharpQuote[], options: SharpConsensusOptions = {}): SharpConsensusResult {
    const {
      method = 'proportional',
      now = new Date(),
      maxQuoteAgeMs = DEFAULT_MAX_QUOTE_AGE_MS,
      highQualityDispersion = 0.015,
    } = options;

    if (!quotes || quotes.length === 0) {
      throw new SharpConsensusError('EMPTY_INPUT', 'SharpConsensusEngine requires at least one quote');
    }

    const market = quotes[0].market;
    const line = quotes[0].line;

    // LINE PRESERVATION: never combine different lines/markets.
    for (const q of quotes) {
      if (q.market !== market || q.line !== line) {
        throw new SharpConsensusError(
          'LINE_PRESERVATION_VIOLATION',
          `Cannot combine quotes across markets/lines: expected ${market} ${line}, got ${q.market} ${q.line}`
        );
      }
    }

    const weights = getSharpBookWeights();
    const warnings: string[] = [];

    // Required selections = union of quoted selections for this book.
    const selections = Array.from(new Set(quotes.map((q) => q.selection))).sort();

    // Group by source, preserving only complete books.
    const bySource = new Map<string, SharpQuote[]>();
    for (const q of quotes) {
      const list = bySource.get(q.source) ?? [];
      list.push(q);
      bySource.set(q.source, list);
    }

    const contributions: SharpSourceContribution[] = [];
    let staleCount = 0;

    for (const [source, sourceQuotes] of bySource.entries()) {
      const config = getSharpBookConfig(source);
      const tier: SharpTier = config?.tier ?? 'S2';

      const missing = selections.filter((s) => !sourceQuotes.some((q) => q.selection === s));
      if (missing.length > 0) {
        warnings.push(`INCOMPLETE_BOOK:${source}`);
        continue;
      }

      const newest = sourceQuotes.reduce(
        (max, q) => Math.max(max, new Date(q.timestamp).getTime()),
        0
      );
      const stale = Number.isFinite(newest) ? now.getTime() - newest > maxQuoteAgeMs : true;
      if (stale) {
        staleCount += 1;
        warnings.push(`STALE_SOURCE:${source}`);
        continue; // stale sources are excluded, not silently blended
      }

      const oddsMap: Record<string, number> = {};
      let exchangeAdjusted = false;
      let exchangeLiquidityFactor = 1;

      for (const q of sourceQuotes) {
        if (config?.isExchange) {
          const derived = deriveExchangeReferencePrice(q);
          for (const w of derived.warnings) warnings.push(`${w}:${source}`);
          if (derived.price == null) {
            exchangeLiquidityFactor = 0;
            break;
          }
          oddsMap[q.selection] = derived.price;
          exchangeAdjusted = derived.adjusted;
          if (q.exchange?.liquidity != null) {
            exchangeLiquidityFactor = Math.min(
              1,
              Math.max(0.25, q.exchange.liquidity / (2 * EXCHANGE_MIN_LIQUIDITY))
            );
          } else {
            exchangeLiquidityFactor = 0.5; // unknown liquidity → downweight
          }
        } else {
          oddsMap[q.selection] = q.odds;
        }
      }

      if (exchangeLiquidityFactor === 0) {
        warnings.push(`UNUSABLE_EXCHANGE_PRICE:${source}`);
        continue;
      }

      const devig = removeVig(oddsMap, method);
      const baseWeight = weights[source] ?? 0.25;
      const weight = baseWeight * exchangeLiquidityFactor;
      if (weight <= 0) continue;

      contributions.push({
        source,
        tier,
        weight,
        overround: devig.overround,
        margin: devig.margin,
        fair: devig.fair,
        stale: false,
        exchangeAdjusted,
      });
    }

    const s1Total = quotes.length > 0 ? countTierSources(bySource.keys(), 'S1') : 0;
    const s2Total = countTierSources(bySource.keys(), 'S2');
    const s1Available = countTierSources(contributions.map((c) => c.source), 'S1');
    const s2Available = countTierSources(contributions.map((c) => c.source), 'S2');

    if (contributions.length === 0) {
      const timestamp = now.toISOString();
      return {
        market,
        line,
        selections,
        sharp_consensus_probability: {},
        sharp_consensus_fair_odds: {},
        market_dispersion: null,
        source_count: 0,
        source_quality: 'INSUFFICIENT_DATA',
        s1_available: 0,
        s1_total: s1Total,
        s2_available: 0,
        s2_total: s2Total,
        sources: [],
        warnings: Array.from(new Set([...warnings, 'NO_USABLE_SOURCES'])),
        timestamp,
        dataState: 'INSUFFICIENT_DATA',
      };
    }

    // Weighted consensus per selection.
    const totalWeight = contributions.reduce((acc, c) => acc + c.weight, 0);
    const consensusRaw: Record<string, number> = {};
    for (const selection of selections) {
      const weighted = contributions.reduce(
        (acc, c) => acc + (c.fair[selection] ?? 0) * c.weight,
        0
      );
      consensusRaw[selection] = totalWeight > 0 ? weighted / totalWeight : 0;
    }

    const sum = Object.values(consensusRaw).reduce((a, b) => a + b, 0);
    const consensus: Record<string, number> = {};
    for (const [k, v] of Object.entries(consensusRaw)) {
      consensus[k] = sum > 0 ? v / sum : 0;
    }

    // Market dispersion: weighted std-dev of source fair probabilities,
    // averaged across selections.
    const dispersions: number[] = [];
    for (const selection of selections) {
      let variance = 0;
      for (const c of contributions) {
        const diff = (c.fair[selection] ?? 0) - consensus[selection];
        variance += c.weight * diff * diff;
      }
      dispersions.push(totalWeight > 0 ? Math.sqrt(variance / totalWeight) : 0);
    }
    const dispersion =
      dispersions.length > 0 ? dispersions.reduce((a, b) => a + b, 0) / dispersions.length : null;

    if (s1Available === 0) warnings.push('NO_S1_SOURCES');
    if (s1Available === 1) warnings.push('LOW_SOURCE_DIVERSITY');
    if (staleCount > 0) warnings.push('STALE_QUOTES_EXCLUDED');

    let sourceQuality: SourceQuality;
    if (s1Available >= 2 && dispersion !== null && dispersion <= highQualityDispersion) {
      sourceQuality = 'HIGH';
    } else if (s1Available >= 2) {
      sourceQuality = 'MEDIUM';
    } else {
      sourceQuality = 'LOW';
    }

    const fairOdds: Record<string, number> = {};
    for (const [k, p] of Object.entries(consensus)) {
      fairOdds[k] = p > 0 ? Number((1 / p).toFixed(4)) : Number.NaN;
    }

    const dataState = deriveDataState({
      hasData: true,
      sampleSize: contributions.length,
      minSample: 2,
      ageMs: staleCount > 0 ? maxQuoteAgeMs + 1 : 0,
      maxAgeMs: maxQuoteAgeMs,
    });

    return {
      market,
      line,
      selections,
      sharp_consensus_probability: consensus,
      sharp_consensus_fair_odds: fairOdds,
      market_dispersion: dispersion === null ? null : Number(dispersion.toFixed(6)),
      source_count: contributions.length,
      source_quality: sourceQuality,
      s1_available: s1Available,
      s1_total: s1Total,
      s2_available: s2Available,
      s2_total: s2Total,
      sources: contributions,
      warnings: Array.from(new Set(warnings)),
      timestamp: now.toISOString(),
      dataState,
    };
  }
}

function countTierSources(sources: Iterable<string>, tier: SharpTier): number {
  let count = 0;
  for (const source of sources) {
    if ((getSharpBookConfig(source)?.tier ?? 'S2') === tier) count += 1;
  }
  return count;
}

export interface ModelConsensusComparison {
  modelProbability: number;
  sharpConsensusProbability: number;
  differencePp: number;
  direction: 'MODEL_HIGHER' | 'MODEL_LOWER' | 'ALIGNED';
}

export function compareModelToConsensus(
  modelProbability: number,
  sharpConsensusProbability: number,
  alignedThresholdPp = 0.5
): ModelConsensusComparison {
  const differencePp = (modelProbability - sharpConsensusProbability) * 100;
  // Round before comparing to avoid floating-point boundary artifacts.
  const rounded = Number(differencePp.toFixed(6));
  let direction: ModelConsensusComparison['direction'] = 'ALIGNED';
  if (rounded > alignedThresholdPp) direction = 'MODEL_HIGHER';
  else if (rounded < -alignedThresholdPp) direction = 'MODEL_LOWER';
  return { modelProbability, sharpConsensusProbability, differencePp, direction };
}

export interface RetailDivergence {
  retailImpliedProbability: number | null;
  sharpConsensusProbability: number | null;
  divergencePp: number | null;
  classification: 'MODEL_EDGE' | 'PRICE_DIVERGENCE' | 'ALIGNED' | 'INSUFFICIENT_DATA';
}

/**
 * Retail price vs sharp reference. A divergence is NOT automatically an
 * opportunity — it is classified, never promoted.
 */
export function computeRetailDivergence(
  retailOdds: number | null | undefined,
  consensusProbability: number | null | undefined,
  divergenceThresholdPp = 2
): RetailDivergence {
  if (!retailOdds || retailOdds <= 1 || consensusProbability == null) {
    return {
      retailImpliedProbability: null,
      sharpConsensusProbability: null,
      divergencePp: null,
      classification: 'INSUFFICIENT_DATA',
    };
  }
  const implied = 1 / retailOdds;
  const divergencePp = (implied - consensusProbability) * 100;
  let classification: RetailDivergence['classification'] = 'ALIGNED';
  if (divergencePp > divergenceThresholdPp) classification = 'PRICE_DIVERGENCE';
  else if (divergencePp < -divergenceThresholdPp) classification = 'MODEL_EDGE';
  return {
    retailImpliedProbability: implied,
    sharpConsensusProbability: consensusProbability,
    divergencePp,
    classification,
  };
}
