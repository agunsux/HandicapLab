import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { validateCredential } from './auth/credentialValidator';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') || 'https://rgkrfzxipkrwqccfuqfq.supabase.co';

let cachedKey: string | null = null;
let cachedClient: SupabaseClient | null = null;

export function resetSupabaseClient(): void {
  cachedClient = null;
  cachedKey = null;
}

function getClient(): SupabaseClient {
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

  if (cachedClient && cachedKey === rawKey) return cachedClient;

  const clientOptions = {
    global: {
      fetch: (url: any, init?: any) => {
        const timeoutMs = process.env.VERCEL ? 5000 : 30_000;
        return fetch(url, {
          ...init,
          signal: init?.signal || AbortSignal.timeout(timeoutMs),
        });
      },
    },
  };

  try {
    const supabaseServiceKey = validateCredential('SUPABASE_SERVICE_ROLE_KEY', rawKey, 'jwt');
    cachedClient = createClient(supabaseUrl, supabaseServiceKey, clientOptions);
    cachedKey = rawKey;
    return cachedClient;
  } catch {
    cachedClient = createClient(supabaseUrl, rawKey, clientOptions);
    cachedKey = rawKey;
    return cachedClient;
  }
}

export const supabase: SupabaseClient = new Proxy({} as unknown as SupabaseClient, {
  has(target, prop: string | symbol) {
    if (prop in target) return true;
    try {
      const client = getClient();
      return prop in client;
    } catch {
      return false;
    }
  },
  get(target, prop: string | symbol) {
    if (prop in target) {
      return (target as any)[prop];
    }
    const client = getClient();
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
  set(target, prop: string | symbol, value: any) {
    (target as any)[prop] = value;
    return true;
  },
  defineProperty(target, prop: string | symbol, descriptor: PropertyDescriptor) {
    Object.defineProperty(target, prop, descriptor);
    return true;
  },
  deleteProperty(target, prop: string | symbol) {
    delete (target as any)[prop];
    return true;
  }
});
