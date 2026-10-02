// ============================================================================
// RESEARCH TYPES — football-data.co.uk evidence layer
// ============================================================================
// Location: src/research/football-data/types.ts
// RESEARCH-ONLY. Shared vocabulary for the source-reality audit, the market
// metadata layer and the SALMO canonical bridge.
// ============================================================================

/** Observations the source can actually express (open/closing are documented snapshots). */
export type SnapshotCode = 'opening' | 'closing';

export type ResearchMarketCode = 'ML' | 'AH' | 'OU' | 'BTTS';

/** Odds flavour, needed to interpret a line correctly. */
export type LineType = 'ML' | 'AH_WHOLE' | 'AH_HALF' | 'AH_QUARTER' | 'OU_WHOLE' | 'OU_HALF' | 'OU_QUARTER';

/** Source provenance of a price. 'betbrain_average' is NOT a tradeable price. */
export type PriceProvenance =
  | 'pinnacle'
  | 'bet365'
  | 'betbrain_average'
  | 'market_max'
  | 'market_average'
  | 'unknown';

/**
 * One source-generation era. football-data.co.uk changed its column set between
 * seasons; a claim about a market is only valid within the era that carries the
 * columns for it.
 */
export type SourceEra = 'ERA1_BETBRAIN' | 'ERA2_PINNACLE';

export interface SourceFileSchema {
  /** Repo-relative path of the raw CSV. */
  file: string;
  root: string;
  season: string;
  rows: number;
  columns: number;
  era: SourceEra;
  /** Raw header cell → present? Only the columns that matter are enumerated. */
  columnsPresent: Record<string, boolean>;
  /** Raw OU line labels observed in the header, e.g. ['2.5']. */
  ouLineLabels: string[];
  /** Raw AH line labels observed in the header, e.g. ['AHh'] (a single line column). */
  ahLineColumns: string[];
  /** Pinnacle column families actually present. */
  pinnacle: { mlOpen: boolean; mlClose: boolean; ahOpen: boolean; ahClose: boolean; ouOpen: boolean; ouClose: boolean };
  /** Column families present but deliberately unused by the current reader. */
  unusedButPresent: string[];
}

export interface MarketAvailabilityFact {
  market: ResearchMarketCode;
  snapshot: SnapshotCode | null;
  provenance: PriceProvenance;
  rows: number;
  matches: number;
  /** Seasons in which this fact is present. */
  seasons: string[];
  /** True when the values are NOT tradeable at the stated bookmaker. */
  mislabeledOrUntradeable: boolean;
  note: string;
}

export interface LineInventoryEntry {
  market: ResearchMarketCode;
  lineType: LineType;
  line: number | null;
  rows: number;
  /** True when this is a genuine quarter line (e.g. -0.25, 2.75). */
  isQuarter: boolean;
}

export interface SourceRealityReport {
  generated_at: string;
  scope: string;
  dataset_version: string;
  ingestion_version: string;
  files: SourceFileSchema[];
  marketAvailability: MarketAvailabilityFact[];
  lineInventory: LineInventoryEntry[];
  /** Distinct OU lines the source can express — expected to be exactly [2.5]. */
  ouDistinctLines: number[];
  /** Distinct AH lines observed for Pinnacle closing. */
  ahDistinctLines: number[];
  bttsSupported: boolean;
  findings: string[];
  limitations: string[];
}
