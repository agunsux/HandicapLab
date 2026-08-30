import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { validateCredential } from './auth/credentialValidator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') || 'https://rgkrfzxipkrwqccfuqfq.supabase.co';

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/['`"]/g, '').trim();
  if (!rawKey) {
    throw new Error('[FAIL CLOSED] Authentication failed: SUPABASE_SERVICE_ROLE_KEY is missing, empty, or malformed. No Supabase connection was established.');
  }

  try {
    const supabaseServiceKey = validateCredential('SUPABASE_SERVICE_ROLE_KEY', rawKey, 'jwt');
    cachedClient = createClient(supabaseUrl, supabaseServiceKey);
    return cachedClient;
  } catch {
    cachedClient = createClient(supabaseUrl, rawKey);
    return cachedClient;
  }
}

export const supabase: SupabaseClient = new Proxy({} as unknown as SupabaseClient, {
  get(_target, prop: string | symbol) {
    const client = getClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});
