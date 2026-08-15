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
