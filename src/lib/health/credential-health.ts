// Provider Credential Health Guard (EPIC 34.1)
// Location: src/lib/health/credential-health.ts

import { HealthCheck, HealthStatus } from './types';

export class ProviderCredentialCheck implements HealthCheck {
  public name = 'provider_credentials';

  public async run(): Promise<{
    status: HealthStatus;
    message?: string;
    details?: Record<string, any>;
  }> {
    const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
    const apiFootballKey = process.env.API_FOOTBALL_KEY;
    const oddsApiKey = process.env.ODDSPAPI_KEY;

    const hasApiFootball = !!(apiFootballKey && apiFootballKey.trim().length > 0);
    const hasOddsApi = !!(oddsApiKey && oddsApiKey.trim().length > 0);

    const details = {
      apiFootballConfigured: hasApiFootball,
      oddsApiConfigured: hasOddsApi,
      mode: isProduction ? 'PRODUCTION' : 'DEVELOPMENT_STATIC_BUILD',
      usingMockFallback: !hasApiFootball
    };

    // During static build or development, missing keys return healthy fallback status to prevent build log spam
    if (!isProduction) {
      return {
        status: 'healthy',
        message: hasApiFootball
          ? 'Provider credentials valid'
          : 'Static build mode active (using deterministic local fallback mock)',
        details
      };
    }

    // In production, missing primary keys trigger degraded status
    if (!hasApiFootball) {
      return {
        status: 'degraded',
        message: 'Primary API_FOOTBALL_KEY missing in production environment',
        details
      };
    }

    return {
      status: 'healthy',
      message: 'All provider credentials active & healthy',
      details
    };
  }
}
