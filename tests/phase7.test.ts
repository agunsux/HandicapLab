import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateTeamRatings } from '../src/lib/engine/ratings';
import { CalibrationEngine } from '../src/lib/engine/calibration';
import { GET as handleUpdateRatings } from '../src/app/api/cron/update-ratings/route';
import { GET as handleGenerateSignals } from '../src/app/api/cron/generate-signals/route';
import { supabase } from '../src/lib/supabase.server';

// Mock Supabase
vi.mock('../src/lib/supabase.server', () => {
  const mockFrom = vi.fn((table: string) => {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      insert: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockImplementation((resolve) => {
        if (table === 'matches') {
          resolve({
            data: [
              {
                home_team: 'Arsenal',
                away_team: 'Chelsea',
                home_goals: 3,
                away_goals: 1,
                league: 'Premier League',
                kickoff: new Date().toISOString(),
                status: 'finished'
              }
            ],
            error: null
          });
        } else if (table === 'signals') {
          // Default mock signals to calculate Brier score in calibration
          resolve({
            data: Array.from({ length: 20 }, (_, i) => ({
              id: `sig-${i}`,
              probability: 0.5, // 50%
              status: 'won', // Brier component = (0.5 - 1.0)^2 = 0.25 (overall Brier = 0.25)
              market: 'asian_handicap',
              settled_at: new Date().toISOString()
            })),
            error: null
          });
        } else {
          resolve({ data: [], error: null });
        }
      })
    } as any;
  });

  return {
    supabase: {
      from: mockFrom
    }
  };
});

describe('Phase 7: Dynamic Team Ratings & Market Calibration Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test_secret';
  });

  describe('Team Ratings Engine (ratings.ts)', () => {
    it('should calculate dynamic team ratings with convergent strengths', () => {
      const recentMatches = [
        { home_team: 'Arsenal', away_team: 'Chelsea', home_goals: 3, away_goals: 1, league: 'EPL', kickoff: '2026-06-25T20:00:00Z' },
        { home_team: 'Chelsea', away_team: 'Spurs', home_goals: 1, away_goals: 2, league: 'EPL', kickoff: '2026-06-26T20:00:00Z' }
      ];

      const ratings = calculateTeamRatings(recentMatches);
      expect(ratings.Arsenal).toBeDefined();
      expect(ratings.Chelsea).toBeDefined();
      expect(ratings.Spurs).toBeDefined();

      // Arsenal won convincingly at home: attack strength should be higher than Chelsea
      expect(ratings.Arsenal.attack_strength).toBeGreaterThan(ratings.Chelsea.attack_strength);
    });
  });

  describe('Market Calibration Logic (calibration.ts)', () => {
    it('should tighten thresholds if Brier Score > 0.25', async () => {
      // Mock supabase to return signals with poor outcomes (Brier Score = 1.0)
      vi.mocked(supabase.from).mockImplementationOnce((table: string) => {
        return {
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation((limitVal) => {
            return {
              then: vi.fn().mockImplementation((resolve) => {
                resolve({
                  data: Array.from({ length: 20 }, (_, i) => ({
                    probability: 0.48, // predicted 48%
                    status: 'won', // but won (brier diff = 0.52^2 = 0.2704, which is between 0.25 and 0.30)
                    market: 'asian_handicap',
                    settled_at: new Date().toISOString()
                  })),
                  error: null
                });
              })
            } as any;
          })
        } as any;
      });

      const thresholds = await CalibrationEngine.getDynamicThresholds();
      expect(thresholds.brierScore).toBeGreaterThan(0.25);
      expect(thresholds.AH).toBe(3.5); // Tightened by +0.5%
      expect(thresholds.OU).toBe(4.5);
      expect(thresholds.ML).toBe(5.5);
    });

    it('should relax thresholds if Brier Score < 0.20', async () => {
      // Mock supabase to return highly calibrated signals (Brier Score = 0.04)
      vi.mocked(supabase.from).mockImplementationOnce((table: string) => {
        return {
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockImplementation((limitVal) => {
            return {
              then: vi.fn().mockImplementation((resolve) => {
                resolve({
                  data: Array.from({ length: 20 }, (_, i) => ({
                    probability: 0.8, // predicted 80%
                    status: 'won', // won (brier diff = 0.2^2 = 0.04 < 0.20)
                    market: 'asian_handicap',
                    settled_at: new Date().toISOString()
                  })),
                  error: null
                });
              })
            } as any;
          })
        } as any;
      });

      const thresholds = await CalibrationEngine.getDynamicThresholds();
      expect(thresholds.brierScore).toBeLessThan(0.20);
      expect(thresholds.AH).toBe(2.75); // Relaxed by -0.25%
      expect(thresholds.OU).toBe(3.75);
      expect(thresholds.ML).toBe(4.75);
    });
  });

  describe('Update Ratings Cron Route', () => {
    it('should reject unauthorized calls with 401', async () => {
      const request = new Request('http://localhost/api/cron/update-ratings', {
        headers: { authorization: 'Bearer wrong' }
      });
      const response = await handleUpdateRatings(request);
      expect(response.status).toBe(401);
    });

    it('should successfully calculate ratings and upsert them with 200', async () => {
      const request = new Request('http://localhost/api/cron/update-ratings', {
        headers: { authorization: 'Bearer test_secret' }
      });
      const response = await handleUpdateRatings(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.teamsUpdated).toBeGreaterThan(0);
    });
  });
});
