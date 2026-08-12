export function validateEnvironment() {
  const requiredVars = [
    { canonical: 'NEXT_PUBLIC_SUPABASE_URL', fallbacks: [] },
    { canonical: 'SUPABASE_SERVICE_ROLE_KEY', fallbacks: [] },
    { canonical: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', fallbacks: [] },
    { canonical: 'APIFOOTBALL_KEY', fallbacks: ['API_FOOTBALL_KEY'] },
    { canonical: 'ODDS_PAPI_KEY', fallbacks: ['ODDSPAPI_KEY'] },
    { canonical: 'CRON_SECRET', fallbacks: [] }
  ];

  const missing: string[] = [];
  const malformed: string[] = [];

  for (const item of requiredVars) {
    const val = process.env[item.canonical] || item.fallbacks.map(f => process.env[f]).find(Boolean);
    if (!val) {
      missing.push(item.canonical);
    } else if (val === 'mock' || val === 'mock_server_key' || val.includes('.mock')) {
      malformed.push(item.canonical);
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
    { canonical: 'NEXT_PUBLIC_SUPABASE_URL', fallbacks: [] },
    { canonical: 'SUPABASE_SERVICE_ROLE_KEY', fallbacks: [] },
    { canonical: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', fallbacks: [] },
    { canonical: 'APIFOOTBALL_KEY', fallbacks: ['API_FOOTBALL_KEY'] },
    { canonical: 'ODDS_PAPI_KEY', fallbacks: ['ODDSPAPI_KEY'] },
    { canonical: 'CRON_SECRET', fallbacks: [] },
    { canonical: 'MIDTRANS_SERVER_KEY', fallbacks: [] },
    { canonical: 'TELEGRAM_BOT_TOKEN', fallbacks: [] },
    { canonical: 'TELEGRAM_CHAT_ID', fallbacks: [] }
  ];

  const missing: string[] = [];
  const malformed: string[] = [];

  for (const item of vars) {
    const val = process.env[item.canonical] || item.fallbacks.map(f => process.env[f]).find(Boolean);
    if (!val) {
      missing.push(item.canonical);
    } else if (val === 'mock' || val === 'mock_server_key' || val.includes('.mock')) {
      malformed.push(item.canonical);
    }
  }

  const isHealthy = missing.length === 0 && malformed.length === 0;

  return {
    status: isHealthy ? 'healthy' : 'unhealthy',
    missing,
    malformed
  };
}
