import { describe, test, expect, vi } from 'vitest';
import { toFiniteNumber, isMalformed } from '../src/lib/utils/number';

// Mock Supabase Server Client
vi.mock('../src/lib/supabase.server', () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() => {
            if (table === 'odds_snapshots') {
              // Return one valid market odds, one malformed (NaN/string)
              return {
                data: {
                  match_id: 'test-match-1',
                  odds_home: 'abc', // malformed ML odds
                  odds_away: 1.95,
                  odds_draw: 3.20,
                  handicap_line: -0.5
                },
                error: null
              };
            }
            if (table === 'team_ratings') {
              return {
                data: {
                  team_id: 'test-team',
                  attack_strength: 1.2,
                  defense_strength: 0.8
                },
                error: null
              };
            }
            return { data: null, error: null };
          }),
          then: (resolve: any) => {
            if (table === 'matches') {
              resolve({
                data: [
                  {
                    id: 'test-match-1',
                    home_team: 'HomeTeam',
                    away_team: 'AwayTeam',
                    league: 'FIFA World Cup',
                    kickoff: '2026-07-01T18:00:00Z',
                    status: 'upcoming',
                    competition_type: 'international',
                    tournament_stage: 'Playoffs'
                  }
                ],
                error: null
              });
            } else {
              resolve({ data: [], error: null });
            }
          }
        } as any;
      }),
      rpc: vi.fn().mockImplementation((name: string) => {
        return {
          then: (resolve: any) => {
            resolve({ data: null, error: null });
          }
        };
      })
    }
  };
});

// Mock Engines to avoid slow execution and keep focus on numeric pipeline checks
vi.mock('../src/lib/engines/feature-engine', () => {
  return {
    FeatureEngine: {
      build: vi.fn().mockResolvedValue({
        matchId: 'test-match-1',
        marketType: 'ML',
        kickoffAt: new Date()
      })
    }
  };
});

vi.mock('../src/lib/engines/probability-engine', () => {
  return {
    ProbabilityEngine: {
      predict: vi.fn().mockImplementation((features: any, opts: any) => {
        // Return valid confidence and probabilities
        return {
          confidence: { finalConfidence: 0.80 },
          pHome: 0.60,
          pAhHome: 0.60,
          pOver: 0.65
        };
      })
    }
  };
});

vi.mock('../src/lib/engine/calibration', () => {
  return {
    CalibrationEngine: {
      getDynamicThresholds: vi.fn().mockResolvedValue({
        ML: 2.0,
        AH: 1.5,
        OU: 1.5
      })
    }
  };
});

import { POST as marketSimulationPost } from '../src/app/api/admin/market-simulation/route';

describe('Prediction Pipeline Runtime Safety - Unit Tests', () => {
  test('toFiniteNumber helper parses inputs correctly', () => {
    // Valid values (including 0)
    expect(toFiniteNumber(2.5)).toBe(2.5);
    expect(toFiniteNumber("2.5")).toBe(2.5);
    expect(toFiniteNumber(0)).toBe(0);
    expect(toFiniteNumber("0")).toBe(0);

    // Invalid values
    expect(toFiniteNumber(null)).toBeNull();
    expect(toFiniteNumber(undefined)).toBeNull();
    expect(toFiniteNumber(NaN)).toBeNull();
    expect(toFiniteNumber(Infinity)).toBeNull();
    expect(toFiniteNumber("abc")).toBeNull();
  });

  test('isMalformed helper identifies malformed data correctly', () => {
    // Expected/valid nulls or values
    expect(isMalformed(null)).toBe(false);
    expect(isMalformed(undefined)).toBe(false);
    expect(isMalformed("")).toBe(false);
    expect(isMalformed("   ")).toBe(false);
    expect(isMalformed(2.5)).toBe(false);
    expect(isMalformed("2.5")).toBe(false);
    expect(isMalformed(0)).toBe(false);

    // Truly malformed values
    expect(isMalformed(NaN)).toBe(true);
    expect(isMalformed(Infinity)).toBe(true);
    expect(isMalformed("abc")).toBe(true);
  });
});

describe('Prediction Pipeline Runtime Safety - Integration Tests', () => {
  test('Endpoint degrades gracefully under malformed odds scenario', async () => {
    const req = new Request('http://localhost/api/admin/market-simulation', {
      method: 'POST',
      headers: {
        'x-admin-secret': process.env.ADMIN_SECRET || 'test-secret',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        competition: 'FIFA World Cup'
      })
    });

    // Set ADMIN_SECRET env for mock test execution
    process.env.ADMIN_SECRET = 'test-secret';

    const response = await marketSimulationPost(req);
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.matches_analyzed).toBe(1);
    // Since ML odds is malformed ("abc"), ML will be skipped, but endpoint does not crash!
  });
});
