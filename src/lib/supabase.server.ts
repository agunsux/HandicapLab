import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { validateCredential } from './auth/credentialValidator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') || 'https://rgkrfzxipkrwqccfuqfq.supabase.co';

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  let rawKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/['`"]/g, '').trim();
  if (!rawKey && typeof window === 'undefined') {
    try {
      const fs = require('fs');
      const path = require('path');
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
        if (match) {
          rawKey = match[1].replace(/[\r\n'"`]/g, '').trim();
        }
      }
    } catch {}
  }
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
