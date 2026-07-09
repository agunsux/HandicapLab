// Raw Payload Repository — Append-Only Storage for API Responses
// Location: src/lib/data/repositories/PayloadRepository.ts
// Every raw API response is stored here for audit, replay, and debugging.
// No data is ever updated — only inserted.

import * as crypto from 'crypto';

export interface RawPayloadRecord {
  id: string;
  provider: string;
  endpoint: string;
  method: string;
  statusCode: number;
  requestedAt: Date;
  durationMs: number;
  payloadJson: unknown;
  checksum: string;
  error: string | null;
  createdAt: Date;
}

export interface PayloadRepository {
  /** Store a raw API response */
  insert(record: Omit<RawPayloadRecord, 'id' | 'checksum' | 'createdAt'>): Promise<RawPayloadRecord>;
  /** Retrieve a payload by ID */
  findById(id: string): Promise<RawPayloadRecord | null>;
  /** List payloads for a provider, newest first */
  findByProvider(provider: string, limit?: number, offset?: number): Promise<RawPayloadRecord[]>;
  /** Count payloads for a provider */
  countByProvider(provider: string): Promise<number>;
}

export function computePayloadChecksum(payload: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

export class MemoryPayloadRepository implements PayloadRepository {
  private records: RawPayloadRecord[] = [];

  async insert(record: Omit<RawPayloadRecord, 'id' | 'checksum' | 'createdAt'>): Promise<RawPayloadRecord> {
    const checksum = computePayloadChecksum(record.payloadJson);
    const full: RawPayloadRecord = {
      ...record,
      id: crypto.randomUUID(),
      checksum,
      createdAt: new Date(),
    };
    this.records.push(full);
    return full;
  }

  async findById(id: string): Promise<RawPayloadRecord | null> {
    return this.records.find(r => r.id === id) ?? null;
  }

  async findByProvider(provider: string, limit = 50, offset = 0): Promise<RawPayloadRecord[]> {
    return this.records
      .filter(r => r.provider === provider)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
  }

  async countByProvider(provider: string): Promise<number> {
    return this.records.filter(r => r.provider === provider).length;
  }
}
