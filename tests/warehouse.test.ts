import { describe, it, expect, vi } from 'vitest';
import { DataNormalizer } from '../src/lib/warehouse/normalizer';
import { FeatureStore } from '../src/lib/warehouse/featureStore';

// Mock Supabase Server Client
vi.mock('../src/lib/supabase.server', () => {
  return {
    supabase: {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { elo: 1600.0 }, error: null }),
          single: vi.fn().mockResolvedValue({ data: { id: 'some-uuid' }, error: null }),
          insert: vi.fn().mockResolvedValue({ data: [], error: null }),
          upsert: vi.fn().mockResolvedValue({ data: [], error: null })
        };
      })
    }
  };
});

describe('Historical Data Warehouse & Feature Store Tests', () => {
  it('DataNormalizer should map apiFootball raw fixture correctly', () => {
    const rawFixture = {
      fixture: { id: 100, date: '2026-07-04T12:00:00Z', status: { short: 'FT', long: 'Finished' }, venue: { name: 'Stadium', city: 'London' } },
      league: { id: 39, season: 2026 },
      teams: { home: { id: 10 }, away: { id: 20 } },
      goals: { home: 3, away: 1 },
      score: { halftime: { home: 1, away: 0 } }
    };

    const norm = DataNormalizer.apiFootballFixture(rawFixture);
    expect(norm.apiId).toBe(100);
    expect(norm.status).toBe('finished');
    expect(norm.homeGoals).toBe(3);
    expect(norm.awayGoals).toBe(1);
    expect(norm.htHomeGoals).toBe(1);
  });

  it('FeatureStore.getLatestElo should fallback to mock ELO rating', async () => {
    const elo = await FeatureStore.getLatestElo('team-uuid', '2026-07-05T12:00:00Z');
    expect(elo).toBe(1600.0);
  });
});
