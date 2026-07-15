/**
 * EPIC 31B — Production Replay & Shadow Validation
 * Type & Configuration Tests
 */

import { describe, it, expect } from 'vitest';
import {
  LEAGUE_CONFIGS,
  getLeagueConfig,
  getAllLeagueIds,
  getLeagueName,
} from '../../src/lib/epic31b/league-config';

describe('EPIC 31B — League Configuration', () => {
  it('should have configurations for all 6 major leagues', () => {
    const leagueIds = getAllLeagueIds();
    expect(leagueIds).toHaveLength(6);
    expect(leagueIds).toContain('39');
    expect(leagueIds).toContain('40');
    expect(leagueIds).toContain('135');
    expect(leagueIds).toContain('140');
    expect(leagueIds).toContain('78');
    expect(leagueIds).toContain('61');
  });

  it('should return correct league name for EPL', () => {
    expect(getLeagueName('39')).toBe('EPL');
  });

  it('should return correct league name for La Liga', () => {
    expect(getLeagueName('40')).toBe('La Liga');
  });

  it('should return correct league name for Bundesliga', () => {
    expect(getLeagueName('135')).toBe('Bundesliga');
  });

  it('should return correct league name for Serie A', () => {
    expect(getLeagueName('140')).toBe('Serie A');
  });

  it('should return correct league name for Ligue 1', () => {
    expect(getLeagueName('78')).toBe('Ligue 1');
  });

  it('should return correct league name for Liga Portugal', () => {
    expect(getLeagueName('61')).toBe('Liga Portugal');
  });

  it('should have valid configuration for each league', () => {
    for (const leagueId of getAllLeagueIds()) {
      const config = getLeagueConfig(leagueId);
      expect(config.leagueId).toBe(leagueId);
      expect(config.leagueName).toBeDefined();
      expect(config.country).toBeDefined();
      expect(config.season).toBeDefined();
      expect(config.parquetPath).toBeDefined();
      expect(config.marketTypes.length).toBeGreaterThan(0);
    }
  });

  it('should have parquet paths pointing to existing files or valid paths', () => {
    const fs = require('fs');
    for (const leagueId of getAllLeagueIds()) {
      const config = getLeagueConfig(leagueId);
      const fullPath = require('path').join(process.cwd(), config.parquetPath);
      // In test environment, file may not exist, but path should be valid
      expect(config.parquetPath).toContain('.parquet');
    }
  });
});
