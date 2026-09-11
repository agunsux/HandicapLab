import { describe, it, expect, afterEach } from 'vitest';
import { ApiFootballClient } from '@/lib/api/apiFootball';
import { getFootballProvider } from '@/lib/api/providers/providerFactory';

// Guard tests: production paths must fail closed instead of fabricating data.
describe('no-mock guard', () => {
  const originalAF = process.env.APIFOOTBALL_KEY;
  const originalLegacy = process.env.API_FOOTBALL_KEY;
  const originalProvider = process.env.DATA_PROVIDER;

  afterEach(() => {
    if (originalAF === undefined) delete process.env.APIFOOTBALL_KEY;
    else process.env.APIFOOTBALL_KEY = originalAF;
    if (originalLegacy === undefined) delete process.env.API_FOOTBALL_KEY;
    else process.env.API_FOOTBALL_KEY = originalLegacy;
    if (originalProvider === undefined) delete process.env.DATA_PROVIDER;
    else process.env.DATA_PROVIDER = originalProvider;
  });

  it('legacy API-Football client fails closed without a key instead of generating mock data', async () => {
    process.env.APIFOOTBALL_KEY = '';
    process.env.API_FOOTBALL_KEY = '';
    const client = new ApiFootballClient();
    await expect(client.getFixtures(99999, 1900)).rejects.toThrow(/DATA_UNAVAILABLE/);
  });

  it('treats the literal key "mock" as missing', async () => {
    process.env.APIFOOTBALL_KEY = 'mock';
    process.env.API_FOOTBALL_KEY = '';
    const client = new ApiFootballClient();
    await expect(client.getFixtures(99999, 1900)).rejects.toThrow(/DATA_UNAVAILABLE/);
  });

  it('provider factory fails closed for non API-Football providers', () => {
    process.env.DATA_PROVIDER = 'football-data';
    expect(() => getFootballProvider()).toThrow(/PROVIDER_POLICY_VIOLATION/);
  });
});
