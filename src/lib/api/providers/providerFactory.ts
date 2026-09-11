import { FootballProvider } from './types';
import { ApiFootballProvider } from './apiFootball';

/**
 * Single Source of Truth policy (AGENTS.md): API-Football is the only
 * permitted fixture/statistics provider. Other providers fail closed instead
 * of silently serving different data.
 */
export function getFootballProvider(): FootballProvider {
  const providerName = process.env.DATA_PROVIDER || 'api-football';

  if (providerName !== 'api-football') {
    throw new Error(
      `PROVIDER_POLICY_VIOLATION: DATA_PROVIDER='${providerName}' is not allowed. API-Football is the single source of truth.`
    );
  }

  return new ApiFootballProvider();
}
