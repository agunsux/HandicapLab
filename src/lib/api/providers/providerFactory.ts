import { FootballProvider } from './types';
import { ApiFootballProvider } from './apiFootball';
import { FootballDataProvider } from './footballData';

export function getFootballProvider(): FootballProvider {
  const providerName = process.env.DATA_PROVIDER || 'api-football';

  switch (providerName) {
    case 'football-data':
      return new FootballDataProvider();
    case 'api-football':
    default:
      return new ApiFootballProvider();
  }
}
