import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { validateCredential } from './auth/credentialValidator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') || 'https://rgkrfzxipkrwqccfuqfq.supabase.co';
console.log('[Supabase Server Client] Initializing with URL:', supabaseUrl);

const FAIL_CLOSED_MESSAGE =
  '[FAIL CLOSED] Authentication failed: SUPABASE_SERVICE_ROLE_KEY is missing, empty, or malformed. No Supabase connection was established.';

// Fail-closed stub: any database operation throws instead of silently using a
// mock/fallback credential. The real client is only created when the service
// role key is structurally valid.
function poisonedClient(): SupabaseClient {
  return new Proxy({} as unknown as SupabaseClient, {
    get(_target, prop: string | symbol) {
      const operation = String(prop);
      return (_args?: unknown) => {
        throw new Error(`${FAIL_CLOSED_MESSAGE} (operation: ${operation})`);
      };
    },
  });
}

let supabase: SupabaseClient;
try {
  const supabaseServiceKey = validateCredential('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY, 'jwt');
  supabase = createClient(supabaseUrl, supabaseServiceKey);
} catch {
  supabase = poisonedClient();
}

export { supabase };
