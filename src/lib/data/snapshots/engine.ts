// Odds Snapshot Engine — Immutable, Append-Only Storage
// Every odds movement is recorded with a chain hash for audit.
// No data is ever overwritten.

import * as crypto from 'crypto';
import type { OddsSnapshotRecord, OddsSnapshotStore } from './types';
import type { MarketType } from '../providers/types';

function hashRecord(rec: Omit<OddsSnapshotRecord, 'chainHash'>): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ ...rec, chainHash: undefined }, Object.keys(rec).sort()))
    .digest('hex');
}

function createChainHash(
  rec: Omit<OddsSnapshotRecord, 'chainHash'>,
  previousSnapshotId: string | null
): string {
  const payload = hashRecord(rec);
  return crypto
    .createHash('sha256')
    .update(`${previousSnapshotId ?? 'genesis'}::${payload}`)
    .digest('hex');
}

export function createOddsSnapshot(
  fixtureId: string,
  marketType: MarketType,
  line: number,
  priceHome: number,
  priceAway: number,
  priceDraw: number | null,
  bookmaker: string,
  capturedAt: Date,
  previousSnapshotId: string | null
): OddsSnapshotRecord {
  const id = crypto.randomUUID();
  const base: Omit<OddsSnapshotRecord, 'chainHash'> = {
    id, fixtureId, marketType, line,
    priceHome, priceAway, priceDraw,
    bookmaker, capturedAt, previousSnapshotId,
  };
  return { ...base, chainHash: createChainHash(base, previousSnapshotId) };
}

/** In-memory implementation of OddsSnapshotStore (for testing/development).
 *  Production should use the database-backed implementation via migrations. */
export class MemoryOddsSnapshotStore implements OddsSnapshotStore {
  private snapshots: OddsSnapshotRecord[] = [];

  async append(snapshot: OddsSnapshotRecord): Promise<void> {
    this.snapshots.push(snapshot);
  }

  async getFixturesnapshots(fixtureId: string): Promise<OddsSnapshotRecord[]> {
    return this.snapshots
      .filter(s => s.fixtureId === fixtureId)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  }

  async getOpening(fixtureId: string, marketType: MarketType, line: number): Promise<OddsSnapshotRecord | null> {
    const snaps = this.snapshots
      .filter(s => s.fixtureId === fixtureId && s.marketType === marketType && s.line === line)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
    return snaps.length > 0 ? snaps[0] : null;
  }

  async getClosing(fixtureId: string, marketType: MarketType, line: number, kickoffTime: Date): Promise<OddsSnapshotRecord | null> {
    const snaps = this.snapshots
      .filter(s => s.fixtureId === fixtureId && s.marketType === marketType && s.line === line && s.capturedAt <= kickoffTime)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
    return snaps.length > 0 ? snaps[snaps.length - 1] : null;
  }

  async getByTimeRange(from: Date, to: Date): Promise<OddsSnapshotRecord[]> {
    return this.snapshots
      .filter(s => s.capturedAt >= from && s.capturedAt <= to)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  }
}
