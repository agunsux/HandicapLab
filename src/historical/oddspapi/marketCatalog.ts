// ============================================================================
// OddsPapi market catalog loader + classifier
// ============================================================================
// Market IDs and lines come from the REAL /v4/markets catalog (persisted at
// data/cache/oddspapi_markets_raw.json). Nothing is hardcoded: unknown market
// types are classified as unsupported, never guessed.

import * as fs from 'fs';

export type StorageMarket = 'ML' | 'AH' | 'OU' | 'BTTS';
export type SelectionSide = 'home' | 'draw' | 'away' | 'over' | 'under' | 'yes' | 'no';

export interface CatalogOutcome {
  outcomeId: number;
  outcomeName: string;
}

export interface CatalogMarket {
  marketId: number;
  marketName: string;
  marketType: string;
  handicap: number | null;
  outcomes: CatalogOutcome[];
}

export interface ClassifiedMarket {
  market: StorageMarket;
  line: number | null;
}

export function loadMarketCatalog(filePath: string): Map<number, CatalogMarket> {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const list: any[] = Array.isArray(raw) ? raw : raw.markets ?? [];
  const map = new Map<number, CatalogMarket>();

  for (const m of list) {
    const marketId = Number(m.marketId);
    if (!Number.isFinite(marketId)) continue;
    map.set(marketId, {
      marketId,
      marketName: String(m.marketName ?? ''),
      marketType: String(m.marketType ?? ''),
      handicap: m.handicap === null || m.handicap === undefined ? null : Number(m.handicap),
      outcomes: (m.outcomes ?? []).map((o: any) => ({
        outcomeId: Number(o.outcomeId),
        outcomeName: String(o.outcomeName ?? ''),
      })),
    });
  }

  return map;
}

/**
 * Classify a catalog market into a storage market. Returns null for markets we
 * do not support (player props, corners, etc.) — they are counted, not stored.
 */
export function classifyCatalogMarket(market: CatalogMarket): ClassifiedMarket | null {
  const type = market.marketType.toLowerCase();
  const name = market.marketName.toLowerCase();

  if (type === '1x2' || type === 'moneyline' || name.includes('full time result')) {
    return { market: 'ML', line: null };
  }
  if (type === 'bothteamsscore' || name.includes('both teams to score')) {
    return { market: 'BTTS', line: null };
  }
  if (type === 'totals' || name.includes('over under')) {
    const line = market.handicap === null || !Number.isFinite(market.handicap) ? null : market.handicap;
    return { market: 'OU', line };
  }
  if (type === 'spreads' || name.includes('asian handicap')) {
    const line = market.handicap === null || !Number.isFinite(market.handicap) ? null : market.handicap;
    return { market: 'AH', line };
  }

  return null;
}

/** Map a provider outcome name to a canonical selection side. */
export function outcomeSide(market: StorageMarket, outcomeName: string): SelectionSide | null {
  const name = outcomeName.trim().toLowerCase();

  if (market === 'ML') {
    if (name === '1' || name === 'home') return 'home';
    if (name === 'x' || name === 'draw') return 'draw';
    if (name === '2' || name === 'away') return 'away';
    return null;
  }
  if (market === 'AH') {
    if (name === '1' || name === 'home') return 'home';
    if (name === '2' || name === 'away') return 'away';
    return null;
  }
  if (market === 'OU') {
    if (name === 'over') return 'over';
    if (name === 'under') return 'under';
    return null;
  }
  if (market === 'BTTS') {
    if (name === 'yes') return 'yes';
    if (name === 'no') return 'no';
    return null;
  }
  return null;
}
