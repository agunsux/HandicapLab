import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import { LocalStorage } from '../src/lib/warehouse/storage/localStorage';
import { BronzeWriter } from '../src/lib/warehouse/storage/bronzeWriter';

const TMP_DIR = path.resolve('./tmp-bronze-test');

describe('BronzeWriter Immutability & Versioning', () => {
  let storage: LocalStorage;
  let writer: BronzeWriter;

  beforeEach(async () => {
    await fsPromises.mkdir(TMP_DIR, { recursive: true });
    storage = new LocalStorage({ baseDir: TMP_DIR });
    writer = new BronzeWriter(storage);
  });

  afterEach(async () => {
    await fsPromises.rm(TMP_DIR, { recursive: true, force: true });
  });

  it('should create version 1 on first raw import', async () => {
    const rawData = { matches: [{ id: 100, home: 'A', away: 'B' }] };
    
    const result = await writer.write({
      provider: 'api-football',
      league: 'EPL',
      season: 2026,
      endpoint: 'fixtures',
      rawData
    });

    expect(result.version).toBe(1);
    expect(result.skipped).toBe(false);
    expect(result.key).toContain('raw_v1.json.gz');

    // Confirm manifest was created
    const manifestExists = await storage.exists('bronze/apifootball/epl/2026/fixtures/manifest.json');
    expect(manifestExists).toBe(true);
  });

  it('should skip duplicate write if checksum is identical', async () => {
    const rawData = { matches: [{ id: 100, home: 'A', away: 'B' }] };

    // First write
    await writer.write({
      provider: 'api-football',
      league: 'EPL',
      season: 2026,
      endpoint: 'fixtures',
      rawData
    });

    // Second write (identical content)
    const result = await writer.write({
      provider: 'api-football',
      league: 'EPL',
      season: 2026,
      endpoint: 'fixtures',
      rawData
    });

    expect(result.version).toBe(1);
    expect(result.skipped).toBe(true);
  });

  it('should increment version count if checksum is different', async () => {
    const rawDataV1 = { matches: [{ id: 100, home: 'A', away: 'B' }] };
    const rawDataV2 = { matches: [{ id: 100, home: 'A', away: 'B', score: '2-1' }] };

    // Write v1
    await writer.write({
      provider: 'api-football',
      league: 'EPL',
      season: 2026,
      endpoint: 'fixtures',
      rawData: rawDataV1
    });

    // Write v2 (different content)
    const result = await writer.write({
      provider: 'api-football',
      league: 'EPL',
      season: 2026,
      endpoint: 'fixtures',
      rawData: rawDataV2
    });

    expect(result.version).toBe(2);
    expect(result.skipped).toBe(false);
    expect(result.key).toContain('raw_v2.json.gz');
  });
});
