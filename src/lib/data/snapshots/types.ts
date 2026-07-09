// Odds Snapshot Types — Immutable, Append-Only
import type { MarketType } from '../providers/types';

export interface OddsSnapshotRecord {
  id: string;
  fixtureId: string;
  marketType: MarketType;
  line: number;
  priceHome: number;
  priceAway: number;
  priceDraw: number | null;
  bookmaker: string;
  capturedAt: Date;
  /** SHA-256 of all prior fields + previous record hash — forms an audit chain */
  chainHash: string;
  /** Reference to the previous snapshot for this fixture+market (null = opening) */
  previousSnapshotId: string | null;
  /** Name of the odds provider */
  provider?: string;
  /** Provider API version */
  providerVersion?: string;
  /** Sport key from provider */
  sportKey?: string;
  /** Reference to raw payload in provider_payloads table */
  rawPayloadId?: string | null;
}

export interface OddsSnapshotStore {
  /** Append a new snapshot — never overwrite */
  append(snapshot: OddsSnapshotRecord): Promise<void>;
  /** Get all snapshots for a fixture, ordered by capturedAt ascending */
  getFixturesnapshots(fixtureId: string): Promise<OddsSnapshotRecord[]>;
  /** Get the opening (first) snapshot for a fixture+market */
  getOpening(fixtureId: string, marketType: MarketType, line: number): Promise<OddsSnapshotRecord | null>;
  /** Get the closing (last) snapshot for a fixture+market before kickoff */
  getClosing(fixtureId: string, marketType: MarketType, line: number, kickoffTime: Date): Promise<OddsSnapshotRecord | null>;
  /** Get all snapshots within a time range */
  getByTimeRange(from: Date, to: Date): Promise<OddsSnapshotRecord[]>;
}
