// Provider Repository Tests — Payload, ProviderLog, Fixture, Odds Repositories
import { describe, it, expect } from 'vitest';
import { MemoryPayloadRepository, computePayloadChecksum } from '../src/lib/data/repositories/PayloadRepository';
import { MemoryProviderLogRepository } from '../src/lib/data/repositories/ProviderLogRepository';
import { MemoryFixtureRepository } from '../src/lib/data/repositories/FixtureRepository';
import { MemoryOddsRepository } from '../src/lib/data/repositories/OddsRepository';

describe('PayloadRepository', () => {
  it('stores and retrieves payloads', async () => {
    const repo = new MemoryPayloadRepository();
    const record = await repo.insert({
      provider: 'api-football', endpoint: '/fixtures', method: 'GET',
      statusCode: 200, requestedAt: new Date(), durationMs: 150,
      payloadJson: { results: 10 }, error: null,
    });
    expect(record.id).toBeTruthy();
    expect(record.checksum).toBeTruthy();
    expect(record.checksum.length).toBe(64);
    const found = await repo.findById(record.id);
    expect(found).not.toBeNull();
    expect(found!.provider).toBe('api-football');
  });

  it('computePayloadChecksum returns deterministic hash', () => {
    const a = computePayloadChecksum({ foo: 'bar' });
    const b = computePayloadChecksum({ foo: 'bar' });
    expect(a).toBe(b);
    expect(a.length).toBe(64);
  });
});

describe('ProviderLogRepository', () => {
  it('inserts and queries logs', async () => {
    const repo = new MemoryProviderLogRepository();
    await repo.insert({
      provider: 'api-football', endpoint: '/fixtures', method: 'GET',
      statusCode: 200, durationMs: 100, level: 'INFO', message: 'OK', metadata: null,
    });
    await repo.insert({
      provider: 'api-football', endpoint: '/fixtures', method: 'GET',
      statusCode: 500, durationMs: 200, level: 'ERROR',
      message: 'Server error', metadata: { error: 'timeout' },
    });
    const logs = await repo.findByProvider('api-football');
    expect(logs.length).toBe(2);
    const errors = await repo.findErrors('api-football', new Date(0));
    expect(errors.length).toBe(1);
    expect(errors[0].level).toBe('ERROR');
  });
});

describe('FixtureRepository', () => {
  it('upserts and finds fixtures', async () => {
    const repo = new MemoryFixtureRepository();
    const fixture = {
      fixtureId: 'f1', league: 'EPL', season: '2025', tournamentStage: 'regular',
      homeTeam: 'Team A', awayTeam: 'Team B', kickoffTime: new Date('2025-02-01'),
      status: 'upcoming' as const, createdAt: new Date(), updatedAt: new Date(),
    };
    await repo.upsert(fixture);
    const found = await repo.findById('f1');
    expect(found).not.toBeNull();
    expect(found!.homeTeam).toBe('Team A');
  });

  it('finds by status', async () => {
    const repo = new MemoryFixtureRepository();
    await repo.upsert({ fixtureId: 'f1', league: 'EPL', season: '2025', tournamentStage: 'regular', homeTeam: 'A', awayTeam: 'B', kickoffTime: new Date(), status: 'upcoming', createdAt: new Date(), updatedAt: new Date() });
    await repo.upsert({ fixtureId: 'f2', league: 'EPL', season: '2025', tournamentStage: 'regular', homeTeam: 'C', awayTeam: 'D', kickoffTime: new Date(), status: 'live', createdAt: new Date(), updatedAt: new Date() });
    const upcoming = await repo.findByStatus('upcoming');
    expect(upcoming.length).toBe(1);
    expect(upcoming[0].fixtureId).toBe('f1');
  });
});

describe('OddsRepository', () => {
  it('appends and retrieves odds records', async () => {
    const repo = new MemoryOddsRepository();
    const snapshot = {
      id: 'o1', fixtureId: 'f1', bookmaker: 'pinnacle', marketType: 'moneyline' as const,
      line: 0, priceHome: 2.10, priceAway: 3.80, priceDraw: null,
      capturedAt: new Date(), providerName: 'test', rawResponseHash: 'abc',
    };
    await repo.append(snapshot, 'the-odds-api', 'v4', 'soccer_epl');
    const records = await repo.getByFixture('f1');
    expect(records.length).toBe(1);
    expect(records[0].provider).toBe('the-odds-api');
    expect(records[0].sportKey).toBe('soccer_epl');
    expect(records[0].chainHash).toBeTruthy();
    expect(records[0].chainHash.length).toBe(64);
  });

  it('chain hash links consecutive records', async () => {
    const repo = new MemoryOddsRepository();
    const base = { id: '', fixtureId: 'f1', bookmaker: 'pinny', marketType: 'moneyline' as const, line: 0, priceHome: 2.0, priceAway: 3.5, priceDraw: null, capturedAt: new Date(), providerName: 'test', rawResponseHash: '' };
    const r1 = await repo.append({ ...base, priceHome: 2.0, capturedAt: new Date('2025-01-10') }, 'provider', 'v1', 'soccer');
    const r2 = await repo.append({ ...base, priceHome: 2.1, capturedAt: new Date('2025-01-11') }, 'provider', 'v1', 'soccer');
    expect(r2.previousSnapshotId).toBe(r1.id);
    expect(r1.previousSnapshotId).toBeNull();
  });
});
