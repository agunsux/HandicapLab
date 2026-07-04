export function validateEnvironment() {
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'API_FOOTBALL_KEY',
    'ODDSPAPI_KEY',
    'CRON_SECRET'
  ];

  const missing: string[] = [];
  const malformed: string[] = [];

  for (const v of requiredVars) {
    const val = process.env[v];
    if (!val) {
      missing.push(v);
    } else if (val === 'mock' || val === 'mock_server_key' || val.includes('.mock')) {
      malformed.push(v);
    }
  }

  if (missing.length > 0 || malformed.length > 0) {
    const err = new Error(
      `[Startup Validation Failed] Environment is severely misconfigured.\n` +
      `Missing required variables: ${missing.join(', ') || 'None'}\n` +
      `Malformed/mock variables: ${malformed.join(', ') || 'None'}`
    );
    err.name = 'EnvironmentValidationError';
    throw err;
  }

  return true;
}

export function checkEnvironmentStatus() {
  const vars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'API_FOOTBALL_KEY',
    'ODDSPAPI_KEY',
    'CRON_SECRET',
    'MIDTRANS_SERVER_KEY',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID'
  ];

  const missing: string[] = [];
  const malformed: string[] = [];

  for (const v of vars) {
    const val = process.env[v];
    if (!val) {
      missing.push(v);
    } else if (val === 'mock' || val === 'mock_server_key' || val.includes('.mock')) {
      malformed.push(v);
    }
  }

  const isHealthy = missing.length === 0 && malformed.length === 0;

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    missing,
    malformed
  };
}
