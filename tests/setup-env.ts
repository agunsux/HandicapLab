// Test-only environment setup.
// Supplies structurally valid (but fake, never used against real providers)
// credentials so unit/integration suites can import credential-gated modules.
// Production runtime is unaffected: these are process.env values scoped to the
// vitest process only. Never used as fallbacks in production code.

const STRUCTURALLY_VALID_FAKE_CREDENTIALS: Record<string, string> = {
  APIFOOTBALL_KEY: 'api-football-test-key-1234567890',
  ODDS_PAPI_KEY: 'odds-papi-test-key-1234567890',
  // 3-segment base64url JWT — passes the structural 'jwt' credential check.
  SUPABASE_SERVICE_ROLE_KEY:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwidGVzdCI6InRydWUifQ.abcd1234efgh5678ijklmnopqrstuvwx',
};

for (const [key, value] of Object.entries(STRUCTURALLY_VALID_FAKE_CREDENTIALS)) {
  if (process.env[key] === undefined || process.env[key] === '') {
    process.env[key] = value;
  }
}

// ---------------------------------------------------------------------------
// P0.1 Test Network Firewall — ZERO Network Requests to External Providers
// ---------------------------------------------------------------------------
const BLOCKED_PROVIDER_DOMAINS = [
  'api-sports.io',
  'football.api-sports.io',
  'v3.football.api-sports.io',
  'api-football.com',
  'oddspapi.io',
  'the-odds-api.com',
  'footystats.org',
  'football-data-api.com',
  'football-data.org',
];

export function isBlockedProviderUrl(url: string | URL | Request): boolean {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
  return BLOCKED_PROVIDER_DOMAINS.some((domain) => urlStr.includes(domain));
}

let blockedRequestCount = 0;
export function getBlockedRequestCount(): number {
  return blockedRequestCount;
}

export function resetBlockedRequestCount(): void {
  blockedRequestCount = 0;
}

const originalGlobalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  if (isBlockedProviderUrl(input)) {
    blockedRequestCount++;
    const targetUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    throw new Error(
      `[TEST_FIREWALL_BLOCKED] Real provider outbound HTTP request blocked in test environment: ${targetUrl}`
    );
  }
  return originalGlobalFetch(input, init);
};
