import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IngestionNormalizer } from '../src/lib/warehouse/ingestion/normalizer';
import { ApiFootballProvider } from '../src/lib/warehouse/ingestion/apiFootballProvider';
import { ValidationError, ParsingError, RateLimitError, AuthenticationError } from '../src/lib/warehouse/ingestion/errors';

describe('Ingestion Normalizer & Canonical Models', () => {
  it('should normalize competition correctly', () => {
    const raw = {
      id: 39,
      name: 'Premier League',
      country: 'England',
      type: 'league',
      logo: 'https://media.api-sports.io/football/leagues/39.png'
    };

    const canonical = IngestionNormalizer.toCompetition(raw, 'api-football');

    expect(canonical.apiId).toBe(39);
    expect(canonical.name).toBe('Premier League');
    expect(canonical.country).toBe('England');
    expect(canonical.type).toBe('league');
  });

  it('should throw ValidationError on missing fields in Competition', () => {
    const raw = { id: 39 }; // Missing name
    expect(() => IngestionNormalizer.toCompetition(raw, 'api-football')).toThrow(ValidationError);
  });

  it('should throw ValidationError on invalid odds values', () => {
    const rawOdds = {
      fixtureId: 1001,
      bookmakerId: 6,
      marketId: 1,
      timestamp: '2026-07-01T12:00:00Z',
      outcomes: [
        { selection: 'Home', odds: 0.95 } // Invalid: odds must be > 1.0
      ]
    };

    expect(() => IngestionNormalizer.toOddsSnapshot(rawOdds, 'api-football')).toThrow(ValidationError);
  });
});

describe('ApiFootballProvider - HTTP Exceptions', () => {
  it('should handle rate limits correctly', async () => {
    const provider = new ApiFootballProvider({ apiKey: 'mock-key', baseUrl: 'https://mock.api' });
    
    // Mock the global fetch object
    global.fetch = vi.fn().mockResolvedValue({
      status: 429,
      ok: false,
      json: async () => ({})
    } as any);

    await expect(provider.getCompetitions()).rejects.toThrow(RateLimitError);
  });

  it('should handle auth exceptions correctly', async () => {
    const provider = new ApiFootballProvider({ apiKey: 'mock-key', baseUrl: 'https://mock.api' });
    
    global.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({})
    } as any);

    await expect(provider.getCompetitions()).rejects.toThrow(AuthenticationError);
  });
});
