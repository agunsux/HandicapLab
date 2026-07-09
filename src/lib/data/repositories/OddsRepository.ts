// Odds Repository — Immutable, Append-Only Persistence for Odds Snapshots
// Location: src/lib/data/repositories/OddsRepository.ts
// Every odds change is a new record. No updates, no deletes.

import * as crypto from 'crypto';
import type { OddsSnapshot } from '../providers/types';

export interface OddsRepositoryRecord {
  id: string;
  fixtureId: string;
  bookmaker: string;
  marketType: string;
  line: number;
  priceHome: number;
  priceAway: number;
  priceDraw: number | null;
  capturedAt: Date;
  provider: string;
  providerVersion: string;
  sportKey: string;
  rawPayloadId: string | null;
  chainHash: string;
  previousSnapshotId: string | null;
  ingestedAt: Date;
}

export interface OddsRepository {
  /** Append a new odds snapshot — never overwrite */
  append(snapshot: OddsSnapshot, provider: string, providerVersion: string, sportKey: string, rawPayloadId?: string): Promise<OddsRepositoryRecord>;
  /** Get all snapshots for a fixture ordered by capturedAt */
  getByFixture(fixtureId: string): Promise<OddsRepositoryRecord[]>;
  /** Get latest snapshot for fixture + market + line */
  getLatest(fixtureId: string, marketType: string, line: number): Promise<OddsRepositoryRecord | null>;
  /** Get snapshots within time range */
  getByTimeRange(from: Date, to: Date): Promise<OddsRepositoryRecord[]>;
  /** Get opening snapshot for a fixture + market + line */
  getOpening(fixtureId: string, marketType: string, line: number): Promise<OddsRepositoryRecord | null>;
  /** Get closing snapshot before kickoff */
  getClosing(fixtureId: string, marketType: string, line: number, kickoffTime: Date): Promise<OddsRepositoryRecord | null>;
}

export class MemoryOddsRepository implements OddsRepository {
  private records: OddsRepositoryRecord[] = [];
  private previousMap: Map<string, { fixtureId: string; marketType: string; line: number; id: string }> = new Map();

  async append(
    snapshot: OddsSnapshot,
    provider: string,
    providerVersion: string,
    sportKey: string,
    rawPayloadId?: string
  ): Promise<OddsRepositoryRecord> {
    // Build chain hash
    const fixtureMarketKey = `${snapshot.fixtureId}:${snapshot.marketType}:${snapshot.line}`;
    const previousId = this.previousMap.get(fixtureMarketKey)?.id ?? null;

    const basePayload = JSON.stringify({
      fixtureId: snapshot.fixtureId,
      bookmaker: snapshot.bookmaker,
      marketType: snapshot.marketType,
      line: snapshot.line,
      priceHome: snapshot.priceHome,
      priceAway: snapshot.priceAway,
      priceDraw: snapshot.priceDraw,
      capturedAt: snapshot.capturedAt.toISOString(),
      provider,
      providerVersion,
      sportKey,
    });

    const chainHashInput = `${previousId ?? 'genesis'}::${basePayload}`;
    const chainHash = crypto.createHash('sha256').update(chainHashInput).digest('hex');

    const record: OddsRepositoryRecord = {
      id: crypto.randomUUID(),
      fixtureId: snapshot.fixtureId,
      bookmaker: snapshot.bookmaker,
      marketType: snapshot.marketType,
      line: snapshot.line,
      priceHome: snapshot.priceHome,
      priceAway: snapshot.priceAway,
      priceDraw: snapshot.priceDraw,
      capturedAt: snapshot.capturedAt,
      provider,
      providerVersion,
      sportKey,
      rawPayloadId: rawPayloadId ?? null,
      chainHash,
      previousSnapshotId: previousId,
      ingestedAt: new Date(),
    };

    this.records.push(record);
    this.previousMap.set(fixtureMarketKey, { fixtureId: snapshot.fixtureId, marketType: snapshot.marketType, line: snapshot.line, id: record.id });
    return record;
  }

  async getByFixture(fixtureId: string): Promise<OddsRepositoryRecord[]> {
    return this.records
      .filter(r => r.fixtureId === fixtureId)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  }

  async getLatest(fixtureId: string, marketType: string, line: number): Promise<OddsRepositoryRecord | null> {
    const snaps = this.records
      .filter(r => r.fixtureId === fixtureId && r.marketType === marketType && r.line === line)
      .sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime());
    return snaps[0] ?? null;
  }

  async getByTimeRange(from: Date, to: Date): Promise<OddsRepositoryRecord[]> {
    return this.records
      .filter(r => r.capturedAt >= from && r.capturedAt <= to)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  }

  async getOpening(fixtureId: string, marketType: string, line: number): Promise<OddsRepositoryRecord | null> {
    const snaps = this.records
      .filter(r => r.fixtureId === fixtureId && r.marketType === marketType && r.line === line)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
    return snaps[0] ?? null;
  }

  async getClosing(fixtureId: string, marketType: string, line: number, kickoffTime: Date): Promise<OddsRepositoryRecord | null> {
    const snaps = this.records
      .filter(r => r.fixtureId === fixtureId && r.marketType === marketType && r.line === line && r.capturedAt <= kickoffTime)
      .sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
    return snaps.length > 0 ? snaps[snaps.length - 1] : null;
  }
}
