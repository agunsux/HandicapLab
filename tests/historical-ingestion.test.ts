import { describe, it, expect, vi, beforeEach } from 'vitest';
import { APIFootballConnector } from '../src/services/providers/apiFootballConnector';
import { HistoricalImporter } from '../src/services/etl/historicalImporter';
import { supabase } from '../src/lib/supabase.server';
import axios from 'axios';

vi.mock('axios');

describe('APIFootballConnector Rate Limits & Backoffs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should retry on rate limit warnings and scale backoffs', async () => {
    const connector = new APIFootballConnector({ rateLimitMs: 1 });

    // Mock first call returning errors (rate limit), second call succeeding
    vi.mocked(axios.get)
      .mockResolvedValueOnce({
        status: 200,
        data: { errors: { requests: 'Rate limit exceeded' } }
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { response: [{ fixture: { id: 202 } }] }
      });

    const result = await connector.fetchWithRetry<any[]>('fixtures', {}, 3);
    expect(result.length).toBe(1);
    expect(result[0].fixture.id).toBe(202);
    expect(axios.get).toHaveBeenCalledTimes(2);
  });
});

describe('HistoricalImporter Idempotency', () => {
  let importer: HistoricalImporter;

  beforeEach(() => {
    importer = new HistoricalImporter();
    vi.clearAllMocks();
  });

  it('should skip inserting duplicate fixtures', async () => {
    const mockFixtureData = [
      {
        fixture: { id: 301, date: '2026-07-01T12:00:00Z', status: { short: 'FT' } },
        teams: { home: { id: 1 }, away: { id: 2 } },
        goals: { home: 2, away: 1 }
      }
    ];

    // Mock API connector to return fixture
    vi.spyOn(APIFootballConnector.prototype, 'fetchWithRetry').mockResolvedValue(mockFixtureData);

    // Mock Supabase call: first run returns no existing fixture, second run returns the existing fixture
    vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn()
        .mockResolvedValueOnce({ data: null, error: null }) // First run
        .mockResolvedValueOnce({ data: { id: 301 }, error: null }), // Second run
      insert: vi.fn().mockResolvedValue({ error: null })
    } as any);

    // Run 1: Inserts new fixture
    const report1 = await importer.importSeason('EPL', 2026, 39);
    expect(report1.fixturesImported).toBe(1);
    expect(report1.duplicatesSkipped).toBe(0);

    // Run 2: Detects duplicate, skips insert
    const report2 = await importer.importSeason('EPL', 2026, 39);
    expect(report2.fixturesImported).toBe(0);
    expect(report2.duplicatesSkipped).toBe(1);
  });
});
