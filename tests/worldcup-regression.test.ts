import { describe, test, expect, vi } from 'vitest';
import { normalizeTournamentStage } from '../src/lib/utils/stageNormalization';
import { getCohortTag } from '../src/lib/crons/cohortTag';

// Mock Supabase Server Client
vi.mock('../src/lib/supabase.server', () => {
  return {
    supabase: {
      from: vi.fn().mockImplementation((table: string) => {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          then: (resolve: any) => {
            if (table === 'matches') {
              resolve({
                data: [
                  {
                    id: 'brazil-japan-uuid',
                    home_team: 'Brazil',
                    away_team: 'Japan',
                    league: 'FIFA World Cup',
                    kickoff: '2026-07-01T18:00:00Z',
                    status: 'upcoming',
                    competition_type: 'international',
                    tournament_stage: 'Playoffs'
                  }
                ],
                error: null
              });
            } else if (table === 'predictions') {
              resolve({ data: [], error: null });
            } else {
              resolve({ data: [], error: null });
            }
          }
        };
      })
    }
  };
});

// Mock Price access logs daily reveals
vi.mock('../src/lib/pricing/access-logs', () => {
  return {
    getUserDailyReveals: vi.fn().mockResolvedValue([]),
    hashString: (s: string) => s
  };
});

// Mock Price entitlements
vi.mock('../src/lib/pricing/entitlement', () => {
  return {
    getUserEntitlements: vi.fn().mockResolvedValue({
      tier: 'free',
      hasFullEdgeData: false
    })
  };
});

// Mock Rate Limit
vi.mock('../src/lib/pricing/rate-limit', () => {
  return {
    isRateLimited: vi.fn().mockResolvedValue(false)
  };
});

import { GET as predictionsGet } from '../src/app/api/predictions/route';

describe('World Cup Knockout Regression Tests', () => {
  test('Stage Normalization maps knockout stages consistently', () => {
    expect(normalizeTournamentStage('Round of 32')).toBe('Round of 32');
    expect(normalizeTournamentStage('1/16-finals')).toBe('Round of 32');
    expect(normalizeTournamentStage('Play Offs')).toBe('Playoffs');
    expect(normalizeTournamentStage('World Championship Play Offs')).toBe('Playoffs');
    expect(normalizeTournamentStage('Round of 32 / 1/16 Finals')).toBe('Round of 32');
  });

  test('getCohortTag maps normalized stages to WORLD_CUP_KO', () => {
    // FIFA World Cup has apiFootballId = 1
    expect(getCohortTag(1, 'Playoffs')).toBe('WORLD_CUP_KO');
    expect(getCohortTag(1, 'Round of 32')).toBe('WORLD_CUP_KO');
    expect(getCohortTag(1, 'Group Stage')).toBe('WORLD_CUP_GROUP');
  });

  test('World Cup knockout fixture Brazil vs Japan appears in predictions API response even without predictions', async () => {
    const req = new Request('http://localhost/api/predictions', {
      headers: {
        'x-forwarded-for': '127.0.0.1'
      }
    });
    
    const response = await predictionsGet(req);
    expect(response.status).toBe(200);
    
    const body = await response.json();
    expect(body.success).toBe(true);
    
    const predictions = body.predictions;
    const match = predictions.find((p: any) => p.match === 'Brazil vs Japan');
    
    expect(match).toBeDefined();
    expect(match.matchId).toBe('brazil-japan-uuid');
    expect(match.league).toBe('WORLD_CUP_KO');
    expect(match.asianHandicap.line).toBe('N/A');
    expect(match.asianHandicap.odds).toBe(0.0);
    expect(match.overUnder.line).toBe('N/A');
    expect(match.overUnder.odds).toBe(0.0);
  });
});
