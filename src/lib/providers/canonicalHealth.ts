// Canonical Provider Health Evaluator
// Location: src/lib/providers/canonicalHealth.ts

export type ProviderHealthStatusEnum =
  | 'NOT_CONFIGURED'
  | 'CONFIGURED'
  | 'AUTH_FAILED'
  | 'API_UNAVAILABLE'
  | 'AUTHENTICATED'
  | 'DATA_AVAILABLE';

export interface ProviderDiagnostic {
  configured: boolean;
  authenticated: boolean;
  dataAvailable: boolean;
  baseUrl: string;
  status: ProviderHealthStatusEnum;
  latencyMs: number;
  error?: string | null;
}

export interface CanonicalProviderHealthReport {
  timestamp: string;
  apiFootball: ProviderDiagnostic;
  oddsPapi: ProviderDiagnostic;
}

export async function evaluateCanonicalProviderHealth(timeoutMs: number = 5000): Promise<CanonicalProviderHealthReport> {
  const timestamp = new Date().toISOString();

  // 1. API-Football
  const afKey = (process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '').trim();
  const afBaseUrl = 'https://v3.football.api-sports.io';
  let afDiagnostic: ProviderDiagnostic = {
    configured: !!afKey,
    authenticated: false,
    dataAvailable: false,
    baseUrl: afBaseUrl,
    status: afKey ? 'CONFIGURED' : 'NOT_CONFIGURED',
    latencyMs: 0,
    error: afKey ? null : 'Missing APIFOOTBALL_KEY / API_FOOTBALL_KEY',
  };

  if (afKey) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${afBaseUrl}/status`, {
        headers: {
          'x-apisports-key': afKey,
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(id);
      afDiagnostic.latencyMs = Date.now() - start;

      if (res.status === 200) {
        const body = await res.json().catch(() => null);
        if (body?.errors && Object.keys(body.errors).length > 0 && !Array.isArray(body.errors)) {
          afDiagnostic.status = 'AUTH_FAILED';
          afDiagnostic.error = JSON.stringify(body.errors);
        } else {
          afDiagnostic.authenticated = true;
          afDiagnostic.dataAvailable = true;
          afDiagnostic.status = 'DATA_AVAILABLE';
        }
      } else if (res.status === 401 || res.status === 403) {
        afDiagnostic.status = 'AUTH_FAILED';
        afDiagnostic.error = `HTTP ${res.status}: Unauthorized`;
      } else {
        afDiagnostic.status = 'API_UNAVAILABLE';
        afDiagnostic.error = `HTTP ${res.status}`;
      }
    } catch (err: any) {
      afDiagnostic.latencyMs = Date.now() - start;
      afDiagnostic.status = 'API_UNAVAILABLE';
      afDiagnostic.error = err.message || String(err);
    }
  }

  // 2. OddsPAPI.io
  const opKey = (process.env.ODDS_PAPI_KEY || '').trim();
  const opBaseUrl = 'https://api.oddspapi.io';
  let opDiagnostic: ProviderDiagnostic = {
    configured: !!opKey,
    authenticated: false,
    dataAvailable: false,
    baseUrl: opBaseUrl,
    status: opKey ? 'CONFIGURED' : 'NOT_CONFIGURED',
    latencyMs: 0,
    error: opKey ? null : 'Missing ODDS_PAPI_KEY',
  };

  if (opKey) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${opBaseUrl}/v4/sports?apiKey=${encodeURIComponent(opKey)}`, {
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(id);
      opDiagnostic.latencyMs = Date.now() - start;

      if (res.status === 200) {
        opDiagnostic.authenticated = true;
        opDiagnostic.dataAvailable = true;
        opDiagnostic.status = 'DATA_AVAILABLE';
      } else if (res.status === 401 || res.status === 403) {
        opDiagnostic.status = 'AUTH_FAILED';
        opDiagnostic.error = `HTTP ${res.status}: Invalid API key`;
      } else {
        opDiagnostic.status = 'API_UNAVAILABLE';
        opDiagnostic.error = `HTTP ${res.status}`;
      }
    } catch (err: any) {
      opDiagnostic.latencyMs = Date.now() - start;
      opDiagnostic.status = 'API_UNAVAILABLE';
      opDiagnostic.error = err.message || String(err);
    }
  }

  return {
    timestamp,
    apiFootball: afDiagnostic,
    oddsPapi: opDiagnostic,
  };
}
