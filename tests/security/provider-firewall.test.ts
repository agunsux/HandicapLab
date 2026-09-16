import { describe, it, expect } from 'vitest';
import { getBlockedRequestCount, isBlockedProviderUrl } from '../setup-env';

describe('P0.1 Test Network Firewall Verification', () => {
  it('correctly identifies blocked provider URLs', () => {
    expect(isBlockedProviderUrl('https://v3.football.api-sports.io/status')).toBe(true);
    expect(isBlockedProviderUrl('https://api.football.api-sports.io/fixtures')).toBe(true);
    expect(isBlockedProviderUrl('https://api.oddspapi.io/v4/odds')).toBe(true);
    expect(isBlockedProviderUrl('https://api.the-odds-api.com/v4/sports')).toBe(true);
    expect(isBlockedProviderUrl('https://api.football-data-api.com/league-matches')).toBe(true);
    expect(isBlockedProviderUrl('https://footystats.org/api/matches')).toBe(true);
    expect(isBlockedProviderUrl('https://api.football-data.org/v4/matches')).toBe(true);
    
    // Non-provider URLs must NOT be blocked
    expect(isBlockedProviderUrl('http://localhost:3000/api/health')).toBe(false);
    expect(isBlockedProviderUrl('https://api.github.com/repos')).toBe(false);
  });

  it('fails immediately if an unmocked call attempts to hit API-Football', async () => {
    const initialCount = getBlockedRequestCount();

    await expect(
      fetch('https://v3.football.api-sports.io/status')
    ).rejects.toThrow(/\[TEST_FIREWALL_BLOCKED\]/);

    expect(getBlockedRequestCount()).toBe(initialCount + 1);
  });

  it('fails immediately if an unmocked call attempts to hit OddsPapi', async () => {
    await expect(
      fetch('https://api.oddspapi.io/v4/odds')
    ).rejects.toThrow(/\[TEST_FIREWALL_BLOCKED\]/);
  });

  it('fails immediately if an unmocked call attempts to hit FootyStats', async () => {
    await expect(
      fetch('https://api.football-data-api.com/league-matches?season_id=2024')
    ).rejects.toThrow(/\[TEST_FIREWALL_BLOCKED\]/);
  });
});

