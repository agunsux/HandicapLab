// Provider Log Repository — Append-Only Log of All Provider Interactions
// Location: src/lib/data/repositories/ProviderLogRepository.ts
// Tracks every request/response cycle for observability and debugging.

import * as crypto from 'crypto';

export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface ProviderLogRecord {
  id: string;
  provider: string;
  endpoint: string;
  method: string;
  statusCode: number | null;
  durationMs: number;
  level: LogLevel;
  message: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface ProviderLogRepository {
  insert(record: Omit<ProviderLogRecord, 'id' | 'createdAt'>): Promise<ProviderLogRecord>;
  findByProvider(provider: string, limit?: number, offset?: number): Promise<ProviderLogRecord[]>;
  findErrors(provider: string, since: Date): Promise<ProviderLogRecord[]>;
  getStats(since: Date): Promise<{
    totalRequests: number;
    errorCount: number;
    avgDurationMs: number;
    byProvider: Record<string, { total: number; errors: number }>;
  }>;
}

export class MemoryProviderLogRepository implements ProviderLogRepository {
  private records: ProviderLogRecord[] = [];

  async insert(record: Omit<ProviderLogRecord, 'id' | 'createdAt'>): Promise<ProviderLogRecord> {
    const full: ProviderLogRecord = {
      ...record,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    this.records.push(full);
    return full;
  }

  async findByProvider(provider: string, limit = 50, offset = 0): Promise<ProviderLogRecord[]> {
    return this.records
      .filter(r => r.provider === provider)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
  }

  async findErrors(provider: string, since: Date): Promise<ProviderLogRecord[]> {
    return this.records.filter(
      r => r.provider === provider && r.level === 'ERROR' && r.createdAt >= since
    );
  }

  async getStats(since: Date): Promise<{
    totalRequests: number;
    errorCount: number;
    avgDurationMs: number;
    byProvider: Record<string, { total: number; errors: number }>;
  }> {
    const recent = this.records.filter(r => r.createdAt >= since);
    const totalRequests = recent.length;
    const errors = recent.filter(r => r.level === 'ERROR');
    const avgDurationMs = totalRequests > 0
      ? recent.reduce((s, r) => s + r.durationMs, 0) / totalRequests
      : 0;

    const byProvider: Record<string, { total: number; errors: number }> = {};
    for (const r of recent) {
      if (!byProvider[r.provider]) byProvider[r.provider] = { total: 0, errors: 0 };
      byProvider[r.provider].total++;
      if (r.level === 'ERROR') byProvider[r.provider].errors++;
    }

    return { totalRequests, errorCount: errors.length, avgDurationMs, byProvider };
  }
}
