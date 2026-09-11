// SHARP MARKET REFERENCE POLICY — Source configuration
//
// S1 (primary):   Pinnacle, SBOBet, Betfair Exchange
// S2 (secondary): Singbet / IBC, Marathonbet
//
// Sources are treated as distinct. Weights are CONFIGURABLE (env JSON) and are
// provisional defaults only — they must be empirically evaluated once enough
// historical data exists. Never hardcode permanent weights in query logic.

export type SharpTier = 'S1' | 'S2';

export interface SharpBookConfig {
  key: string; // OddsPapi bookmaker slug (resolved live from /v4/bookmakers)
  title: string;
  enabled: boolean;
  tier: SharpTier;
  /** Provisional weight (configurable via SHARP_SOURCE_WEIGHTS). */
  weight: number;
  /** Exchange books require commission/spread/liquidity handling. */
  isExchange?: boolean;
  note?: string;
}

export const SHARP_BOOKS: SharpBookConfig[] = [
  // S1 — primary sharp reference
  { key: 'pinnacle',      title: 'Pinnacle',          enabled: true,  tier: 'S1', weight: 1.0 },
  { key: 'sbobet',        title: 'SBOBet',            enabled: true,  tier: 'S1', weight: 0.8 },
  { key: 'betfair_ex_eu', title: 'Betfair Exchange',  enabled: true,  tier: 'S1', weight: 0.8, isExchange: true },
  // S2 — secondary reference
  { key: 'singbet',       title: 'Singbet / IBC',     enabled: true,  tier: 'S2', weight: 0.5 },
  { key: 'marathonbet',   title: 'Marathonbet',       enabled: true,  tier: 'S2', weight: 0.4 },
  // Inactive (retained for future expansion, not removed)
  { key: 'circa',         title: 'Circa Sports',      enabled: false, tier: 'S2', weight: 0.5, note: 'Flag inactive — enable for NBA/Tennis' },
];

/** Provisional exchange assumptions (configurable). */
export const EXCHANGE_COMMISSION_DEFAULT = Number(process.env.SHARP_EXCHANGE_COMMISSION ?? '0.02');
export const EXCHANGE_MIN_LIQUIDITY = Number(process.env.SHARP_EXCHANGE_MIN_LIQUIDITY ?? '100');
/** Spread above this fraction of price is flagged as wide. */
export const EXCHANGE_WIDE_SPREAD_PCT = Number(process.env.SHARP_EXCHANGE_WIDE_SPREAD_PCT ?? '0.05');

/**
 * Effective per-source weights. Override with SHARP_SOURCE_WEIGHTS as JSON,
 * e.g. SHARP_SOURCE_WEIGHTS='{"pinnacle":1,"sbobet":0.7}'.
 */
export function getSharpBookWeights(): Record<string, number> {
  const weights: Record<string, number> = {};
  for (const book of SHARP_BOOKS) weights[book.key] = book.weight;

  const raw = process.env.SHARP_SOURCE_WEIGHTS;
  if (raw) {
    try {
      const overrides = JSON.parse(raw) as Record<string, unknown>;
      for (const [key, value] of Object.entries(overrides)) {
        const num = Number(value);
        if (Number.isFinite(num) && num > 0) weights[key] = num;
      }
    } catch {
      // invalid JSON — keep provisional defaults
    }
  }
  return weights;
}

export function getEnabledSharpBooks(): SharpBookConfig[] {
  return SHARP_BOOKS.filter((b) => b.enabled);
}

export function getSharpBooksByTier(tier: SharpTier): SharpBookConfig[] {
  return getEnabledSharpBooks().filter((b) => b.tier === tier);
}

export const ENABLED_SHARP_BOOK_KEYS: string[] = getEnabledSharpBooks().map((b) => b.key);

export const SHARP_S1_KEYS: string[] = getSharpBooksByTier('S1').map((b) => b.key);
export const SHARP_S2_KEYS: string[] = getSharpBooksByTier('S2').map((b) => b.key);

export function getSharpBookConfig(key: string): SharpBookConfig | undefined {
  return SHARP_BOOKS.find((b) => b.key === key);
}

export const ODDS_MARKETS = [
  'h2h',     // Moneyline / 1X2
  'spreads', // Asian Handicap
  'totals',  // Over/Under
  'btts',    // Both Teams to Score
];
