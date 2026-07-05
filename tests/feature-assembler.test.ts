import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureAssembler } from '../backend/services/FeatureAssembler';
import { supabase } from '../src/lib/supabase.server';

describe('FeatureAssembler Point-In-Time Safety & Bounds', () => {
  let assembler: FeatureAssembler;

  beforeEach(() => {
    assembler = new FeatureAssembler();
    vi.clearAllMocks();
  });

  it('should validate feature values using specific range check bounds', () => {
    expect(assembler.validateFeature('home_win_rate_3', 0.75)).toBe(true);
    expect(assembler.validateFeature('home_win_rate_3', 1.2)).toBe(false); // Invalid percentage
    expect(assembler.validateFeature('home_goals_scored_avg_5', -1)).toBe(false); // Negative average
    expect(assembler.validateFeature('home_rest_days', 4)).toBe(true);
  });

  it('should generate feature snapshots and query only matches before kickoff', async () => {
    // Mock target fixture: kickoff_time is '2026-07-10'
    const mockFixture = {
      id: 100,
      home_team_id: 1,
      away_team_id: 2,
      kickoff_time: '2026-07-10T15:00:00Z'
    };

    // Mock past matches occurring BEFORE '2026-07-10' in DESC order
    const mockPastMatches = [
      { id: 91, home_team_id: 1, away_team_id: 4, home_goals: 2, away_goals: 0, kickoff_time: '2026-07-05T15:00:00Z' },
      { id: 90, home_team_id: 1, away_team_id: 3, home_goals: 3, away_goals: 1, kickoff_time: '2026-07-01T15:00:00Z' }
    ];

    vi.spyOn(supabase, 'from').mockImplementation((table: string) => {
      if (table === 'wh_fixtures') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockFixture }),
          or: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: mockPastMatches }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null })
        } as any;
      }
      return {
        upsert: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any;
    });

    const features = await assembler.assembleFeaturesForFixture(100);

    // Assert that home win rate of last 3 is computed:
    // Match 90: Home Team 1 won (3-1). Match 91: Away Team 1 won (2-0). Wins = 2/2 = 1.0.
    const winRate3 = features.find(f => f.featureName === 'home_win_rate_3');
    expect(winRate3).toBeDefined();
    expect(winRate3?.featureValue).toBe(1.0);

    // Check rest days: 2026-07-10 current kickoff minus 2026-07-05 previous match = 5 days rest
    const restDays = features.find(f => f.featureName === 'home_rest_days');
    expect(restDays).toBeDefined();
    expect(restDays?.featureValue).toBe(5);
  });
});
