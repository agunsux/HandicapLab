import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureEngine } from '../src/lib/engines/feature-engine';
import { LeakageGuard, LeakageError } from '../src/lib/guards/leakage';
import { supabase } from '../src/lib/supabase.server';

vi.mock('../src/lib/supabase.server', () => {
  const mockFrom = vi.fn();
  return {
    supabase: {
      from: mockFrom
    }
  };
});

class MockBuilder {
  private isSingle = false;
  private isMatchQuery = false;
  constructor(private mockData: any = null, private mockError: any = null) {}

  select = vi.fn().mockReturnThis();

  eq(col: string, val: any) {
    if (col === 'id') {
      this.isMatchQuery = true;
    }
    return this;
  }
  
  or = vi.fn().mockReturnThis();
  lt = vi.fn().mockReturnThis();
  order = vi.fn().mockReturnThis();
  limit = vi.fn().mockReturnThis();
  in = vi.fn().mockReturnThis();
  
  single() {
    this.isSingle = true;
    return this;
  }
  
  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  then(resolve: any) {
    let resolvedData = this.mockData;
    if (resolvedData !== null && !this.isMatchQuery) {
      resolvedData = this.isSingle ? null : [];
    }
    resolve({ data: resolvedData, error: this.mockError });
  }
}

describe('FeatureEngine', () => {
  const matchId = 'test-match-id';
  const kickoff = new Date('2026-06-24T12:00:00Z');

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('triggers LeakageGuard and throws if there is future data', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'matches') {
        const builder = new MockBuilder({
          id: matchId,
          status: 'finished', // leak!
          kickoff: kickoff.toISOString(),
          home_goals: 3,
          away_goals: 1
        });
        return builder as any;
      }
      return new MockBuilder([]) as any;
    });

    await expect(FeatureEngine.build(matchId, kickoff)).rejects.toThrow(LeakageError);
  });

  it('successfully aggregates features when data is pre-kickoff', async () => {
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'matches') {
        return new MockBuilder({
          id: matchId,
          home_team: 'Arsenal',
          away_team: 'Chelsea',
          league: 'Premier League',
          kickoff: kickoff.toISOString(),
          status: 'upcoming',
          home_goals: null,
          away_goals: null
        }) as any;
      }
      return new MockBuilder([]) as any;
    });

    const features = await FeatureEngine.build(matchId, kickoff, 'ML');

    expect(features.matchId).toBe(matchId);
    expect(features.marketType).toBe('ML');
    expect(features.homeFormWeighted).toBe(1.5); // Default fallback
    expect(features.awayFormWeighted).toBe(1.5);
    expect(features.homeRestDays).toBe(7); // Default fallback
    expect(features.homeElo).toBe(1500); // Default fallback
    expect(features.awayElo).toBe(1500);
    expect(features.leagueAvgGoals).toBe(2.5); // Default fallback
  });
});
