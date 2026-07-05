import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import { LocalStorage } from '../src/lib/warehouse/storage/localStorage';
import { CheckpointService, CheckpointRepository, CheckpointModel } from '../src/lib/warehouse/ingestion/checkpoint';
import { HistoricalImportService } from '../src/lib/warehouse/ingestion/importService';
import { IDataProvider } from '../src/lib/warehouse/ingestion/dataProvider.interface';

const TMP_DIR = path.resolve('./tmp-import-test');

describe('E2E Ingestion Pipeline (Vertical Slice)', () => {
  let storage: LocalStorage;
  let mockProvider: IDataProvider;
  let mockRepo: CheckpointRepository;
  let checkpointService: CheckpointService;
  let importService: HistoricalImportService;
  let dbState: CheckpointModel | null = null;

  beforeEach(async () => {
    await fsPromises.mkdir(TMP_DIR, { recursive: true });
    storage = new LocalStorage({ baseDir: TMP_DIR });
    dbState = null;

    mockRepo = {
      get: vi.fn().mockImplementation(async () => dbState),
      upsert: vi.fn().mockImplementation(async (model: CheckpointModel) => {
        dbState = { ...model, id: model.id || 'mock-uuid' };
        return dbState;
      })
    } as any;

    checkpointService = new CheckpointService(mockRepo);

    mockProvider = {
      getProviderName: () => 'api-football',
      getFixtures: vi.fn().mockResolvedValue([
        { apiId: 1, competitionApiId: 39, seasonYear: 2026, kickoffTime: '2026-07-01T12:00:00Z', status: 'scheduled', homeTeamApiId: 10, awayTeamApiId: 20 },
        { apiId: 2, competitionApiId: 39, seasonYear: 2026, kickoffTime: '2026-07-01T12:00:00Z', status: 'scheduled', homeTeamApiId: 30, awayTeamApiId: 40 }
      ])
    } as any;

    importService = new HistoricalImportService(mockProvider, storage, checkpointService);
  });

  afterEach(async () => {
    await fsPromises.rm(TMP_DIR, { recursive: true, force: true });
  });

  it('should run end-to-end import session successfully', async () => {
    const finalState = await importService.runImport({
      provider: 'api-football',
      league: 'EPL',
      season: 2026,
      endpoint: 'fixtures',
      pageSize: 1, // Processes each fixture in a separate page
      rateLimitDelayMs: 5
    });

    expect(finalState.status).toBe('completed');
    expect(finalState.page).toBe(3); // Ends after page 2 completes and increments to 3
    expect(finalState.rows_imported).toBe(2);

    // Assert that raw bronze files were written to local disk
    const rawV1Exists = await storage.exists('bronze/apifootball/epl/2026/fixtures/raw_v1.json.gz');
    const rawV2Exists = await storage.exists('bronze/apifootball/epl/2026/fixtures/raw_v2.json.gz');
    expect(rawV1Exists).toBe(true);
    expect(rawV2Exists).toBe(true);
  });

  it('should retry on transient provider errors', async () => {
    // Inject a provider failure that succeeds on second attempt
    let callsCount = 0;
    mockProvider.getFixtures = vi.fn().mockImplementation(async () => {
      callsCount++;
      if (callsCount === 1) throw new Error('Transient Network Error');
      return [
        { apiId: 1, competitionApiId: 39, seasonYear: 2026, kickoffTime: '2026-07-01T12:00:00Z', status: 'scheduled', homeTeamApiId: 10, awayTeamApiId: 20 }
      ];
    });

    const finalState = await importService.runImport({
      provider: 'api-football',
      league: 'EPL',
      season: 2026,
      endpoint: 'fixtures',
      pageSize: 1,
      rateLimitDelayMs: 5,
      maxRetries: 2
    });

    expect(finalState.status).toBe('completed');
    expect(callsCount).toBe(2);
  });
});
