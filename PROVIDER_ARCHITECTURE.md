# Provider Architecture

This document describes the Data Provider Abstraction implemented to support swapping and extending data sources seamlessly.

## Design

All data ingestion routes communicate exclusively with the `FootballProvider` interface defined in `src/lib/api/providers/types.ts`. 

The interface guarantees that no matter which external data API is being consumed, the system always receives a standardized `NormalizedFixture` object. This shields the database insertions, predictions pipeline, and paper trading logic from any provider-specific structure changes.

### Current Implementations
- `ApiFootballProvider`: Wrapper for the legacy `API-Football` implementation.
- `FootballDataProvider`: Implementation for `api.football-data.org`.
- `MockProvider`: Implementation that generates mock fixtures locally for testing without external API calls.

## How to Switch Providers

The active provider is determined dynamically at runtime based on the `DATA_PROVIDER` environment variable. 

In your `.env` or `.env.local`:
```bash
# To use football-data.org
DATA_PROVIDER=football-data
FOOTBALL_DATA_API_KEY=your_key_here

# To use API-Football (default)
DATA_PROVIDER=api-football
API_FOOTBALL_KEY=your_key_here

# To use the Mock provider (for unit tests and offline testing)
DATA_PROVIDER=mock
```

## Error Handling & Fallbacks
If a provider is selected but its API requests fail (e.g., due to rate limits or invalid keys), the system **will not** silently fall back to another provider. This ensures deterministic behavior. Instead, the failure is caught, logged with details (provider, endpoint, error, timestamp), and the ingestion skips that specific competition but continues attempting others.

## Extending: Adding a New Provider

Adding a new provider (e.g., `SportmonksProvider` or an Odds provider) is straightforward and requires zero changes to the ingestion routes.

### 1. Implement the Interface
Create a new file in `src/lib/api/providers/sportmonksProvider.ts`:
```typescript
import { FootballProvider, NormalizedFixture } from './types';
import { LeagueConfig } from '@/lib/crons/leagueRegistry';

export class SportmonksProvider implements FootballProvider {
  async getFixtures(leagueConfig: LeagueConfig, season: number): Promise<NormalizedFixture[]> {
    // 1. Fetch data from Sportmonks
    // 2. Map their response to NormalizedFixture
    // 3. Return the array
  }
  // Implement getResults and getStandings...
}
```

### 2. Add IDs to the Registry (Optional)
If the new provider uses different league IDs, update `LeagueConfig` in `src/lib/crons/leagueRegistry.ts` to include `sportmonksId?: number`, and map them in `LEAGUE_REGISTRY`.

### 3. Register the Provider
Update `src/lib/api/providers/providerFactory.ts` to return your new provider when requested:
```typescript
import { SportmonksProvider } from './sportmonksProvider';

export function getFootballProvider(): FootballProvider {
  const providerName = process.env.DATA_PROVIDER || 'api-football';
  switch (providerName) {
    case 'sportmonks':
      return new SportmonksProvider();
    // ... existing cases
  }
}
```
