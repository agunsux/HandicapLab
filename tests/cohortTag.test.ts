import { describe, test, expect } from 'vitest';
import { getCohortTag } from '../src/lib/crons/cohortTag';
import { getLeagueConfig } from '../src/lib/crons/leagueRegistry';

describe('cohortTag logic', () => {
  test('World Cup group stage returns WORLD_CUP_GROUP', () => {
    const tag = getCohortTag(1, 'group stage');
    expect(tag).toBe('WORLD_CUP_GROUP');
  });

  test('World Cup knockout stage returns WORLD_CUP_KO', () => {
    const tag = getCohortTag(1, 'Quarter Finals');
    expect(tag).toBe('WORLD_CUP_KO');
  });

  test('Premier League returns EPL cohort', () => {
    const tag = getCohortTag(39);
    expect(tag).toBe('EPL');
  });

  test('Ligue 2 returns LIGUE2 cohort', () => {
    const tag = getCohortTag(848);
    expect(tag).toBe('LIGUE2');
  });

  test('Unknown league falls back to GENERAL', () => {
    const tag = getCohortTag(9999);
    expect(tag).toBe('GENERAL');
  });
});
