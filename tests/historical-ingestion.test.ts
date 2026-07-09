import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiFootballClient } from '../src/lib/apis/apifootball';
import { HistoricalImporter } from '../src/services/etl/historicalImporter';
import { supabase } from '../src/lib/supabase.server';

describe('HistoricalImporter Idempotency', () => {
  let importer: HistoricalImporter;

  beforeEach(() => {
    importer = new HistoricalImporter();
    vi.clearAllMocks();
  });

  it('should skip inserting duplicate fixtures', async () => {
    const mockFixtureData = [
      {
        fixture: { id: 301, referee: null, timezone: 'UTC', date: '2026-07-01T12:00:00Z', timestamp: 1234567, status: { long: 'Finished', short: 'FT', elapsed: 90 } },
        league: { id: 39, name: 'EPL', country: 'England', season: 2026 },
        teams: { home: { id: 1, name: 'Arsenal', winner: true }, away: { id: 2, name: 'Chelsea', winner: false } },
        goals: { home: 2, away: 1 },
        score: {
          halftime: { home: 1, away: 0 },
          fulltime: { home: 2, away: 1 },
          extratime: { home: null, away: null },
          penalty: { home: null, away: null }
        }
      }
    ];

    // Mock API connector to return fixture
    vi.spyOn(apiFootballClient, 'getFixtures').mockResolvedValue({
      get: 'fixtures',
      parameters: {},
      errors: null,
      results: 1,
      paging: { current: 1, total: 1 },
      response: mockFixtureData
    });

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
