import { FootballProvider } from './types';
import { ApiFootballProvider } from './apiFootball';
import { FootballDataProvider } from './footballData';
import { MockProvider } from './mockProvider';

export function getFootballProvider(): FootballProvider {
  const providerName = process.env.DATA_PROVIDER || 'api-football';

  switch (providerName) {
    case 'football-data':
      return new FootballDataProvider();
    case 'mock':
      return new MockProvider();
    case 'api-football':
    default:
      return new ApiFootballProvider();
  }
}
