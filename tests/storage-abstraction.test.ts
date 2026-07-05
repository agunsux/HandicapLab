import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import { Readable } from 'stream';
import { LocalStorage } from '../src/lib/warehouse/storage/localStorage';
import { S3Storage } from '../src/lib/warehouse/storage/s3Storage';
import { StorageHelpers } from '../src/lib/warehouse/storage/helpers';

const TMP_DIR = path.resolve('./tmp-storage-test');

describe('Storage Helpers', () => {
  it('should generate canonical path layouts correctly', () => {
    const bronze = StorageHelpers.getBronzePath('api-football', 'EPL', 2026, '2026-07-01');
    expect(bronze).toBe('bronze/apifootball/epl/2026/2026-07-01/raw.json');

    const silver = StorageHelpers.getSilverPath('La Liga', 2025, '2026-07-01');
    expect(silver).toBe('silver/laliga/2025/2026-07-01/cleaned.parquet');

    const gold = StorageHelpers.getGoldPath('Asian Handicap', '2026-07-01');
    expect(gold).toBe('gold/asianhandicap/2026-07-01/consensus.parquet');
  });
});

describe('LocalStorage', () => {
  let storage: LocalStorage;

  beforeEach(async () => {
    await fsPromises.mkdir(TMP_DIR, { recursive: true });
    storage = new LocalStorage({ baseDir: TMP_DIR });
  });

  afterEach(async () => {
    await fsPromises.rm(TMP_DIR, { recursive: true, force: true });
  });

  it('should upload, check existence, download, and delete files', async () => {
    const key = 'test-file.txt';
    const content = 'HandicapLab Lakehouse Data';

    expect(await storage.exists(key)).toBe(false);

    await storage.upload(key, content);
    expect(await storage.exists(key)).toBe(true);

    const downloaded = await storage.download(key);
    expect(downloaded.toString()).toBe(content);

    // Verify list
    const list = await storage.list();
    expect(list).toContain('test-file.txt');

    await storage.delete(key);
    expect(await storage.exists(key)).toBe(false);
  });

  it('should support streaming uploads', async () => {
    const key = 'stream-file.txt';
    const content = 'Streaming payload';
    const stream = Readable.from([Buffer.from(content)]);

    await storage.streamUpload(key, stream);
    expect(await storage.exists(key)).toBe(true);

    const downloaded = await storage.download(key);
    expect(downloaded.toString()).toBe(content);
  });
});

describe('S3Storage', () => {
  it('should call fetch correctly during S3 operations', async () => {
    const storage = new S3Storage({
      bucketName: 'test-bucket',
      accessKeyId: 'key',
      secretAccessKey: 'secret'
    });

    global.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: async () => '<ListBucketResult><Contents><Key>test.json</Key></Contents></ListBucketResult>',
      arrayBuffer: async () => Buffer.from('mock-data')
    } as any);

    const exists = await storage.exists('test.json');
    expect(exists).toBe(true);

    const data = await storage.download('test.json');
    expect(data.toString()).toBe('mock-data');
  });
});
