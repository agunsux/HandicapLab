import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('LeakageGuard', () => {
  const matchId = 'test-match-123';
  const kickoff = new Date('2026-06-24T12:00:00Z');

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('rejects match events containing future data (status finished pre-kickoff)', async () => {
    const mockMatchSelect = vi.fn().mockResolvedValue({
      data: {
        id: matchId,
        status: 'finished',
        kickoff: kickoff.toISOString(),
        home_goals: 2,
        away_goals: 1
      },
      error: null
    });

    const mockPredSelect = vi.fn().mockResolvedValue({
      data: [],
      error: null
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'matches') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mockMatchSelect
            })
          })
        } as any;
      }
      return {
        select: () => ({
          eq: mockPredSelect
        })
      } as any;
    });

    // Cutoff is set to kickoff time. The match is already marked finished in DB. This is a leak!
    await expect(LeakageGuard.assertNoFutureData(matchId, kickoff)).rejects.toThrow(LeakageError);
    await expect(LeakageGuard.assertNoFutureData(matchId, kickoff)).rejects.toThrow(/MATCH_EVENT_LEAK/);
  });

  it('rejects features generated after the cutoff time', async () => {
    const mockMatchSelect = vi.fn().mockResolvedValue({
      data: {
        id: matchId,
        status: 'upcoming',
        kickoff: kickoff.toISOString(),
        home_goals: null,
        away_goals: null
      },
      error: null
    });

    const mockPredSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'pred-1',
          generated_at: new Date('2026-06-24T12:05:00Z').toISOString(), // 5 mins after kickoff
          odds_snapshot: { timestamp: kickoff.getTime() - 10000 }
        }
      ],
      error: null
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'matches') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mockMatchSelect
            })
          })
        } as any;
      }
      return {
        select: () => ({
          eq: mockPredSelect
        })
      } as any;
    });

    // Cutoff is set to kickoff time. Feature was generated 5 mins after kickoff. This is a leak!
    await expect(LeakageGuard.assertNoFutureData(matchId, kickoff)).rejects.toThrow(LeakageError);
    await expect(LeakageGuard.assertNoFutureData(matchId, kickoff)).rejects.toThrow(/FEATURE_GENERATION_LEAK/);
  });

  it('rejects odds snapshot containing future data', async () => {
    const mockMatchSelect = vi.fn().mockResolvedValue({
      data: {
        id: matchId,
        status: 'upcoming',
        kickoff: kickoff.toISOString(),
        home_goals: null,
        away_goals: null
      },
      error: null
    });

    const mockPredSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'pred-1',
          generated_at: new Date('2026-06-24T11:50:00Z').toISOString(),
          odds_snapshot: {
            timestamp: kickoff.getTime() + 60000 // 1 minute after kickoff
          }
        }
      ],
      error: null
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'matches') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mockMatchSelect
            })
          })
        } as any;
      }
      return {
        select: () => ({
          eq: mockPredSelect
        })
      } as any;
    });

    // Cutoff is set to kickoff time. Odds snapshot is 1 min after kickoff. This is a leak!
    await expect(LeakageGuard.assertNoFutureData(matchId, kickoff)).rejects.toThrow(LeakageError);
    await expect(LeakageGuard.assertNoFutureData(matchId, kickoff)).rejects.toThrow(/ODDS_SNAPSHOT_LEAK/);
  });

  it('passes when all data is pre-kickoff', async () => {
    const mockMatchSelect = vi.fn().mockResolvedValue({
      data: {
        id: matchId,
        status: 'upcoming',
        kickoff: kickoff.toISOString(),
        home_goals: null,
        away_goals: null
      },
      error: null
    });

    const mockPredSelect = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'pred-1',
          generated_at: new Date('2026-06-24T11:50:00Z').toISOString(),
          odds_snapshot: {
            timestamp: kickoff.getTime() - 60000 // 1 minute before kickoff
          }
        }
      ],
      error: null
    });

    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'matches') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: mockMatchSelect
            })
          })
        } as any;
      }
      return {
        select: () => ({
          eq: mockPredSelect
        })
      } as any;
    });

    // Cutoff is set to kickoff time. All data is pre-kickoff. Should pass!
    await expect(LeakageGuard.assertNoFutureData(matchId, kickoff)).resolves.not.toThrow();
  });
});
