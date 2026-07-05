import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import * as zlib from 'zlib';
import { LocalStorage } from '../src/lib/warehouse/storage/localStorage';
import { SilverPipeline, PipelineConfig } from '../src/lib/warehouse/storage/silverPipeline';
import { DataContractDefinition } from '../src/lib/warehouse/metadata/dataContract';
import { MetadataRegistry } from '../src/lib/warehouse/metadata/registry';
import { supabase } from '../src/lib/supabase.server';

const TMP_DIR = path.resolve('./tmp-silver-pipeline-test');

const fixtureContract: DataContractDefinition = {
  datasetId: 'silver_fixtures',
  version: '1.0.0',
  columns: {
    fixture_id: { type: 'BigInt', required: true, nullable: false },
    status: { type: 'String', required: true, nullable: false }
  },
  primaryKey: ['fixture_id'],
  compatibilityVersion: '1.0.0'
};

describe('Silver Transformation Pipeline E2E', () => {
  let storage: LocalStorage;
  let registry: MetadataRegistry;
  let pipeline: SilverPipeline;

  beforeEach(async () => {
    await fsPromises.mkdir(TMP_DIR, { recursive: true });
    storage = new LocalStorage({ baseDir: TMP_DIR });
    registry = new MetadataRegistry();

    pipeline = new SilverPipeline(storage, registry);

    vi.spyOn(supabase, 'from').mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'mock-uuid', dataset_id: 'silver_fixtures', version: '1.0.0', schema_definition: {}, checksum: 'abc', compression: 'gzip', partition_count: 0, row_count: 2, provider: 'api-football', coverage_pct: 100, generated_at: '2026-07-01' } }),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null })
    } as any);
  });

  afterEach(async () => {
    await fsPromises.rm(TMP_DIR, { recursive: true, force: true });
  });

  it('should process Bronze blocks into partitioned Silver output', async () => {
    const rawData = [
      { apiId: 1001, status: 'scheduled' },
      { apiId: 1002, status: 'scheduled' },
      { apiId: 1002, status: 'finished' } // Duplicate apiId
    ];

    const compressed = zlib.gzipSync(Buffer.from(JSON.stringify(rawData)));
    await storage.upload('bronze/raw.json.gz', compressed);

    const config: PipelineConfig = {
      bronzeKey: 'bronze/raw.json.gz',
      contract: fixtureContract,
      dedupStrategy: 'KEEP_LAST', // Keeps the duplicate with 'finished' status
      provider: 'api-football',
      league: 'EPL',
      season: 2026
    };

    const { path: resultPath, report } = await pipeline.execute(config);

    expect(report.processed).toBe(3);
    expect(report.deduplicated).toBe(1);
    expect(report.rejected).toBe(0);

    // Verify partitioned file output exists
    const exists = await storage.exists(resultPath);
    expect(exists).toBe(true);

    // Read generated output
    const outBuffer = await storage.download(resultPath);
    const resultStr = zlib.gunzipSync(outBuffer).toString('utf-8');
    const parsedRows = resultStr.split('\n').map(l => JSON.parse(l));

    expect(parsedRows.length).toBe(2);
    // KEEP_LAST keeps 'finished' status
    const secondRow = parsedRows.find(r => r.fixture_id === 1002);
    expect(secondRow.status).toBe('finished');
  });
});
