import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { FootyStatsResearchClient, parseOddsValue } from '../../src/lib/research/prematch-yield/footystatsClient';

describe('FootyStatsResearchClient (Task 2 Safety & Caching)', () => {
  const testCacheDir = path.resolve(process.cwd(), 'data/raw/footystats/test_cache');
  const dummyKey = 'test_key_secret_xyz123';

  beforeEach(() => {
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testCacheDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  it('fails closed when API key is missing from constructor and env', () => {
    const originalKey = process.env.FOOTYSTATS_API_KEY;
    delete process.env.FOOTYSTATS_API_KEY;
    try {
      expect(() => new FootyStatsResearchClient({ apiKey: '', cacheDir: testCacheDir })).toThrow(
        /FOOTYSTATS_AUTH_ERROR/
      );
    } finally {
      process.env.FOOTYSTATS_API_KEY = originalKey;
    }
  });

  it('returns cached data without calling fetch when cache file exists', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const mockPayload = {
      success: true,
      data: [
        {
          id: 101,
          homeID: 1,
          awayID: 2,
          home_name: 'Arsenal',
          away_name: 'Chelsea',
          date_unix: 1720000000,
          status: 'complete',
          odds_ft_1: 2.10,
          odds_btts_yes: 1.80,
          odds_ft_over25: 1.95,
        },
      ],
    };

    const cacheFilePath = path.join(testCacheDir, '2024-2025.json');
    fs.writeFileSync(cacheFilePath, JSON.stringify(mockPayload), 'utf-8');

    const client = new FootyStatsResearchClient({
      apiKey: dummyKey,
      cacheDir: testCacheDir,
      maxPilotNetworkRequests: 2,
    });

    const result = await client.getSeasonMatches(12325, '2024-2025');

    expect(result.fromCache).toBe(true);
    expect(result.requestCount).toBe(0);
    expect(result.payload.data.length).toBe(1);
    expect(result.payload.data[0].home_name).toBe('Arsenal');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(client.getNetworkRequestsIssued()).toBe(0);
  });

  it('fetches and writes to cache file when not in cache, respecting budget', async () => {
    const mockResponse = {
      success: true,
      pager: { total_results: 1 },
      data: [
        {
          id: 202,
          homeID: 3,
          awayID: 4,
          home_name: 'Liverpool',
          away_name: 'Man City',
          date_unix: 1720001000,
          status: 'complete',
          odds_ft_1: 2.40,
        },
      ],
    };

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify(mockResponse),
    });
    global.fetch = fetchSpy;

    const client = new FootyStatsResearchClient({
      apiKey: dummyKey,
      cacheDir: testCacheDir,
      maxPilotNetworkRequests: 2,
    });

    const result = await client.getSeasonMatches(15050, '2025-2026');

    expect(result.fromCache).toBe(false);
    expect(result.requestCount).toBe(1);
    expect(client.getNetworkRequestsIssued()).toBe(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Verify cache file was created
    const writtenFile = path.join(testCacheDir, '2025-2026.json');
    expect(fs.existsSync(writtenFile)).toBe(true);
    const cachedData = JSON.parse(fs.readFileSync(writtenFile, 'utf-8'));
    expect(cachedData.data[0].home_name).toBe('Liverpool');
  });

  it('enforces pilot budget ceiling and blocks excess requests fail-closed', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      text: async () => JSON.stringify({ success: true, data: [] }),
    });
    global.fetch = fetchSpy;

    const client = new FootyStatsResearchClient({
      apiKey: dummyKey,
      cacheDir: testCacheDir,
      maxPilotNetworkRequests: 2,
    });

    // Request 1: succeeds
    await client.getSeasonMatches(101, 'season-1');
    // Request 2: succeeds
    await client.getSeasonMatches(102, 'season-2');
    expect(client.getNetworkRequestsIssued()).toBe(2);

    // Request 3: must be blocked fail-closed
    await expect(client.getSeasonMatches(103, 'season-3')).rejects.toThrow(
      /PILOT_BUDGET_EXCEEDED/
    );
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('redacts the API key in all error messages and thrown exceptions', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      statusText: `Forbidden for key ${dummyKey}`,
      text: async () => `Invalid credentials for ${dummyKey}`,
    });
    global.fetch = fetchSpy;

    const client = new FootyStatsResearchClient({
      apiKey: dummyKey,
      cacheDir: testCacheDir,
      maxPilotNetworkRequests: 2,
    });

    await expect(client.getSeasonMatches(999, 'error-season')).rejects.toThrow(
      expect.not.stringContaining(dummyKey)
    );
  });

  describe('parseOddsValue', () => {
    it('normalizes missing, zero, or non-positive values to null', () => {
      expect(parseOddsValue(null)).toBeNull();
      expect(parseOddsValue(undefined)).toBeNull();
      expect(parseOddsValue(0)).toBeNull();
      expect(parseOddsValue('0')).toBeNull();
      expect(parseOddsValue('0.00')).toBeNull();
      expect(parseOddsValue(-1.5)).toBeNull();
      expect(parseOddsValue(1.0)).toBeNull(); // 1.0 is no return / impossible price
      expect(parseOddsValue('invalid')).toBeNull();
    });

    it('returns formatted decimal odds for valid values', () => {
      expect(parseOddsValue(1.95)).toBe(1.95);
      expect(parseOddsValue('2.05')).toBe(2.05);
      expect(parseOddsValue(10.50)).toBe(10.5);
    });
  });
});

