import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LEAGUE_REGISTRY, getLeagueConfig } from '../src/lib/crons/leagueRegistry';
import { ApiFootballProvider } from '../src/lib/api/providers/apiFootball';
import { apiFootballClient } from '../src/lib/api/apiFootball';

// Mock apiFootballClient
vi.mock('../src/lib/api/apiFootball', () => {
  return {
    apiFootballClient: {
      getFixtures: vi.fn()
    }
  };
});

describe('Phase 8.6: Competition Coverage & World Cup Validation Feed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('League Registry Validation', () => {
    it('should have FIFA World Cup 2026 configured correctly', () => {
      const wc = getLeagueConfig(1);
      expect(wc).not.toBeNull();
      expect(wc?.id).toBe('world_cup_2026');
      expect(wc?.enabled).toBe(true);
      expect(wc?.priority).toBe(1);
      expect(wc?.cohort).toBe('WORLD_CUP');
      expect(wc?.type).toBe('international');
      expect(wc?.competition_type).toBe('international_tournament');
      expect(wc?.activation).toEqual({
        start: '2026-06-11',
        end: '2026-07-19'
      });
    });

    it('should have UEFA Europa League configured correctly', () => {
      const el = getLeagueConfig(3);
      expect(el).not.toBeNull();
      expect(el?.id).toBe('uefa_europa_league');
      expect(el?.enabled).toBe(true);
      expect(el?.priority).toBe(1);
      expect(el?.cohort).toBe('EUROPA');
      expect(el?.competition_type).toBe('cup');
    });

    it('should have UEFA Conference League configured correctly', () => {
      const cl = getLeagueConfig(844);
      expect(cl).not.toBeNull();
      expect(cl?.id).toBe('uefa_conference_league');
      expect(cl?.enabled).toBe(true);
      expect(cl?.priority).toBe(3);
      expect(cl?.competition_type).toBe('cup');
    });

    it('should have Premier League configured correctly', () => {
      const epl = getLeagueConfig(39);
      expect(epl).not.toBeNull();
      expect(epl?.competition_type).toBe('league');
    });
  });

  describe('API-Football Ingestion & Normalization', () => {
    it('should successfully parse World Cup fixtures using ApiFootballProvider', async () => {
      const mockApiResponse = [
        {
          fixture: {
            id: 999,
            date: '2026-06-15T18:00:00Z',
            status: { short: 'NS' }
          },
          league: {
            name: 'World Cup'
          },
          teams: {
            home: { id: 10, name: 'Indonesia' },
            away: { id: 20, name: 'Argentina' }
          }
        }
      ];

      vi.mocked(apiFootballClient.getFixtures).mockResolvedValue(mockApiResponse);

      const provider = new ApiFootballProvider();
      const wcConfig = getLeagueConfig(1)!;
      const normalized = await provider.getFixtures(wcConfig, 2026);

      expect(normalized).toHaveLength(1);
      expect(normalized[0]).toEqual({
        id: '999',
        competitionId: '1',
        competitionName: 'World Cup',
        homeTeam: 'Indonesia',
        awayTeam: 'Argentina',
        matchDate: '2026-06-15T18:00:00Z',
        status: 'upcoming',
        season: 2026,
        homeTeamId: '10',
        awayTeamId: '20',
        tournamentStage: 'Group Stage'
      });
      expect(apiFootballClient.getFixtures).toHaveBeenCalledWith(1, 2026);
    });
  });
});
