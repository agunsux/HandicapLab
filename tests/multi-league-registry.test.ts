import { describe, it, expect } from 'vitest';
import {
  CANONICAL_15_LEAGUES,
  getLeagueByKey,
  getLeagueByAfId,
  getLeagueByOpId,
  getActiveLeagues,
  getShadowLeagues,
  calculateLeaguePriorityScore,
} from '@/lib/config/multiLeagueRegistry';

describe('Multi-League Registry Specification', () => {
  it('registers precisely 15 candidate leagues across Tiers A, B, and C', () => {
    expect(CANONICAL_15_LEAGUES).toHaveLength(15);

    const tierA = CANONICAL_15_LEAGUES.filter((l) => l.tier === 'A');
    const tierB = CANONICAL_15_LEAGUES.filter((l) => l.tier === 'B');
    const tierC = CANONICAL_15_LEAGUES.filter((l) => l.tier === 'C');

    expect(tierA).toHaveLength(5);
    expect(tierB).toHaveLength(5);
    expect(tierC).toHaveLength(5);
  });

  it('resolves valid provider IDs for every candidate league', () => {
    for (const league of CANONICAL_15_LEAGUES) {
      expect(league.provider_league_id).toBeGreaterThan(0);
      expect(league.oddspapi_tournament_id).toBeGreaterThan(0);
      expect(league.internal_league_id).toBeDefined();
      expect(league.internal_league_id.length).toBeGreaterThan(3);
    }
  });

  it('correctly maps Big 5 Tier A leagues to verified API-Football and OddsPapi IDs', () => {
    const epl = getLeagueByKey('ENG-PL');
    expect(epl).toBeDefined();
    expect(epl?.provider_league_id).toBe(39);
    expect(epl?.oddspapi_tournament_id).toBe(17);

    const laliga = getLeagueByKey('ESP-LALIGA');
    expect(laliga).toBeDefined();
    expect(laliga?.provider_league_id).toBe(140);
    expect(laliga?.oddspapi_tournament_id).toBe(8);

    const seriea = getLeagueByKey('ITA-SERIEA');
    expect(seriea).toBeDefined();
    expect(seriea?.provider_league_id).toBe(135);
    expect(seriea?.oddspapi_tournament_id).toBe(23);

    const bundesliga = getLeagueByKey('DEU-BUNDESLIGA');
    expect(bundesliga).toBeDefined();
    expect(bundesliga?.provider_league_id).toBe(78);
    expect(bundesliga?.oddspapi_tournament_id).toBe(35);

    const ligue1 = getLeagueByKey('FRA-LIGUE1');
    expect(ligue1).toBeDefined();
    expect(ligue1?.provider_league_id).toBe(61);
    expect(ligue1?.oddspapi_tournament_id).toBe(34);
  });

  it('correctly maps Tier B and Tier C leagues to verified IDs', () => {
    expect(getLeagueByKey('NED-ERE')?.provider_league_id).toBe(88);
    expect(getLeagueByKey('NED-ERE')?.oddspapi_tournament_id).toBe(37);

    expect(getLeagueByKey('POR-PRIMEIRA')?.provider_league_id).toBe(94);
    expect(getLeagueByKey('POR-PRIMEIRA')?.oddspapi_tournament_id).toBe(238);

    expect(getLeagueByKey('BEL-PRO')?.provider_league_id).toBe(144);
    expect(getLeagueByKey('BEL-PRO')?.oddspapi_tournament_id).toBe(38);

    expect(getLeagueByKey('SCO-PREM')?.provider_league_id).toBe(179);
    expect(getLeagueByKey('SCO-PREM')?.oddspapi_tournament_id).toBe(36);

    expect(getLeagueByKey('ENG-CHAMP')?.provider_league_id).toBe(40);
    expect(getLeagueByKey('ENG-CHAMP')?.oddspapi_tournament_id).toBe(18);

    expect(getLeagueByKey('USA-MLS')?.provider_league_id).toBe(253);
    expect(getLeagueByKey('USA-MLS')?.oddspapi_tournament_id).toBe(242);

    expect(getLeagueByKey('SAU-PRO')?.provider_league_id).toBe(307);
    expect(getLeagueByKey('SAU-PRO')?.oddspapi_tournament_id).toBe(955);

    expect(getLeagueByKey('JPN-J1')?.provider_league_id).toBe(98);
    expect(getLeagueByKey('JPN-J1')?.oddspapi_tournament_id).toBe(196);

    expect(getLeagueByKey('KOR-K1')?.provider_league_id).toBe(292);
    expect(getLeagueByKey('KOR-K1')?.oddspapi_tournament_id).toBe(410);

    expect(getLeagueByKey('IDN-L1')?.provider_league_id).toBe(274);
    expect(getLeagueByKey('IDN-L1')?.oddspapi_tournament_id).toBe(1015);
  });

  it('fails closed on Indonesia Liga 1 due to lack of statistics coverage', () => {
    const idn = getLeagueByKey('IDN-L1');
    expect(idn).toBeDefined();
    expect(idn?.production_status).not.toBe('ACTIVE');
    expect(idn?.non_active_reason).toBe('NOT_ACTIVE: DATA_COMPLETENESS_FAIL');
    expect(idn?.statistics_availability).toBe(false);
    expect(idn?.model_eligibility).toBe(false);
  });

  it('provides fast lookups by API-Football ID and OddsPapi Tournament ID', () => {
    expect(getLeagueByAfId(39)?.internal_league_id).toBe('ENG-PL');
    expect(getLeagueByOpId(17)?.internal_league_id).toBe('ENG-PL');
    expect(getLeagueByAfId(999999)).toBeUndefined();
  });

  it('calculates operational priority score deterministically from data factors', () => {
    const highQualityScore = calculateLeaguePriorityScore({
      data_completeness: 100,
      pinnacle_availability: true,
      odds_availability: true,
      historical_sample_count: 1000,
      statistics_availability: true,
      fixtures_availability: true,
    });
    expect(highQualityScore).toBe(100);

    const lowQualityScore = calculateLeaguePriorityScore({
      data_completeness: 40,
      pinnacle_availability: false,
      odds_availability: true,
      historical_sample_count: 50,
      statistics_availability: false,
      fixtures_availability: true,
    });
    expect(lowQualityScore).toBeLessThan(40);
  });

  it('maintains explicit non-boolean status for all leagues', () => {
    const validStatuses = ['ACTIVE', 'SHADOW', 'DISCOVERY', 'PAUSED', 'DISABLED'];
    for (const l of CANONICAL_15_LEAGUES) {
      expect(validStatuses).toContain(l.production_status);
      if (l.production_status !== 'ACTIVE') {
        expect(l.non_active_reason.startsWith('NOT_ACTIVE:')).toBe(true);
      }
    }
  });
});

